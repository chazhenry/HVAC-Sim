import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { ChatResponse } from '../api/types';
import { useChat } from './useChat';
import { isPowerCommand, usePowerCommands } from './usePowerCommands';
import { useSim } from './useSim';

beforeEach(() => {
  vi.restoreAllMocks();
  useSim.setState({ sessionId: 'test-job', phase: 'running', sim: null, furnace: null });
  useChat.setState({ sessionId: null, messages: [], pending: false, prompts: [] });
  usePowerCommands.setState({ listMode: false });
});

describe('power commands', () => {
  it('recognizes slash-prefixed entries and toggles list mode locally', async () => {
    const chat = vi.spyOn(api, 'chat');
    expect(isPowerCommand('  /l')).toBe(true);
    expect(isPowerCommand('What is /l?')).toBe(false);
    await useChat.getState().send(' /l ');
    expect(usePowerCommands.getState().listMode).toBe(true);
    expect(useChat.getState().messages).toHaveLength(2);
    expect(useChat.getState().messages.every((message) => message.kind === 'power_command')).toBe(true);
    expect(useChat.getState().messages.at(-1)?.content).toContain('List mode on');
    await useChat.getState().send('/l');
    expect(usePowerCommands.getState().listMode).toBe(false);
    expect(useChat.getState().messages.at(-1)?.content).toContain('List mode off');
    expect(chat).not.toHaveBeenCalled();
  });

  it('handles help and unknown commands without contacting the tutor', async () => {
    const chat = vi.spyOn(api, 'chat');
    await useChat.getState().send('/');
    expect(useChat.getState().messages.at(-1)?.content).toContain('Power commands:');
    await useChat.getState().send('/unknown');
    expect(useChat.getState().messages.at(-1)?.content).toContain('Unknown power command');
    expect(usePowerCommands.getState().listMode).toBe(false);
    expect(chat).not.toHaveBeenCalled();
  });

  it('keeps commands and local replies out of tutor conversation history', async () => {
    const chat = vi.spyOn(api, 'chat').mockResolvedValue({ reply: 'Tutor reply', provider: 'test' });
    await useChat.getState().send('/l');
    await useChat.getState().send('Check the reading.');
    expect(chat).toHaveBeenCalledWith('test-job', expect.objectContaining({ message: 'Check the reading.', history: [] }));
    await useChat.getState().send('/l');
    await useChat.getState().send('What next?');
    expect(chat).toHaveBeenLastCalledWith('test-job', expect.objectContaining({ history: [
      { role: 'user', content: 'Check the reading.' }, { role: 'assistant', content: 'Tutor reply' },
    ] }));
  });

  it('runs a command during a pending reply without losing either response', async () => {
    let resolve!: (response: ChatResponse) => void;
    const chat = vi.spyOn(api, 'chat').mockImplementation(() => new Promise((done) => { resolve = done; }));
    const sending = useChat.getState().send('Check the reading.');
    expect(useChat.getState().pending).toBe(true);
    await useChat.getState().send('/l');
    expect(usePowerCommands.getState().listMode).toBe(true);
    expect(useChat.getState().pending).toBe(true);
    resolve({ reply: 'Tutor reply', provider: 'test' });
    await sending;
    expect(useChat.getState().pending).toBe(false);
    expect(useChat.getState().messages).toHaveLength(4);
    expect(useChat.getState().messages.at(-1)?.content).toBe('Tutor reply');
    expect(chat).toHaveBeenCalledTimes(1);
  });
});
