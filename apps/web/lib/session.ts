/**
 * Client-Session Identity & Persistence
 * Ensures each browser window / device has a distinct identity,
 * preventing a sender from accepting their own transfer.
 */

const STORAGE_KEY_ID = 'sharelan_client_id';
const STORAGE_KEY_NAME = 'sharelan_client_name';

export interface ClientSession {
  clientId: string;
  clientName: string;
}

export function getClientSession(): ClientSession {
  if (typeof window === 'undefined') {
    return { clientId: 'server-side', clientName: 'Desktop' };
  }

  let clientId = localStorage.getItem(STORAGE_KEY_ID);
  if (!clientId) {
    clientId = 'client-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(STORAGE_KEY_ID, clientId);
  }

  let clientName = localStorage.getItem(STORAGE_KEY_NAME);
  if (!clientName || clientName.startsWith('Laptop-') || clientName.startsWith('Desktop-')) {
    // 1. If running in Electron desktop, auto-detect actual user name (e.g. "Prashant's Laptop")
    if ((window as any).electronAPI?.getDeviceName) {
      try {
        const nativeName = (window as any).electronAPI.getDeviceName();
        if (typeof nativeName === 'string' && nativeName.trim().length > 0) {
          const finalName = nativeName.trim();
          localStorage.setItem(STORAGE_KEY_NAME, finalName);
          return { clientId, clientName: finalName };
        }
      } catch {}
    }

    // 2. Browser fallback: friendly OS-based device naming
    const isMac = navigator.userAgent.includes('Mac');
    const isWindows = navigator.userAgent.includes('Windows');
    const isAndroid = navigator.userAgent.includes('Android');
    const isIPhone = /iPhone|iPad/i.test(navigator.userAgent);

    const friendlyName = isIPhone
      ? 'iPhone'
      : isAndroid
      ? 'Android Phone'
      : isMac
      ? 'MacBook'
      : isWindows
      ? 'Windows Laptop'
      : 'Nearby Laptop';

    clientName = friendlyName;
    localStorage.setItem(STORAGE_KEY_NAME, clientName);
  }

  return { clientId, clientName: clientName || 'Nearby Laptop' };
}

export function setClientName(newName: string): void {
  if (typeof window !== 'undefined' && newName.trim()) {
    localStorage.setItem(STORAGE_KEY_NAME, newName.trim());
  }
}
