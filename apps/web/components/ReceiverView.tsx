'use client';

import React from 'react';
import { TransferOffer } from '@sharelan/protocol';
import { formatBytes } from '@sharelan/shared';
import { FileIcon } from './FileIcon';
import {
  DownloadCloud,
  X,
  Laptop,
  Download,
  Zap,
  FolderDown,
  RotateCcw,
} from 'lucide-react';

interface ReceiverViewProps {
  offer: TransferOffer;
  onAccept: (offer: TransferOffer) => void;
  onReject: (offer: TransferOffer) => void;
  onSwitchToSender?: () => void;
}

export function ReceiverView({
  offer,
  onAccept,
  onReject,
  onSwitchToSender,
}: ReceiverViewProps) {
  return (
    <div className="w-full max-w-sm mx-auto p-6 rounded-xl bg-obsidian-card border border-white/[0.08] shadow-2xl space-y-5 text-center animate-fade-in relative overflow-hidden">
      {/* File Icon Hero */}
      <div className="relative mx-auto w-16 h-16 rounded-xl bg-obsidian-base border border-white/[0.08] flex items-center justify-center shadow-md">
        <FileIcon fileName={offer.fileName} mimeType={offer.mimeType} className="w-8 h-8" />
        <span className="absolute -bottom-1 -right-1 p-1 rounded-md bg-white text-zinc-950 shadow-sm">
          <DownloadCloud className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Sender details & file title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-center space-x-1.5 text-xs text-zinc-400 font-medium">
          <Laptop className="w-3.5 h-3.5 text-zinc-500" />
          <span>{offer.senderDeviceName || 'Nearby Device'} wants to send:</span>
        </div>
        <h2
          className="text-base font-semibold text-zinc-100 tracking-tight truncate px-2"
          title={offer.fileName}
        >
          {offer.fileName}
        </h2>
        <div className="flex items-center justify-center space-x-2 pt-0.5">
          <span className="px-2 py-0.5 rounded text-xs font-mono font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.06]">
            {formatBytes(offer.fileSize)}
          </span>
          {offer.fileName.endsWith('.tar') && (
            <span className="px-2 py-0.5 rounded text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.06]">
              Folder Archive
            </span>
          )}
          {offer.transportMode === 'RELAY_STREAM' ? (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06]">
              Relay Stream
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center space-x-1">
              <Zap className="w-2.5 h-2.5" />
              <span>Direct Link</span>
            </span>
          )}
        </div>
      </div>

      {/* Save destination note */}
      <div className="py-2 px-3 rounded-lg bg-obsidian-base border border-white/[0.06] text-xs flex items-center justify-center space-x-2 text-zinc-400">
        <FolderDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span>Saves directly to your default <strong>Downloads</strong> folder</span>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={() => onAccept(offer)}
          className="w-full py-2.5 px-4 rounded-lg font-medium text-xs bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Accept & Save to Downloads</span>
        </button>

        <button
          type="button"
          onClick={() => onReject(offer)}
          className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center space-x-1"
        >
          <X className="w-3 h-3" />
          <span>Decline</span>
        </button>
      </div>

      {/* Switch to send back */}
      {onSwitchToSender && (
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            onClick={onSwitchToSender}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center space-x-1 mx-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Send a file instead</span>
          </button>
        </div>
      )}
    </div>
  );
}
