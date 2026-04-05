/**
 * useSpaceWarmup
 *
 * Pings the HuggingFace Space /api/health endpoint on mount.
 * - If the Space is already awake → resolves quickly, no banner shown.
 * - If the Space is starting up   → shows a "warming up" state until ready.
 *
 * Also keeps the Space warm while the tab is open by pinging every 4 minutes.
 */

import { useState, useEffect, useCallback } from 'react';
import { voiceAPI } from '@/services/api';

export type WarmupStatus = 'checking' | 'warming' | 'ready' | 'error';

export interface UseSpaceWarmupResult {
  status: WarmupStatus;
  /** Progress message to show in the UI */
  message: string;
  /** How many seconds the user has been waiting (while warming) */
  waitSeconds: number;
  /** Call this to manually retry after an error */
  retry: () => void;
}

const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 min — well under HF's 5-min sleep timer
const WARMUP_POLL_INTERVAL_MS = 5_000;        // poll every 5 s while starting up
const MAX_WARMUP_WAIT_MS = 3 * 60 * 1000;    // give up after 3 min

export function useSpaceWarmup(): UseSpaceWarmupResult {
  const [status, setStatus] = useState<WarmupStatus>('checking');
  const [message, setMessage] = useState('Connecting to server…');
  const [waitSeconds, setWaitSeconds] = useState(0);

  const ping = useCallback(async (): Promise<boolean> => {
    try {
      const health = await voiceAPI.healthCheck();
      return health.models_loaded === true;
    } catch {
      return false;
    }
  }, []);

  const warmUp = useCallback(async () => {
    setStatus('checking');
    setMessage('Connecting to server…');
    setWaitSeconds(0);

    // First ping — fast path if already awake
    const alreadyAwake = await ping();
    if (alreadyAwake) {
      setStatus('ready');
      setMessage('Server is ready.');
      return;
    }

    // Space is sleeping / starting up
    setStatus('warming');
    setMessage('The AI server is waking up — this takes about 30–60 seconds…');

    const started = Date.now();
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed = Math.floor((Date.now() - started) / 1000);
      setWaitSeconds(elapsed);

      if (elapsed > 60) {
        setMessage('Still starting up… almost there, hang tight!');
      }
      if (elapsed > 90) {
        setMessage('Taking a little longer than usual — thanks for your patience!');
      }
    }, 1000);

    const poller = setInterval(async () => {
      if (Date.now() - started > MAX_WARMUP_WAIT_MS) {
        clearInterval(poller);
        clearInterval(timer);
        setStatus('error');
        setMessage('Server took too long to start. Please refresh the page to try again.');
        return;
      }

      const ready = await ping();
      if (ready) {
        clearInterval(poller);
        clearInterval(timer);
        setStatus('ready');
        setMessage('Server is ready!');
      }
    }, WARMUP_POLL_INTERVAL_MS);

    // Cleanup if component unmounts mid-warmup
    return () => {
      clearInterval(poller);
      clearInterval(timer);
    };
  }, [ping]);

  // Run warmup on mount
  useEffect(() => {
    const cleanup = warmUp();
    return () => {
      cleanup?.then(fn => fn?.());
    };
  }, [warmUp]);

  // Keep-alive ping while the tab stays open
  useEffect(() => {
    if (status !== 'ready') return;
    const keepalive = setInterval(() => {
      ping(); // fire-and-forget
    }, KEEPALIVE_INTERVAL_MS);
    return () => clearInterval(keepalive);
  }, [status, ping]);

  return { status, message, waitSeconds, retry: warmUp };
}
