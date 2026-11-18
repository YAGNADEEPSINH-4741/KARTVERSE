// ============================================================================
// KARTVERSE — Mobile & Tablet Device Detection & Screen Auto-Rotation
// Detects iOS/Android Touch Devices & Enforces Ergonomic Landscape Racing
// ============================================================================

export function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. User-Agent Pattern Matching (Phones, Phablets & Tablets)
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Silk/i.test(ua);

  // 2. iPadOS Safari desktop mode spoofing detection (iPad on iOS 13+ reports Macintosh)
  const isIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  // 3. Pointer & Media Capabilities check
  const hasTouchCapability = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isSmallScreen = window.innerWidth <= 1024 || window.innerHeight <= 600;

  return isMobileUA || isIPad || (hasTouchCapability && isSmallScreen);
}

/**
 * Request Fullscreen & Screen Orientation Lock to Landscape
 */
export async function requestLandscapeOrientation(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Attempt Fullscreen Request (Often required before orientation lock on mobile browsers)
  try {
    const elem = document.documentElement as any;
    if (elem.requestFullscreen && !document.fullscreenElement) {
      await elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen && !(document as any).webkitFullscreenElement) {
      await elem.webkitRequestFullscreen();
    }
  } catch (err) {
    // Non-blocking if blocked by browser policy without user gesture
  }

  // 2. Attempt Screen Orientation API Lock
  try {
    const orientation = window.screen?.orientation as any;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
    }
  } catch (err) {
    // Non-blocking if orientation lock is unsupported or restricted
  }
}
