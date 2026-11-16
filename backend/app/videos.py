"""First Principles videos: the files in docs/1stPrinciples, listed for signed-in users and streamed to the player.

A <video> element cannot send the Bearer token, so the (authenticated) list hands out short-lived signed
links, and the file route checks that signature itself instead of the sign-in header. No token ever goes
into a URL.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import time
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from .models import ApiModel

DEFAULT_DIR = Path(__file__).resolve().parents[2] / "docs" / "1stPrinciples"
VIDEO_TYPES = {".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".ogv": "video/ogg"}
FILE_PREFIX = "/api/videos/file/"
LINK_SECONDS = 6 * 60 * 60


class VideoInfo(ApiModel):
    name: str
    title: str
    size_bytes: int
    # Path under the API base, e.g. /videos/file/Refrigeration.mp4?exp=...&sig=...
    url: str


def videos_dir() -> Path:
    return Path(os.environ.get("HVAC_SIM_VIDEOS_DIR", DEFAULT_DIR))


def title_for(name: str) -> str:
    """'Refrigeration_cycle-basics.mp4' -> 'Refrigeration cycle basics'."""
    return re.sub(r"\s+", " ", re.sub(r"[_-]+", " ", Path(name).stem)).strip()


def videos_router(secret: bytes | None = None) -> APIRouter:
    key = secret or secrets.token_bytes(32)
    router = APIRouter(prefix="/api/videos")

    def sign(name: str, expires: int) -> str:
        return hmac.new(key, f"{name}\n{expires}".encode(), hashlib.sha256).hexdigest()

    def find(name: str) -> Path | None:
        folder = videos_dir()
        if not folder.is_dir() or "/" in name or "\\" in name or name.startswith("."):
            return None
        path = folder / name
        return path if path.is_file() and path.suffix.lower() in VIDEO_TYPES else None

    @router.get("", response_model=list[VideoInfo])
    def list_videos() -> list[VideoInfo]:
        folder = videos_dir()
        if not folder.is_dir():
            return []
        expires = int(time.time()) + LINK_SECONDS
        return [
            VideoInfo(
                name=path.name,
                title=title_for(path.name),
                size_bytes=path.stat().st_size,
                url=f"/videos/file/{quote(path.name)}?exp={expires}&sig={sign(path.name, expires)}",
            )
            for path in sorted(folder.iterdir(), key=lambda p: p.name.lower())
            if path.is_file() and path.suffix.lower() in VIDEO_TYPES and not path.name.startswith(".")
        ]

    @router.get("/file/{name}")
    def video_file(name: str, exp: int = Query(...), sig: str = Query(..., max_length=64)) -> FileResponse:
        if exp < time.time() or not hmac.compare_digest(sig, sign(name, exp)):
            raise HTTPException(status_code=403, detail="This video link has expired. Reopen the video list.")
        path = find(name)
        if path is None:
            raise HTTPException(status_code=404, detail="Video not found")
        # FileResponse answers Range requests, so the player can seek without downloading the whole file.
        return FileResponse(path, media_type=VIDEO_TYPES[path.suffix.lower()], headers={"Cache-Control": "private, max-age=3600"})

    return router
