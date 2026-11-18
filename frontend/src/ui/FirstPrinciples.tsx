import { type ReactNode, useEffect, useRef, useState } from 'react';
import { api, apiUrl } from '../api/client';
import type { VideoInfo } from '../api/types';
import { useVideos } from '../store/useVideos';

const VideoIcon = (): ReactNode => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="5" width="14" height="14" rx="2" />
    <path d="M16.5 10l5-3v10l-5-3z" />
    <path d="M8 9.5v5l4-2.5z" fill="currentColor" />
  </svg>
);

/** Runtime as m:ss, or h:mm:ss for an hour or more, e.g. 6:32. */
export function runtime(seconds: number): string {
  const total = Math.round(seconds);
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** The video's runtime, read from its metadata; blank until it loads or if it cannot be read. */
function Runtime({ url }: { url: string }): ReactNode {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.muted = true;
    probe.onloadedmetadata = () => { if (Number.isFinite(probe.duration)) setSeconds(probe.duration); };
    probe.src = apiUrl(url);
    return () => { probe.onloadedmetadata = null; probe.removeAttribute('src'); probe.load(); };
  }, [url]);
  return <span className="video-list-size">{seconds === null ? '' : runtime(seconds)}</span>;
}

/** A modal <dialog>, opened on mount. Escape or the Close button calls onClose. */
function Modal({ className, labelId, onClose, children }: {
  className: string;
  labelId: string;
  onClose: () => void;
  children: ReactNode;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  // No close() in a cleanup: in development React runs effects twice, and closing would fire onClose.
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return (
    <dialog ref={dialog} className={`dialog ${className}`} aria-labelledby={labelId} onClose={onClose}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
      {children}
    </dialog>
  );
}

/** The video list: every video in docs/1stPrinciples, each with a video icon. */
function VideoMenu(): ReactNode {
  const { play, close } = useVideos.getState();
  const [videos, setVideos] = useState<VideoInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.videos().then((list) => { if (live) setVideos(list); })
      .catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : 'Could not load the videos.'); });
    return () => { live = false; };
  }, []);
  return (
    <Modal className="video-menu" labelId="video-menu-title" onClose={close}>
      <div className="video-menu-heading">
        <h2 id="video-menu-title">First Principles</h2>
        <button type="button" className="icon-button" aria-label="Close video list" onClick={close}>✕</button>
      </div>
      {!videos && !error && <p className="fine">Loading videos…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {videos?.length === 0 && <p className="fine">No videos yet. Add video files to docs/1stPrinciples.</p>}
      {videos && videos.length > 0 && (
        <ul className="video-list">
          {videos.map((video) => (
            <li key={video.name}>
              <button type="button" onClick={() => play(video)}>
                <span className="video-list-icon"><VideoIcon /></span>
                <span className="video-list-title">{video.title}</span>
                <Runtime url={video.url} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Modal player for the chosen video. Closing it stops playback. */
function VideoPlayer({ video }: { video: VideoInfo }): ReactNode {
  const { close, openMenu } = useVideos.getState();
  return (
    <Modal className="video-player" labelId="video-player-title" onClose={close}>
      <div className="video-menu-heading">
        <button type="button" className="ghost" onClick={openMenu}>‹ All videos</button>
        <h2 id="video-player-title">{video.title}</h2>
        <button type="button" className="icon-button" aria-label="Close video" onClick={close}>✕</button>
      </div>
      <video src={apiUrl(video.url)} controls autoPlay playsInline preload="metadata" />
    </Modal>
  );
}

/** The First Principles library, opened from its tile in the tool bag. */
export function FirstPrinciples(): ReactNode {
  const menu = useVideos((s) => s.menu);
  const playing = useVideos((s) => s.playing);
  if (playing) return <VideoPlayer key={playing.name} video={playing} />;
  return menu ? <VideoMenu /> : null;
}
