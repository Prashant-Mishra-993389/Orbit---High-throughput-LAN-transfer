/**
 * Screen WakeLock manager to prevent mobile devices (iOS/Android) and laptops
 * from sleeping, dimming, or throttling network interfaces during active file streaming.
 */
let wakeLockSentinel: any = null;
let isLockRequested = false;

export async function acquireWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  isLockRequested = true;

  if ('wakeLock' in navigator) {
    try {
      if (wakeLockSentinel && !wakeLockSentinel.released) {
        return true;
      }
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch (err: any) {
      console.warn('Screen WakeLock request failed (expected on low battery or background tabs):', err.message);
      return false;
    }
  }
  return false;
}

export async function releaseWakeLock(): Promise<void> {
  isLockRequested = false;
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore release errors
    } finally {
      wakeLockSentinel = null;
    }
  }
}

// Auto-reacquire when tab becomes visible again if a transfer is still ongoing
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (isLockRequested && document.visibilityState === 'visible') {
      await acquireWakeLock();
    }
  });
}
