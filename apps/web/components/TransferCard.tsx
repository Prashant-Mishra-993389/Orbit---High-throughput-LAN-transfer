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
    <div className="p-5 rounded-3xl bg-surface-50 border border-white/10 shadow-xl transition-all space-y-3">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isSender
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isSender ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                {isSender ? `Sending to ${transfer.peerName}` : `Receiving from ${transfer.peerName}`}
              </span>

              {/* Automatic Transport Badge */}
              {isRelay ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  <Globe className="w-3 h-3 text-violet-400" />
                  <span>Relay</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span>Direct</span>
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-white truncate max-w-md" title={transfer.fileName}>
              {transfer.fileName}
            </h4>
          </div>
        </div>

        {/* Action / State Icon */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {(isWaiting || isTransferring) && (
            <button
              onClick={() => onCancel(transfer.transferId)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Cancel transfer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          {isCompleted && (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>{isSender ? 'Streamed Directly' : 'Saved to Device'}</span>
            </div>
          )}

          {isVerifying && (
            <div className="flex items-center space-x-1.5 text-xs text-cyan-400 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Integrity</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2.5 rounded-full bg-surface-200 overflow-hidden mb-3">
        {isWaiting ? (
          <div className="h-full w-full bg-gradient-to-r from-blue-500/30 to-cyan-500/30 animate-pulse rounded-full" />
        ) : (
          <div
            className={`h-full transition-all duration-200 rounded-full ${
              isCompleted
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : isFailed
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-blue-500 to-cyan-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, transfer.percentage))}%` }}
          />
        )}
      </div>

      {/* Status & Metrics */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
        {isWaiting ? (
          <span className="text-cyan-400 animate-pulse">
            {transfer.status === 'OFFERED'
              ? 'Waiting for recipient to accept...'
              : 'Connecting...'}
          </span>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-white">{transfer.percentage.toFixed(1)}%</span>
              <span>
                {formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.fileSize)}
              </span>
              {isTransferring && transfer.currentSpeed > 0 && (
                <span className="text-cyan-400 font-semibold">
                  {formatSpeed(transfer.currentSpeed)}
                </span>
              )}
            </div>

            {isTransferring && transfer.etaSeconds > 0 && (
              <div className="flex items-center space-x-1 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>ETA {formatDuration(transfer.etaSeconds)}</span>
              </div>
            )}
          </>
        )}

        {isCompleted && transfer.finalHash && (
          <span className="text-[11px] text-emerald-400 font-mono">
            SHA-256: {transfer.finalHash.substring(0, 8)}...{transfer.finalHash.substring(56)}
          </span>
        )}
      </div>

      {isFailed && (
        <div className="mt-2 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 space-y-1 text-xs animate-fade-in">
          <div className="flex items-center space-x-1.5 font-bold text-rose-400">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>Transfer Failed</span>
          </div>
          <p className="font-mono text-[11px] text-rose-200/90 leading-tight">
            {transfer.error || 'Connection interrupted or peer disconnected. Please try again.'}
          </p>
        </div>
      )}
    </div>
  );
};
