import hashlib
from io import BytesIO
import os
from pathlib import Path
import time

import boto3
import requests
from PIL import Image, ImageOps


class StorageError(RuntimeError):
    code = "STORAGE_FAILURE"


def optimize_candidate(image_path: Path) -> bytes:
    """Apply the same cloud-storage budget as browser/backend photo uploads."""
    if not 0 < image_path.stat().st_size <= 20 * 1024 * 1024:
        raise StorageError("Candidate photo exceeds the source size limit.")
    try:
        with Image.open(image_path) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"} or getattr(source, "n_frames", 1) != 1 or source.width * source.height > 60_000_000:
                raise StorageError("Candidate must be a valid, bounded still photo.")
            oriented = ImageOps.exif_transpose(source)
            image = oriented.convert("RGBA" if "A" in oriented.getbands() or "transparency" in oriented.info else "RGB")
            for dimension, quality in [(1600, 90), (1600, 84), (1440, 84), (1280, 84)]:
                prepared = image.copy()
                prepared.thumbnail((dimension, dimension), Image.Resampling.LANCZOS)
                output = BytesIO()
                prepared.save(output, format="WEBP", quality=quality, method=4)
                if output.tell() <= int(0.7 * 1024 * 1024):
                    return output.getvalue()
    except StorageError:
        raise
    except Exception as exc:
        raise StorageError("Candidate photo could not be safely optimized; original was not uploaded.") from exc
    raise StorageError("Candidate exceeds the image storage budget; original was not uploaded.")


class StorageClient:
    def __init__(self):
        self.provider = self._configured_provider()
        self.s3 = None
        if self.provider == "r2":
            self.s3 = boto3.client(
                "s3",
                region_name="auto",
                endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            )

    @staticmethod
    def _configured_provider() -> str:
        r2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]
        if all(os.getenv(name) for name in r2):
            return "r2"
        cloudinary = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
        if all(os.getenv(name) for name in cloudinary):
            return "cloudinary"
        raise StorageError("R2 or Cloudinary storage is not configured for the processor.")

    def download(self, source: dict, destination: Path) -> Path:
        try:
            if source["provider"] == "r2":
                if not self.s3:
                    raise StorageError("The processor cannot access the configured R2 bucket.")
                self.s3.download_file(os.environ["R2_BUCKET_NAME"], source["storageKey"], str(destination))
            else:
                response = requests.get(source.get("url", ""), stream=True, timeout=120)
                response.raise_for_status()
                with destination.open("xb") as output:
                    for chunk in response.iter_content(1024 * 1024):
                        if chunk:
                            output.write(chunk)
        except StorageError:
            raise
        except Exception as exc:
            raise StorageError("The stored reel could not be downloaded.") from exc
        return destination

    def upload_candidate(self, image_path: Path, job_id: str, group_number: int, timestamp: float) -> dict:
        image_bytes = optimize_candidate(image_path)
        key = f"reel-imports/candidates/{job_id}/{group_number:03d}-{int(timestamp * 1000):010d}.webp"
        if self.provider == "r2":
            try:
                self.s3.put_object(
                    Bucket=os.environ["R2_BUCKET_NAME"], Key=key, Body=image_bytes,
                    ContentType="image/webp", CacheControl="private, max-age=86400",
                )
            except Exception as exc:
                raise StorageError("A candidate frame could not be uploaded to R2.") from exc
            return {
                "provider": "r2",
                "storageKey": key,
                "url": f"{os.environ['R2_PUBLIC_URL'].rstrip('/')}/{key}",
            }
        return self._upload_cloudinary(image_bytes, key)

    def _upload_cloudinary(self, image_bytes: bytes, key: str) -> dict:
        timestamp = int(time.time())
        folder = f"{os.getenv('CLOUDINARY_FOLDER', 'samira-products')}/reel-imports/candidates"
        public_id = key.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        signature_text = f"folder={folder}&public_id={public_id}&timestamp={timestamp}{os.environ['CLOUDINARY_API_SECRET']}"
        signature = hashlib.sha1(signature_text.encode("utf-8")).hexdigest()
        with BytesIO(image_bytes) as image:
            response = requests.post(
                f"https://api.cloudinary.com/v1_1/{os.environ['CLOUDINARY_CLOUD_NAME']}/image/upload",
                data={
                    "api_key": os.environ["CLOUDINARY_API_KEY"],
                    "folder": folder,
                    "public_id": public_id,
                    "timestamp": timestamp,
                    "signature": signature,
                    "overwrite": "true",
                },
                files={"file": ("candidate.webp", image, "image/webp")},
                timeout=120,
            )
        if not response.ok:
            raise StorageError("A candidate frame could not be uploaded to Cloudinary.")
        payload = response.json()
        return {"provider": "cloudinary", "storageKey": payload["public_id"], "url": payload["secure_url"]}
