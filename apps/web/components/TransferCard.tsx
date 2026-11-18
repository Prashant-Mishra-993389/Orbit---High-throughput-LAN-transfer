import React from 'react';
import { formatBytes, formatSpeed, formatDuration } from '@sharelan/shared';
import { TransferStatus, TransportMode } from '@sharelan/protocol';
import {
  Clock,
  XCircle,
  Loader2,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Globe,
  CheckCircle2,
  FolderOpen,
  FolderArchive,
  Download,
} from 'lucide-react';

export interface ActiveTransferState {
  transferId: string;
  role: 'sender' | 'receiver';
  fileName: string;
  fileSize: number;
  peerName: string;
  status: TransferStatus;
  bytesTransferred: number;
  percentage: number;
  currentSpeed: number;
  averageSpeed: number;
  etaSeconds: number;
  transportMode?: TransportMode;
  badgeLabel?: string;
  finalHash?: string;
  error?: string;
}

interface TransferCardProps {
  transfer: ActiveTransferState;
  onCancel: (id: string) => void;
}

export const TransferCard: React.FC<TransferCardProps> = ({ transfer, onCancel }) => {
  const isSender = transfer.role === 'sender';
  const isWaiting =
    transfer.status === 'OFFERED' ||
    transfer.status === 'ACCEPTED' ||
    transfer.status === 'CONNECTING';
  const isTransferring = transfer.status === 'TRANSFERRING';
  const isVerifying = transfer.status === 'VERIFYING';
  const isCompleted = transfer.status === 'COMPLETED';
  const isFailed = transfer.status === 'FAILED';
  const isRelay = transfer.transportMode === 'RELAY_STREAM';

  return (
    <div className="p-5 rounded-xl bg-obsidian-card border border-white/[0.08] shadow-xl transition-all space-y-4">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${
              isSender
                ? 'bg-white/[0.04] text-zinc-200 border-white/[0.08]'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}
          >
            {isSender ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] uppercase tracking-wider font-medium text-zinc-400">
                {isSender ? `Sending to ${transfer.peerName}` : `Receiving from ${transfer.peerName}`}
              </span>

              {/* Automatic Transport Badge */}
              {isRelay ? (
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06]">
                  <Globe className="w-2.5 h-2.5" />
                  <span>Relay</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                  <Zap className="w-2.5 h-2.5" />
                  <span>Direct</span>
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-zinc-100 truncate max-w-md mt-0.5" title={transfer.fileName}>
              {transfer.fileName}
            </h4>
          </div>
        </div>

        {/* Action / State Icon */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {(isWaiting || isTransferring) && (
            <button
              onClick={() => onCancel(transfer.transferId)}
              className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-white/[0.05] transition-colors"
              title="Cancel transfer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          {isCompleted && (
            <div className="flex items-center space-x-2">
              {typeof window !== 'undefined' && Boolean((window as any).electronAPI?.openDownloadsFolder) ? (
                <button
                  onClick={() => (window as any).electronAPI.openDownloadsFolder()}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-xs text-white font-medium transition-all"
                  title="Open Downloads Folder"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Show in Folder</span>
                </button>
              ) : (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isSender ? 'Streamed' : 'Saved'}</span>
                </div>
              )}
            </div>
          )}

          {isVerifying && (
            <div className="flex items-center space-x-1.5 text-xs text-zinc-300 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying Hash</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar (Linear Precision) */}
      <div className="relative w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        {isWaiting ? (
          <div className="h-full w-full bg-white/20 animate-pulse rounded-full" />
        ) : (
          <div
            className={`h-full transition-all duration-150 rounded-full ${
              isCompleted
                ? 'bg-emerald-400'
                : isFailed
                ? 'bg-rose-500'
                : 'bg-white'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, transfer.percentage))}%` }}
          />
        )}
      </div>

      {/* Status & Metrics */}
      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono tabular-nums">
        {isWaiting ? (
          <span className="text-zinc-400">
            {transfer.status === 'OFFERED'
              ? 'Waiting for recipient...'
              : 'Connecting...'}
          </span>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-zinc-100">{transfer.percentage.toFixed(1)}%</span>
              <span>
                {formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.fileSize)}
              </span>
              {isTransferring && transfer.currentSpeed > 0 && (
                <span className="text-zinc-200 font-medium">
                  {formatSpeed(transfer.currentSpeed)}
                </span>
              )}
            </div>

            {isTransferring && transfer.etaSeconds > 0 && (
              <div className="flex items-center space-x-1 text-zinc-400">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>ETA {formatDuration(transfer.etaSeconds)}</span>
              </div>
            )}
          </>
        )}

        {isCompleted && transfer.finalHash && (
          <span className="text-[11px] text-zinc-400 font-mono">
            SHA-256: {transfer.finalHash.substring(0, 8)}...{transfer.finalHash.substring(56)}
          </span>
        )}
      </div>

      {isFailed && (
        <div className="mt-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1 text-xs animate-fade-in">
          <div className="flex items-center space-x-1.5 font-medium text-rose-400">
            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Transfer Failed</span>
          </div>
          <p className="font-mono text-[11px] text-rose-200/80 leading-tight">
            {transfer.error || 'Connection interrupted or peer disconnected.'}
          </p>
        </div>
      )}
    </div>
  );
};
