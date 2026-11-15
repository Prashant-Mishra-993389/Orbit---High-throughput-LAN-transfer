import React from 'react';
import { TransferSession } from '@sharelan/protocol';
import { formatBytes, formatSpeed, formatDuration, calculateETA } from '@sharelan/shared';
import { Layers, Zap } from 'lucide-react';

interface MultiTransferSummaryProps {
  transfers: TransferSession[];
}

export const MultiTransferSummary: React.FC<MultiTransferSummaryProps> = ({ transfers }) => {
  const activeTransfers = transfers.filter((t) => t.status === 'TRANSFERRING');
  if (activeTransfers.length <= 1) return null;

  const totalBytes = activeTransfers.reduce((sum, t) => sum + t.fileSize, 0);
  const transferredBytes = activeTransfers.reduce((sum, t) => sum + t.bytesTransferred, 0);
  const aggregateSpeed = activeTransfers.reduce((sum, t) => sum + t.currentSpeed, 0);
  const percentage = totalBytes > 0 ? (transferredBytes / totalBytes) * 100 : 0;
  const eta = calculateETA(totalBytes, transferredBytes, aggregateSpeed);

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-surface-100 to-cyan-950/40 border border-cyan-500/30 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs uppercase tracking-wider font-bold text-cyan-300">
            TOTAL CONCURRENT STREAM ({activeTransfers.length} transfers)
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
          <Zap className="w-3.5 h-3.5" />
          <span>{formatSpeed(aggregateSpeed)}</span>
        </div>
      </div>

      <div className="relative w-full h-2.5 rounded-full bg-surface-200 overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
        <span>
          {formatBytes(transferredBytes)} / {formatBytes(totalBytes)} ({percentage.toFixed(1)}%)
        </span>
        {eta > 0 && <span>Total ETA: {formatDuration(eta)}</span>}
      </div>
    </div>
  );
};
