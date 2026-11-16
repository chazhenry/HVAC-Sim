"""First Principles videos: listing, signed streaming links, Range support and refusals."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path: Path, monkeypatch) -> TestClient:
    folder = tmp_path / "videos"
    folder.mkdir()
    (folder / "Refrigeration_cycle-basics.mp4").write_bytes(b"0123456789" * 10)
    (folder / "notes.txt").write_text("not a video")
    (tmp_path / "secret.mp4").write_bytes(b"outside")
    monkeypatch.setenv("HVAC_SIM_VIDEOS_DIR", str(folder))
    return TestClient(create_app(tmp_path / "test.db"))


def test_lists_only_videos_with_titles_and_signed_links(client):
    videos = client.get("/api/videos").json()
    assert [(v["name"], v["title"], v["sizeBytes"]) for v in videos] == [("Refrigeration_cycle-basics.mp4", "Refrigeration cycle basics", 100)]
    assert videos[0]["url"].startswith("/videos/file/Refrigeration_cycle-basics.mp4?exp=")


def test_signed_link_streams_and_supports_range(client):
    url = "/api" + client.get("/api/videos").json()[0]["url"]
    full = client.get(url)
    assert full.status_code == 200 and full.headers["content-type"] == "video/mp4" and len(full.content) == 100
    part = client.get(url, headers={"Range": "bytes=10-19"})
    assert part.status_code == 206 and part.content == b"0123456789"


def test_refuses_bad_signatures_other_files_and_missing_folder(client, monkeypatch, tmp_path):
    url = "/api" + client.get("/api/videos").json()[0]["url"]
    assert client.get(url[:-4] + "0000").status_code == 403
    exp = url.split("exp=")[1].split("&")[0]
    # A signature for one name never opens another file.
    assert client.get(f"/api/videos/file/secret.mp4?exp={exp}&sig={url.split('sig=')[1]}").status_code == 403
    assert client.get("/api/videos/file/x.mp4?exp=1&sig=abc").status_code == 403
    monkeypatch.setenv("HVAC_SIM_VIDEOS_DIR", str(tmp_path / "missing"))
    assert client.get("/api/videos").json() == []
