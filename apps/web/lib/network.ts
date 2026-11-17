/**
 * Network classification and hotspot detection utilities for Orbit.
 */

export function isHotspotSubnet(ip?: string): boolean {
  if (!ip) return false;
  return (
    ip.startsWith('192.168.43.') || // Standard Android Hotspot
    ip.startsWith('172.20.10.') ||  // Standard Apple iPhone Hotspot
    ip.startsWith('192.168.137.')   // Windows Mobile Hotspot
  );
}

export function getNetworkBadge(ip?: string): {
  isHotspot: boolean;
  title: string;
  badge: string;
  description: string;
} {
  const isHotspot = isHotspotSubnet(ip);

  if (isHotspot) {
    return {
      isHotspot: true,
      title: 'Phone Hotspot Link Active',
      badge: '⚡ Hotspot Mode (~85+ MB/s)',
      description: 'Zero cellular data used • Direct Wi-Fi antenna saturation',
    };
  }

  return {
    isHotspot: false,
    title: 'Local Wi-Fi Network',
    badge: '⚡ Direct Wi-Fi LAN',
    description: 'High-throughput peer-to-peer transfer',
  };
}
