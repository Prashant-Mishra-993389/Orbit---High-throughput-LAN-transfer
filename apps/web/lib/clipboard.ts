/**
 * Robust clipboard utility that works in both secure contexts (HTTPS/localhost)
 * and non-secure contexts (LAN HTTP on mobile / Wi-Fi).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // Strategy 1: Modern Clipboard API (available in Secure Contexts: HTTPS & localhost)
  if (typeof window !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to legacy execCommand if permission denied
    }
  }

  // Strategy 2: Legacy execCommand('copy') with offscreen textarea (works on HTTP LAN)
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      // Prevent scrolling to bottom of screen
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.warn('Clipboard execCommand failed:', err);
      return false;
    }
  }

  return false;
}
