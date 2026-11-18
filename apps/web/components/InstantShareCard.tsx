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
  offer?: TransferOffer | null;
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
  // Construct direct link including the specific offerId if available
  const directOfferUrl = offer
    ? `${sharingUrl}${sharingUrl.includes('?') ? '&' : '?'}offerId=${offer.transferId}`
    : sharingUrl;

  // Filter out the sender itself from nearby devices
  const availableDevices = nearbyDevices.filter(
    (d) => !offer || (d.deviceId !== offer.senderClientId && d.deviceId !== offer.senderDeviceId)
  );

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* File Showcase Hero Banner */}
      <div className="p-5 rounded-xl bg-obsidian-card border border-white/[0.08] shadow-xl relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-obsidian-base border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <FileIcon fileName={file.name} mimeType={file.type} className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-white/[0.05] text-zinc-300 border border-white/[0.08]">
                  <span>{file.name.endsWith('.tar') ? 'Folder Bundle' : 'Ready to Stream'}</span>
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {formatBytes(file.size)}
                </span>
              </div>
              <h3 className="text-base font-semibold text-zinc-100 truncate max-w-sm mt-0.5" title={file.name}>
                {file.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-all flex-shrink-0"
            title="Cancel & Choose Another File"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live waiting status */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-medium text-zinc-300">
              Waiting for receiver to connect...
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 hidden sm:inline font-mono">
            Direct live pipe • 0 cloud bytes
          </span>
        </div>
      </div>

      {/* Direct Send to Discovered Nearby Laptops (PRIMARY FOR LAPTOPS) */}
      {availableDevices.length > 0 && (
        <div className="p-4 rounded-xl bg-obsidian-card border border-white/[0.08] space-y-3 shadow-lg">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-200">
              <Laptop className="w-4 h-4 text-zinc-400" />
              <span>Send Directly to Discovered Device</span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              {availableDevices.length} online
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableDevices.map((device) => {
              const isPaired = pairedDevice?.deviceId === device.deviceId;
              return (
                <button
                  key={device.deviceId}
                  onClick={() => onSendToDevice(device)}
                  className={`p-3 rounded-lg border text-left transition-all duration-150 flex items-center justify-between group active:scale-[0.98] ${
                    isPaired
                      ? 'bg-white/[0.08] border-white/30 text-white'
                      : 'bg-obsidian-hover border-white/[0.06] hover:border-white/20 text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className="w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 group-hover:text-white flex-shrink-0">
                      <Laptop className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-white">
                        {device.deviceName}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-500">
                        {device.ip}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded bg-white/[0.08] hover:bg-white text-zinc-200 hover:text-zinc-950 text-xs font-medium flex items-center space-x-1.5 transition-all flex-shrink-0 border border-white/[0.08]">
                    <Send className="w-3 h-3" />
                    <span>Send</span>
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
        subtitle="Point phone camera to stream directly into browser"
        size={180}
        showCopy={true}
      />
    </div>
  );
}
