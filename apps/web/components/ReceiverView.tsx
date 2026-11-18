'use client';

import React, { useEffect, useState } from 'react';
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
  Info,
  Copy,
  Check,
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { playOfferChime, playDropLatch, playDeclineThud } from '../lib/sound';

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
  const [copiedSetting, setCopiedSetting] = useState(false);

  // Play soft marimba ping when offer appears
  useEffect(() => {
    playOfferChime();
  }, []);

  const handleAccept = () => {
    playDropLatch();
    onAccept(offer);
  };

  const handleReject = () => {
    playDeclineThud();
    onReject(offer);
  };

  const handleCopySettingsUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isBrave = typeof navigator !== 'undefined' && Boolean((navigator as any).brave);
    const url = isBrave ? 'brave://settings/downloads' : 'chrome://settings/downloads';
    navigator.clipboard?.writeText(url);
    setCopiedSetting(true);
    setTimeout(() => setCopiedSetting(false), 2000);
  };

  return (
    <SpotlightCard
      spotlightColor="rgba(56, 189, 248, 0.05)"
      borderColor="rgba(56, 189, 248, 0.3)"
      className="w-full max-w-sm mx-auto p-6 shadow-2xl space-y-5 text-center animate-fade-in relative overflow-hidden"
    >
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

      {/* Save destination note & Brave/Chrome tip */}
      <div className="p-3 rounded-lg bg-obsidian-base border border-white/[0.06] text-xs space-y-2 text-zinc-400 text-left">
        <div className="flex items-center space-x-2 text-zinc-300 font-medium">
          <FolderDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>Streams directly into default <strong>Downloads</strong> folder</span>
        </div>
        <div className="text-[11px] text-zinc-400 leading-relaxed bg-white/[0.02] p-2 rounded border border-white/[0.04]">
          <div className="flex items-start space-x-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                To skip the browser &quot;Save As&quot; dialog entirely, toggle off <em>&quot;Ask where to save each file before downloading&quot;</em> in your browser settings.
              </p>
              <button
                type="button"
                onClick={handleCopySettingsUrl}
                className="inline-flex items-center space-x-1 text-[10px] font-mono text-zinc-300 bg-white/[0.06] hover:bg-white/[0.12] px-2 py-0.5 rounded border border-white/[0.08] transition-colors"
              >
                {copiedSetting ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied settings URL!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copy settings URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleAccept}
          className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Accept & Save to Downloads</span>
        </button>

        <button
          type="button"
          onClick={handleReject}
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
    </SpotlightCard>
  );
}
