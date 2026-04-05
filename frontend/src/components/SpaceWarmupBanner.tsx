/**
 * SpaceWarmupBanner
 *
 * Shows a non-intrusive banner at the top of the page while the
 * HuggingFace Space is starting up. Disappears automatically when ready.
 */

import React from 'react';
import { useSpaceWarmup, WarmupStatus } from '@/hooks/useSpaceWarmup';

function statusIcon(status: WarmupStatus): string {
  switch (status) {
    case 'checking': return '🔄';
    case 'warming':  return '☕';
    case 'ready':    return '✅';
    case 'error':    return '⚠️';
  }
}

function bannerColor(status: WarmupStatus): string {
  switch (status) {
    case 'checking': return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'warming':  return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'ready':    return 'bg-green-50 border-green-200 text-green-800';
    case 'error':    return 'bg-red-50 border-red-200 text-red-800';
  }
}

export function SpaceWarmupBanner() {
  const { status, message, waitSeconds, retry } = useSpaceWarmup();

  // Hide banner once ready (after a brief 2-second "ready" flash)
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    if (status === 'ready') {
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    }
    setVisible(true);
  }, [status]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 border-b px-4 py-2 flex items-center justify-between text-sm transition-all ${bannerColor(status)}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-2">
        <span>{statusIcon(status)}</span>
        <span>{message}</span>
        {status === 'warming' && waitSeconds > 0 && (
          <span className="opacity-60">({waitSeconds}s)</span>
        )}
      </span>

      {status === 'error' && (
        <button
          onClick={retry}
          className="ml-4 underline font-medium hover:opacity-80"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default SpaceWarmupBanner;
