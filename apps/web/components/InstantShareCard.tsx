'use client';

import React from 'react';
import { formatBytes } from '@sharelan/shared';
import { DeviceInfo, TransferOffer } from '@sharelan/protocol';
import { FileIcon } from './FileIcon';
import { QrCodeCard } from './QrCodeCard';
import {
  Laptop,
  Smartphone,
  Send,
  X,
  Zap,
  Loader2,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface InstantShareCardProps {
  file: File;
  offer: TransferOffer;
  sharingUrl: string;
  nearbyDevices: DeviceInfo[];
  pairedDevice: DeviceInfo | null;
  onSendToDevice: (device: DeviceInfo) => void;
  onCancel: () => void;
}

export function InstantShareCard({
  file,
  offer,
  sharingUrl,
  nearbyDevices,
  pairedDevice,
  onSendToDevice,
  onCancel,
}: InstantShareCardProps) {
  // Construct direct link including the specific offerId
  const directOfferUrl = `${sharingUrl}${sharingUrl.includes('?') ? '&' : '?'}offerId=${offer.transferId}`;

  // Filter out the sender itself from nearby devices
  const availableDevices = nearbyDevices.filter(
    (d) => d.deviceId !== offer.senderClientId && d.deviceId !== offer.senderDeviceId
  );

  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* File Showcase Hero Banner */}
      <div className="p-6 rounded-3xl bg-obsidian-card/95 border border-white/[0.08] shadow-2xl relative overflow-hidden backdrop-blur-2xl">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-obsidian-base border border-white/[0.08] flex items-center justify-center flex-shrink-0 shadow-inner">
              <FileIcon fileName={file.name} mimeType={file.type} className="w-8 h-8" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  <Sparkles className="w-3 h-3" />
                  <span>{file.name.endsWith('.tar') ? 'Folder Bundle' : 'Ready to Stream'}</span>
                </span>
                <span className="text-xs font-mono text-warm-sand">
                  {formatBytes(file.size)}
                </span>
              </div>
              <h3 className="text-lg font-bold text-warm-bone truncate max-w-sm mt-0.5" title={file.name}>
                {file.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-warm-sand hover:text-warm-bone transition-all flex-shrink-0"
            title="Cancel & Choose Another File"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live waiting pulse */}
        <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between text-xs text-warm-sand">
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span className="font-medium text-warm-bone">
              Waiting for receiver to connect...
            </span>
          </div>
          <span className="text-[11px] text-warm-stone hidden sm:inline">
            Zero duplicate copies stored on disk
          </span>
        </div>
      </div>

      {/* Direct Send to Discovered Nearby Laptops (PRIMARY FOR LAPTOPS) */}
      {availableDevices.length > 0 && (
        <div className="p-5 rounded-3xl bg-obsidian-card/95 border border-cyan-500/20 space-y-3.5 shadow-xl">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2 text-xs font-bold text-warm-bone uppercase tracking-wider">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Beam Directly to Nearby Device (1-Click)</span>
            </div>
            <span className="text-[11px] text-cyan-300 font-mono">
              {availableDevices.length} online
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {availableDevices.map((device) => {
              const isPaired = pairedDevice?.deviceId === device.deviceId;
              return (
                <button
                  key={device.deviceId}
                  onClick={() => onSendToDevice(device)}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group active:scale-[0.98] ${
                    isPaired
                      ? 'bg-cyan-500/15 border-cyan-500/40 hover:bg-cyan-500/25 shadow-md'
                      : 'bg-obsidian-hover/70 border-white/[0.06] hover:border-cyan-500/40 hover:bg-obsidian-hover'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-warm-bone truncate group-hover:text-white">
                        {device.deviceName}
                      </p>
                      <p className="text-[10px] font-mono text-warm-sand">
                        {device.ip}
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center space-x-1.5 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all flex-shrink-0 shadow-sm">
                    <Send className="w-3.5 h-3.5" />
                    <span>Beam</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* QR Code Presentation (Secondary for Phones) */}
      <QrCodeCard
        url={directOfferUrl}
        title="Mobile Phone Link"
        subtitle="Point your phone camera to download directly into phone browser"
        size={200}
        showCopy={true}
      />
    </div>
  );
}
