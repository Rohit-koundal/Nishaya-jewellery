from io import BytesIO
from unittest.mock import Mock

import pytest
from PIL import Image

from app.storage_client import StorageClient, StorageError, optimize_candidate


def test_candidate_is_bounded_webp_with_same_aspect_ratio(tmp_path):
    source = tmp_path / "large.png"
    Image.new("RGBA", (3200, 2400), (180, 40, 80, 120)).save(source)
    data = optimize_candidate(source)
    assert len(data) <= int(0.7 * 1024 * 1024)
    image = Image.open(BytesIO(data))
    assert image.format == "WEBP"
    assert image.size == (1600, 1200)
    assert image.mode == "RGBA"


def test_worker_uploads_optimized_bytes_not_original(tmp_path, monkeypatch):
    source = tmp_path / "large.png"
    Image.new("RGB", (3200, 2400), "white").save(source)
    client = StorageClient.__new__(StorageClient)
    client.provider = "r2"
    client.s3 = Mock()
    monkeypatch.setenv("R2_BUCKET_NAME", "isolated-test")
    monkeypatch.setenv("R2_PUBLIC_URL", "https://media.test")
    saved = client.upload_candidate(source, "job", 1, 2)
    sent = client.s3.put_object.call_args.kwargs
    assert sent["ContentType"] == "image/webp"
    assert len(sent["Body"]) <= int(0.7 * 1024 * 1024)
    assert saved["storageKey"].endswith(".webp")
    assert Image.open(BytesIO(sent["Body"])).format == "WEBP"
    client.s3.upload_file.assert_not_called()


def test_corrupt_candidate_never_reaches_storage(tmp_path):
    source = tmp_path / "bad.png"
    source.write_bytes(b"not an image")
    client = StorageClient.__new__(StorageClient)
    client.provider = "r2"
    client.s3 = Mock()
    with pytest.raises(StorageError):
        client.upload_candidate(source, "job", 1, 2)
    client.s3.put_object.assert_not_called()
