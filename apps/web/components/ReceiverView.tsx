'use client';

import React, { useState, useEffect } from 'react';
import { TransferOffer } from '@sharelan/protocol';
import { formatBytes } from '@sharelan/shared';
import { FileIcon } from './FileIcon';
import {
  DownloadCloud,
  Check,
  X,
  Laptop,
  FolderDown,
  Download,
  Zap,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface ReceiverViewProps {
  offer: TransferOffer;
  onAccept: (offer: TransferOffer, fileHandle?: any) => void;
  onReject: (offer: TransferOffer) => void;
  onSwitchToSender?: () => void;
}

export function ReceiverView({
  offer,
  onAccept,
  onReject,
  onSwitchToSender,
}: ReceiverViewProps) {
  const [hasSavePicker, setHasSavePicker] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'showSaveFilePicker' in window &&
      window.isSecureContext
    ) {
      setHasSavePicker(true);
    }
  }, []);

  const handlePickLocationAndAccept = async () => {
    try {
      setIsPickingLocation(true);
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: offer.fileName,
      });
      setIsPickingLocation(false);
      onAccept(offer, handle);
    } catch (err: any) {
      setIsPickingLocation(false);
      if (err.name !== 'AbortError') {
        console.warn('File picker error:', err);
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-obsidian-card/95 border border-white/[0.08] shadow-2xl space-y-6 text-center animate-fade-in relative overflow-hidden backdrop-blur-2xl">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* File Icon Hero */}
      <div className="relative mx-auto w-24 h-24 rounded-3xl bg-obsidian-base border border-white/[0.08] flex items-center justify-center shadow-xl shadow-cyan-500/5 group">
        <FileIcon fileName={offer.fileName} mimeType={offer.mimeType} className="w-12 h-12" />
        <span className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-emerald-500 text-slate-950 shadow-md">
          <DownloadCloud className="w-4 h-4 font-bold" />
        </span>
      </div>

      {/* Sender details & file title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-center space-x-1.5 text-xs text-cyan-400 font-semibold tracking-wide">
          <Laptop className="w-3.5 h-3.5" />
          <span>{offer.senderDeviceName || 'Nearby Device'} wants to share:</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-warm-bone tracking-tight truncate px-2" title={offer.fileName}>
          {offer.fileName}
        </h2>
        <div className="flex items-center justify-center space-x-2 pt-1">
          <span className="px-3 py-1 rounded-full bg-obsidian-base border border-white/[0.06] text-xs font-mono font-medium text-warm-bone">
            {formatBytes(offer.fileSize)}
          </span>
          {offer.transportMode === 'RELAY_STREAM' ? (
            <span className="px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-xs font-semibold text-violet-300">
              🌐 Relay Stream
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-xs font-semibold text-emerald-300 flex items-center space-x-1">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Direct Wi-Fi</span>
            </span>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="p-3.5 rounded-2xl bg-obsidian-base/80 border border-white/[0.06] text-left text-xs space-y-1">
        <div className="flex items-center space-x-1.5 text-warm-bone font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Direct-to-Disk Streaming</span>
        </div>
        <p className="text-[11px] text-warm-sand leading-relaxed">
          The file streams directly to your device storage in real time. Zero browser memory limits.
        </p>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2.5 pt-1">
        {hasSavePicker && (
          <button
            type="button"
            onClick={handlePickLocationAndAccept}
            disabled={isPickingLocation}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <FolderDown className="w-4 h-4" />
            <span>Choose Folder & Save</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onAccept(offer)}
          className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
            hasSavePicker
              ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
              : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-cyan-500/25 active:scale-[0.98]'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>{hasSavePicker ? 'Save to Downloads' : 'Accept & Download'}</span>
        </button>

        <button
          type="button"
          onClick={() => onReject(offer)}
          className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center justify-center space-x-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>Decline Transfer</span>
        </button>
      </div>

      {/* Switch to send back */}
      {onSwitchToSender && (
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={onSwitchToSender}
            className="text-xs text-slate-400 hover:text-cyan-300 transition-colors flex items-center justify-center space-x-1 mx-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Want to send a file instead?</span>
          </button>
        </div>
      )}
    </div>
  );
}
