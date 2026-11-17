'use client';

import React from 'react';
import { formatBytes, formatSpeed } from '@sharelan/shared';
import { ActiveTransferState } from './TransferCard';
import {
  Clock,
  CheckCircle2,
  FolderOpen,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Trash2,
  FileCheck2,
  ShieldCheck,
  FolderArchive,
} from 'lucide-react';

export interface CompletedTransferRecord {
  transferId: string;
  role: 'sender' | 'receiver';
  fileName: string;
  fileSize: number;
  peerName: string;
  completedAt: number;
  averageSpeed?: number;
  finalHash?: string;
  isFolder?: boolean;
}

interface TransferHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: CompletedTransferRecord[];
  onClearHistory: () => void;
}

export function TransferHistoryModal({
  isOpen,
  onClose,
  records,
  onClearHistory,
}: TransferHistoryModalProps) {
  if (!isOpen) return null;

  const isDesktop =
    typeof window !== 'undefined' && Boolean((window as any).electronAPI?.openDownloadsFolder);

  const handleOpenDownloads = () => {
    if (isDesktop) {
      (window as any).electronAPI.openDownloadsFolder();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-obsidian-card/95 border border-white/[0.08] shadow-2xl p-6 space-y-5 text-warm-bone backdrop-blur-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-warm-bone">Transfer History</h3>
              <p className="text-xs text-warm-sand">
                {records.length} {records.length === 1 ? 'file' : 'files'} transferred in this session
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {records.length > 0 && (
              <button
                onClick={onClearHistory}
                className="p-1.5 rounded-xl hover:bg-white/10 text-warm-sand hover:text-rose-400 transition-colors"
                title="Clear History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-warm-sand hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 -mr-1">
          {records.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-warm-sand">
              <Clock className="w-8 h-8 opacity-40 text-cyan-400" />
              <p className="text-sm font-medium text-warm-bone">No completed transfers yet</p>
              <p className="text-xs max-w-xs text-warm-sand/80">
                Transferred files will appear here with speed logs and SHA-256 integrity verification.
              </p>
            </div>
          ) : (
            records.map((rec) => {
              const isSender = rec.role === 'sender';
              const isFolder = rec.isFolder || rec.fileName.endsWith('.tar');
              const formattedTime = new Date(rec.completedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={rec.transferId}
                  className="p-3.5 rounded-2xl bg-obsidian-hover/50 border border-white/[0.04] flex items-center justify-between gap-3 hover:border-white/[0.1] transition-all"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSender
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      }`}
                    >
                      {isFolder ? (
                        <FolderArchive className="w-4 h-4" />
                      ) : isSender ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-warm-sand">
                          {isSender ? `Sent to ${rec.peerName}` : `Received from ${rec.peerName}`}
                        </span>
                        <span className="text-white/20">•</span>
                        <span className="text-[10px] text-warm-sand/70 font-mono">{formattedTime}</span>
                      </div>
                      <h4 className="text-xs font-bold text-warm-bone truncate max-w-xs" title={rec.fileName}>
                        {rec.fileName}
                      </h4>
                      <div className="flex items-center space-x-2 text-[10px] text-warm-sand font-mono mt-0.5">
                        <span>{formatBytes(rec.fileSize)}</span>
                        {rec.averageSpeed && rec.averageSpeed > 0 && (
                          <>
                            <span className="text-white/20">•</span>
                            <span className="text-cyan-400">{formatSpeed(rec.averageSpeed)} avg</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {rec.finalHash && (
                      <span
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                        title={`Verified SHA-256: ${rec.finalHash}`}
                      >
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Verified</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        {isDesktop && (
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-warm-sand">Orbit Downloads Directory</span>
            <button
              onClick={handleOpenDownloads}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open Downloads Folder</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
