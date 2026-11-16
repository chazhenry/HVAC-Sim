import { create } from 'zustand';
import type { VideoInfo } from '../api/types';

/** The First Principles video library: whether its list is open and which video is playing. */
interface VideosState {
  menu: boolean;
  playing: VideoInfo | null;
  openMenu: () => void;
  play: (video: VideoInfo) => void;
  close: () => void;
}

export const useVideos = create<VideosState>((set) => ({
  menu: false,
  playing: null,
  openMenu: () => set({ menu: true, playing: null }),
  play: (video) => set({ menu: false, playing: video }),
  close: () => set({ menu: false, playing: null }),
}));
