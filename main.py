import asyncio
import os
import uuid
from pathlib import Path

import yt_dlp
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = Path("/tmp/tiktok_downloads")
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


class DownloadRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {"status": "ok"}


def _download_video(url: str, output_template: str) -> None:
    ydl_opts = {
        # Prefer highest resolution: H.265 > H.264, HDR preferred, then best available
        "format": (
            "bestvideo[dynamic_range=HDR][vcodec^=hvc1]+bestaudio"
            "/bestvideo[dynamic_range=HDR][vcodec^=avc1]+bestaudio"
            "/bestvideo[vcodec^=hvc1]+bestaudio"
            "/bestvideo[vcodec^=avc1]+bestaudio"
            "/bestvideo+bestaudio"
            "/best"
        ),
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        # Prefer no-watermark formats on TikTok (yt-dlp filters these by format_id)
        "format_sort": ["res", "fps", "hdr:12", "codec:h265:h264", "size", "br"],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.extract_info(url, download=True)


@app.post("/download")
async def download(request: DownloadRequest, background_tasks: BackgroundTasks):
    video_id = str(uuid.uuid4())
    output_template = str(DOWNLOAD_DIR / f"{video_id}.%(ext)s")

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _download_video, request.url, output_template)
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")

    downloaded_files = list(DOWNLOAD_DIR.glob(f"{video_id}.*"))
    if not downloaded_files:
        raise HTTPException(status_code=500, detail="File not found after download")

    file_path = downloaded_files[0]

    def cleanup():
        try:
            file_path.unlink(missing_ok=True)
        except Exception:
            pass

    background_tasks.add_task(cleanup)

    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename="video.mp4",
    )
