import hashlib
import os
from pathlib import Path
import time

import boto3
import requests


class StorageError(RuntimeError):
    code = "STORAGE_FAILURE"


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
        key = f"reel-imports/candidates/{job_id}/{group_number:03d}-{int(timestamp * 1000):010d}.jpg"
        if self.provider == "r2":
            try:
                self.s3.upload_file(
                    str(image_path),
                    os.environ["R2_BUCKET_NAME"],
                    key,
                    ExtraArgs={"ContentType": "image/jpeg", "CacheControl": "private, max-age=86400"},
                )
            except Exception as exc:
                raise StorageError("A candidate frame could not be uploaded to R2.") from exc
            return {
                "provider": "r2",
                "storageKey": key,
                "url": f"{os.environ['R2_PUBLIC_URL'].rstrip('/')}/{key}",
            }
        return self._upload_cloudinary(image_path, key)

    def _upload_cloudinary(self, image_path: Path, key: str) -> dict:
        timestamp = int(time.time())
        folder = f"{os.getenv('CLOUDINARY_FOLDER', 'samira-products')}/reel-imports/candidates"
        public_id = key.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        signature_text = f"folder={folder}&public_id={public_id}&timestamp={timestamp}{os.environ['CLOUDINARY_API_SECRET']}"
        signature = hashlib.sha1(signature_text.encode("utf-8")).hexdigest()
        with image_path.open("rb") as image:
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
                files={"file": ("candidate.jpg", image, "image/jpeg")},
                timeout=120,
            )
        if not response.ok:
            raise StorageError("A candidate frame could not be uploaded to Cloudinary.")
        payload = response.json()
        return {"provider": "cloudinary", "storageKey": payload["public_id"], "url": payload["secure_url"]}
