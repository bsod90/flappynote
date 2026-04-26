/**
 * Tiny wrapper over Google Analytics' `gtag`. Safe to call before GA loads
 * (no-ops). All events go through here so adding/changing instrumentation
 * is a single-file change.
 */

function gtag(...args) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag(...args);
  } catch (err) {
    console.warn('analytics: gtag call failed', err);
  }
}

export function trackPageView(path) {
  gtag('event', 'page_view', { page_path: path });
}

export function trackEvent(name, params = {}) {
  gtag('event', name, params);
}
