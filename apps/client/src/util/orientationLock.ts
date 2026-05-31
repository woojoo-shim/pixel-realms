/**
 * Best-effort landscape lock for mobile.
 *
 * Most browsers only allow `screen.orientation.lock()` while the page is
 * in fullscreen, and only when triggered from a user gesture. We attempt
 * both — request fullscreen first, then lock orientation. Either step can
 * silently fail (desktop, iOS Safari, denied permission) and that's fine:
 * the game still plays in whatever orientation the user holds.
 *
 * Call from a click/tap handler — not from arbitrary code.
 */
export async function tryLockLandscape(): Promise<void> {
  // Skip on non-touch / wide screens — landscape lock is only useful on
  // phones where the user holds the device upright.
  const isTouch =
    "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
  if (!isTouch) return;
  if (Math.max(window.innerWidth, window.innerHeight) > 950) return;

  const el = document.documentElement;
  type FsElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  const fsEl = el as FsElement;
  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (fsEl.webkitRequestFullscreen) {
        await fsEl.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen denied — orientation lock will likely also fail but try.
  }
  try {
    const orient = screen.orientation as ScreenOrientation & {
      lock?: (o: "landscape") => Promise<void>;
    };
    if (orient?.lock) {
      await orient.lock("landscape");
    }
  } catch {
    // iOS Safari + others reject this; harmless to ignore.
  }
}
