import { create } from 'zustand';

export const isPowerCommand = (text: string): boolean => text.trimStart().startsWith('/');

export const usePowerCommands = create<{
  listMode: boolean;
  execute: (text: string) => string;
}>()((set, get) => ({
  listMode: false,
  execute: (text) => {
    switch (text.trim().toLowerCase()) {
      case '/l': {
        const listMode = !get().listMode;
        set({ listMode });
        return `List mode ${listMode ? 'on' : 'off'}. ${listMode ? 'Hovered part names now follow the cursor.' : 'Cursor part labels hidden.'}`;
      }
      case '/':
        return 'Power commands: `/l` toggles list mode (part names beside the cursor).';
      default:
        return 'Unknown power command. Use `/l` to toggle list mode, or `/` to see available commands.';
    }
  },
}));
