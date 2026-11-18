import React, { useEffect, useState } from 'react';
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
  RotateCcw,
  X,
  AlertCircle,
  Ban,
  Activity,
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { playSuccessChime } from '../lib/sound';

/**
 * Real-time dynamic throughput waveform / oscillogram.
 * Modulates harmonic sine waves according to instantaneous streaming velocity.
 */
const ThroughputWaveform: React.FC<{ speed: number; active: boolean }> = ({ speed, active }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active || speed === 0) return;
    let animId: number;
    const animate = () => {
      setPhase((prev) => (prev + 0.08) % (Math.PI * 2));
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [active, speed]);

  const width = 360;
  const height = 24;
  const midY = height / 2;

  if (!active || speed === 0) {
    return (
      <div className="w-full h-5 flex items-center justify-center opacity-25">
        <div className="w-full h-px bg-white/20" />
      </div>
    );
  }

  // Generate dynamic sinusoidal waveform points
  const points: string[] = [];
  const pointsCount = 40;
  // Amplitude scales smoothly with throughput (up to 150+ MB/s)
  const amp = Math.min(8.5, Math.max(2.5, (speed / (60 * 1024 * 1024)) * 8.5));
  const freq = 2.4;

  for (let i = 0; i <= pointsCount; i++) {
    const x = (i / pointsCount) * width;
    const normalizedX = (i / pointsCount) * Math.PI * 2 * freq;
    // Window function so ends smoothly taper to zero at boundaries
    const envelope = Math.sin((i / pointsCount) * Math.PI);
    const y = midY + Math.sin(normalizedX + phase) * amp * envelope;
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  const pathD = points.join(' ');

  return (
    <div className="w-full h-5 relative overflow-hidden flex items-center select-none pointer-events-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        fill="none"
      >
        <defs>
          <linearGradient id="waveGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.2)" />
            <stop offset="50%" stopColor="rgba(56, 189, 248, 0.95)" />
            <stop offset="100%" stopColor="rgba(168, 85, 247, 0.5)" />
          </linearGradient>
        </defs>
        <path
          d={pathD}
          stroke="url(#waveGlow)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

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
  onDismiss?: () => void;
  onRetry?: () => void;
}

export const TransferCard: React.FC<TransferCardProps> = ({
  transfer,
  onCancel,
  onDismiss,
  onRetry,
}) => {
  const isSender = transfer.role === 'sender';
  const isWaiting =
    transfer.status === 'OFFERED' ||
    transfer.status === 'ACCEPTED' ||
    transfer.status === 'CONNECTING';
  const isTransferring = transfer.status === 'TRANSFERRING';
  const isVerifying = transfer.status === 'VERIFYING';
  const isCompleted = transfer.status === 'COMPLETED';
  const isFailed = transfer.status === 'FAILED';
  const isCancelled = transfer.status === 'CANCELLED';
  const isRejected = transfer.status === 'REJECTED';
  const isTerminalError = isFailed || isCancelled || isRejected;
  const isRelay = transfer.transportMode === 'RELAY_STREAM';

  // Procedural audio chime on completion
  useEffect(() => {
    if (transfer.status === 'COMPLETED') {
      playSuccessChime();
    }
  }, [transfer.status]);

  return (
    <SpotlightCard
      spotlightColor={
        isCompleted
          ? 'rgba(16, 185, 129, 0.06)'
          : isTerminalError
          ? 'rgba(244, 63, 94, 0.05)'
          : 'rgba(56, 189, 248, 0.05)'
      }
      borderColor={
        isCompleted
          ? 'rgba(16, 185, 129, 0.3)'
          : isTerminalError
          ? 'rgba(244, 63, 94, 0.25)'
          : 'rgba(56, 189, 248, 0.25)'
      }
      className="p-5 relative shadow-2xl transition-all space-y-4 overflow-hidden"
    >
      {/* Specular Sweep Flash on Transfer Completion */}
      {isCompleted && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none animate-sweep" />
      )}

      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border spring-transition ${
              isTerminalError
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : isCompleted
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isSender
                ? 'bg-white/[0.04] text-zinc-200 border-white/[0.08]'
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            }`}
          >
            {isTerminalError ? (
              <XCircle className="w-4 h-4" />
            ) : isSender ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownLeft className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] uppercase tracking-wider font-medium text-zinc-400">
                {isSender ? `Sending to ${transfer.peerName}` : `Receiving from ${transfer.peerName}`}
              </span>

              {/* Automatic Transport Badge */}
              {isRelay ? (
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06]">
                  <Globe className="w-2.5 h-2.5" />
                  <span>Relay</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                  <Zap className="w-2.5 h-2.5" />
                  <span>Direct Pipe</span>
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

          {isTerminalError && onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
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
                  <span>{isSender ? 'Streamed' : 'Saved to Disk'}</span>
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

      {/* Real-time Data Superhighway: Dynamic Waveform Oscillogram */}
      <ThroughputWaveform speed={transfer.currentSpeed} active={isTransferring} />

      {/* Progress Track with Kinetic Laser Filament Head */}
      <div className="relative w-full h-1.5 rounded-full bg-white/[0.06] overflow-visible">
        {isWaiting ? (
          <div className="h-full w-full bg-white/20 animate-pulse rounded-full" />
        ) : (
          <div className="relative w-full h-full">
            {/* Base Fill */}
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                isCompleted
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                  : isTerminalError
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-cyan-500 to-white'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, transfer.percentage))}%` }}
            />

            {/* Glowing Laser Filament Progress Head */}
            {isTransferring && transfer.percentage > 0 && transfer.percentage < 100 && (
              <span
                className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 bg-white rounded-full shadow-[0_0_12px_2px_rgba(255,255,255,0.95),0_0_24px_5px_rgba(56,189,248,0.85)] animate-laser pointer-events-none"
                style={{ left: `${Math.min(100, Math.max(0, transfer.percentage))}%` }}
              />
            )}
          </div>
        )}
      </div>

      {/* Status & Velocity Metrics (Tabular Numbers) */}
      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono tabular-nums">
        {isWaiting ? (
          <span className="text-zinc-400">
            {transfer.status === 'OFFERED'
              ? 'Waiting for recipient...'
              : 'Connecting...'}
          </span>
        ) : isTerminalError ? (
          <span className="text-rose-400 font-medium">
            {isCancelled
              ? 'Transfer Cancelled'
              : isRejected
              ? 'Declined by recipient'
              : 'Transfer Interrupted'}
          </span>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-zinc-100 text-sm tracking-tight">{transfer.percentage.toFixed(1)}%</span>
              <span className="text-zinc-400">
                {formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.fileSize)}
              </span>
              {isTransferring && transfer.currentSpeed > 0 && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold text-[11px] shadow-sm">
                  <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span>{formatSpeed(transfer.currentSpeed)}</span>
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

      {/* Terminal State Alert & Action CTAs */}
      {isTerminalError && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2.5 text-xs animate-fade-in">
          <div className="flex items-center space-x-1.5 font-medium text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              {isCancelled
                ? 'Transfer was cancelled'
                : isRejected
                ? 'Recipient declined the transfer'
                : 'Transfer Interrupted'}
            </span>
          </div>
          <p className="font-mono text-[11px] text-rose-200/80 leading-relaxed">
            {transfer.error ||
              (isCancelled
                ? 'The transfer was aborted mid-way. No corrupt files were left behind.'
                : isRejected
                ? 'The other device declined the file transfer request.'
                : 'Connection interrupted or peer disconnected.')}
          </p>

          {/* Action buttons so user is NEVER stuck */}
          <div className="flex items-center space-x-2 pt-1">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-3 py-1.5 rounded-md bg-white text-zinc-950 font-semibold text-xs flex items-center space-x-1.5 hover:bg-zinc-200 transition-all shadow-sm active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Try Again</span>
              </button>
            )}

            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="px-3 py-1.5 rounded-md bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-zinc-200 hover:text-white font-medium text-xs transition-all active:scale-95"
              >
                <span>Dismiss</span>
              </button>
            )}
          </div>
        </div>
      )}
    </SpotlightCard>
  );
};
