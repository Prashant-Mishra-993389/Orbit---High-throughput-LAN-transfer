import React from 'react';
import { TransferOffer } from '@sharelan/protocol';
import { formatBytes } from '@sharelan/shared';
import { DownloadCloud, X, Laptop, FolderDown, Download } from 'lucide-react';

interface IncomingTransferModalProps {
  offer: TransferOffer | null;
  onAccept: (offer: TransferOffer) => void;
  onReject: (offer: TransferOffer) => void;
}

export const IncomingTransferModal: React.FC<IncomingTransferModalProps> = ({
  offer,
  onAccept,
  onReject,
}) => {
  if (!offer || offer.status !== 'OFFERED') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-surface-50 border border-cyan-500/30 shadow-2xl p-6 text-center space-y-4">
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-cyan-500/30 border border-cyan-500/40 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
          <DownloadCloud className="w-8 h-8 text-cyan-300 animate-bounce" />
        </div>

        {/* Sender details */}
        <div>
          <div className="flex items-center justify-center space-x-1.5 text-xs text-cyan-400 font-medium mb-1">
            <Laptop className="w-3.5 h-3.5" />
            <span>Incoming file from {offer.senderDeviceName}</span>
          </div>
          <h3 className="text-xl font-bold text-white truncate px-2" title={offer.fileName}>
            {offer.fileName}
          </h3>
        </div>

        {/* File metadata badges */}
        <div className="flex items-center justify-center space-x-2">
          <span className="px-3 py-1 rounded-full bg-surface-100 border border-white/10 text-xs font-mono text-slate-300">
            {formatBytes(offer.fileSize)}
          </span>
          {offer.transportMode === 'RELAY_STREAM' ? (
            <span className="px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-xs font-semibold text-violet-300">
              🌐 Relay Mode
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
              ⚡ Direct LAN (Full Speed)
            </span>
          )}
        </div>

        {/* Clear Save Destination Information */}
        <div className="p-3.5 rounded-2xl bg-surface-100/80 border border-white/5 text-left text-xs space-y-1.5">
          <div className="flex items-center space-x-2 text-slate-200 font-semibold">
            <FolderDown className="w-4 h-4 text-emerald-400" />
            <span>Save Destination</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Streams directly to your default Downloads folder. Chunked streaming enabled with zero memory limits.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => onReject(offer)}
            className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-surface-100 hover:bg-surface-200 text-slate-400 hover:text-white font-semibold text-xs transition-all border border-white/5 flex items-center justify-center space-x-1.5"
          >
            <X className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            onClick={() => onAccept(offer)}
            className="w-full sm:flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs shadow-lg shadow-cyan-500/25 transition-all active:scale-95 flex items-center justify-center space-x-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Accept & Save to Downloads</span>
          </button>
        </div>
      </div>
    </div>
  );
};
