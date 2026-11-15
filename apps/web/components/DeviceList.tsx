import React, { useState } from 'react';
import { DeviceInfo } from '@sharelan/protocol';
import { Laptop, RefreshCw, Check, KeyRound, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { joinPairingSession } from '../lib/api';

interface DeviceListProps {
  devices: DeviceInfo[];
  selectedDevice: DeviceInfo | null;
  clientId: string;
  clientName: string;
  onSelectDevice: (device: DeviceInfo | null) => void;
  onRefresh: () => void;
  onOpenPairing: (tab?: 'create' | 'join') => void;
  onDevicePaired: (device: DeviceInfo) => void;
}

export const DeviceList: React.FC<DeviceListProps> = ({
  devices,
  selectedDevice,
  clientId,
  clientName,
  onSelectDevice,
  onRefresh,
  onOpenPairing,
  onDevicePaired,
}) => {
  const [inlineCode, setInlineCode] = useState('');
  const [isJoiningInline, setIsJoiningInline] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const handleInlineJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inlineCode.trim();
    if (!cleanCode) return;

    setIsJoiningInline(true);
    setInlineError(null);

    try {
      const res = await joinPairingSession(cleanCode, clientId, clientName);
      if (res.success && res.session) {
        onDevicePaired({
          deviceId: res.session.hostClientId,
          deviceName: res.session.hostDeviceName,
          ip: res.session.hostIp,
          port: res.session.hostPort,
          os: 'Desktop',
          protocolVersion: '1.0.0',
          capabilities: {
            protocolVersion: '1.0.0',
            transports: ['http-stream', 'relay'],
            hashAlgorithms: ['sha256'],
            resumable: true,
            maxChunkSize: 64 * 1024 * 1024,
          },
          pairingState: 'PAIRED',
          lastSeen: Date.now(),
        });
        setInlineCode('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired code';
      setInlineError(msg);
    } finally {
      setIsJoiningInline(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with clear action buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">
          Nearby Devices
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onOpenPairing('join')}
            className="text-xs text-white bg-blue-600 hover:bg-blue-500 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all font-semibold shadow-md shadow-blue-500/20 active:scale-95"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Enter 6-Digit Code</span>
          </button>
          <button
            onClick={() => onOpenPairing('create')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all font-medium"
          >
            <span>Show My Code</span>
          </button>
          <button
            onClick={onRefresh}
            className="text-xs text-slate-400 hover:text-cyan-400 flex items-center space-x-1 transition-colors p-1.5 rounded-lg hover:bg-white/5"
            title="Refresh device discovery"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="p-5 rounded-2xl bg-surface-50/90 border border-white/10 text-center space-y-3.5 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center justify-center space-x-1.5 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hostel Wi-Fi AP Isolation Detected</span>
            </div>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              Router drops direct device packets. Enter the 6-digit code shown on the other laptop to pair instantly:
            </p>
          </div>

          {/* Prominent Direct Inline Code Entry */}
          <form onSubmit={handleInlineJoin} className="flex items-center justify-center space-x-2 max-w-xs mx-auto">
            <input
              type="text"
              value={inlineCode}
              onChange={(e) => setInlineCode(e.target.value)}
              placeholder="e.g. 482-195"
              maxLength={7}
              className="w-36 px-3 py-2 rounded-xl bg-surface-200 border border-white/10 text-white placeholder-slate-500 font-mono text-center text-sm font-semibold tracking-wider focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
            />
            <button
              type="submit"
              disabled={isJoiningInline || !inlineCode.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs transition-all flex items-center space-x-1 shadow-md shadow-cyan-500/25 active:scale-95 disabled:opacity-50"
            >
              {isJoiningInline ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Connect</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {inlineError && (
            <p className="text-[11px] text-rose-400 font-medium bg-rose-500/10 py-1 px-2.5 rounded-lg inline-block border border-rose-500/20">
              {inlineError}
            </p>
          )}

          <div className="pt-2 border-t border-white/5 flex items-center justify-center space-x-2 text-xs">
            <span className="text-slate-400">Receiving a file instead?</span>
            <button
              type="button"
              onClick={() => onOpenPairing('create')}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2"
            >
              Show My 6-Digit Code
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-3 overflow-x-auto pb-2 pt-1 scrollbar-none">
          {devices.map((device) => {
            const isSelected = selectedDevice?.deviceId === device.deviceId;
            return (
              <button
                key={device.deviceId}
                onClick={() => onSelectDevice(isSelected ? null : device)}
                className={`flex-shrink-0 flex items-center space-x-3 p-3 rounded-2xl border transition-all text-left ${
                  isSelected
                    ? 'bg-blue-600/20 border-cyan-400 shadow-lg shadow-cyan-500/10'
                    : 'bg-surface-50 border-white/5 hover:border-white/20 hover:bg-surface-100'
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-surface-200 border border-white/10 flex items-center justify-center">
                    <Laptop className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                </div>

                <div className="pr-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                      {device.deviceName}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                  </div>
                  <span className="text-[11px] text-emerald-400 block font-medium">Ready</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
