import { useEffect } from 'react';

/**
 * Acquire a Screen Wake Lock while `active` is true. Releases on cleanup or
 * when `active` flips false. Re-acquires after the page is brought back from
 * the background (the API auto-releases on visibility change).
 *
 * Silently no-ops when the API is unavailable (older browsers, non-HTTPS,
 * permission denied). Safe to call from any component.
 */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return;

    let sentinel = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          next.release().catch(() => {});
          return;
        }
        sentinel = next;
      } catch { /* ignore — denied, hidden tab, etc. */ }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, [active]);
}
