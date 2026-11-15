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
  if (!clientName) {
    const isMac = navigator.userAgent.includes('Mac');
    const isWindows = navigator.userAgent.includes('Windows');
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const osType = isMobile ? 'Phone' : isMac ? 'Mac' : isWindows ? 'Laptop' : 'Device';
    clientName = `${osType}-${clientId.substring(7, 11).toUpperCase()}`;
    localStorage.setItem(STORAGE_KEY_NAME, clientName);
  }

  return { clientId, clientName };
}

export function setClientName(newName: string): void {
  if (typeof window !== 'undefined' && newName.trim()) {
    localStorage.setItem(STORAGE_KEY_NAME, newName.trim());
  }
}
