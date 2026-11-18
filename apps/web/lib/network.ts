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

/**
 * Detects campus enterprise / hostel networks (e.g. LPU Hostels, 10.x.x.x / 172.16.x.x subnets)
 * where Client / AP-Isolation is enforced by Aruba / Fortinet gateways.
 */
export function isCampusOrIsolatedSubnet(ip?: string): boolean {
  if (!ip) return false;
  if (isHotspotSubnet(ip)) return false;
  return ip.startsWith('10.') || (ip.startsWith('172.') && !ip.startsWith('172.20.10.'));
}

export function getNetworkBadge(ip?: string): {
  isHotspot: boolean;
  isCampus: boolean;
  title: string;
  badge: string;
  description: string;
} {
  const isHotspot = isHotspotSubnet(ip);
  const isCampus = isCampusOrIsolatedSubnet(ip);

  if (isHotspot) {
    return {
      isHotspot: true,
      isCampus: false,
      title: 'Phone Hotspot Link Active',
      badge: '⚡ Hotspot Mode (~85+ MB/s)',
      description: 'Zero cellular data used • Direct Wi-Fi antenna saturation',
    };
  }

  if (isCampus) {
    return {
      isHotspot: false,
      isCampus: true,
      title: 'LPU / Campus Wi-Fi Network',
      badge: '🎓 LPU Wi-Fi (AP-Isolation Active)',
      description: 'Peers isolated by router • Use 6-Digit Code or Hotspot Beam',
    };
  }

  return {
    isHotspot: false,
    isCampus: false,
    title: 'Local Wi-Fi Network',
    badge: '⚡ Direct Wi-Fi LAN',
    description: 'High-throughput peer-to-peer transfer',
  };
}
