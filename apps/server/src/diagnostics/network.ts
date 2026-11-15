import os from 'node:os';
import { NetworkDiagnostics, NetworkInterfaceInfo } from '@sharelan/protocol';

export function getNetworkDiagnostics(port: number, publicTunnelUrl?: string | null): NetworkDiagnostics {
  const interfaces = os.networkInterfaces();
  const validInterfaces: NetworkInterfaceInfo[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    for (const addr of addrs) {
      // We focus on IPv4 for LAN transfers initially
      if (addr.family === 'IPv4') {
        const isLoopback = addr.internal || addr.address.startsWith('127.');
        const isLinkLocal = addr.address.startsWith('169.254.');
        const isVirtual =
          name.toLowerCase().includes('vethernet') ||
          name.toLowerCase().includes('wsl') ||
          name.toLowerCase().includes('docker') ||
          name.toLowerCase().includes('virtual') ||
          name.toLowerCase().includes('vmnet');

        if (!isLoopback && !isLinkLocal) {
          validInterfaces.push({
            name,
            address: addr.address,
            netmask: addr.netmask,
            family: 'IPv4',
            mac: addr.mac,
            internal: addr.internal,
            isPreferred: !isVirtual && (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('eth') || name.toLowerCase().includes('en')),
          });
        }
      }
    }
  }

  // Sort interfaces: preferred real interfaces first (Wi-Fi, Ethernet), then others
  validInterfaces.sort((a, b) => {
    if (a.isPreferred && !b.isPreferred) return -1;
    if (!a.isPreferred && b.isPreferred) return 1;
    return 0;
  });

  const selected = validInterfaces[0] || null;
  const localIp = selected ? selected.address : '127.0.0.1';

  return {
    selectedInterface: selected,
    interfaces: validInterfaces,
    localIp,
    port,
    directLanStatus: 'AVAILABLE',
    publicTunnelUrl: publicTunnelUrl || undefined,
  };
}
