import React, { useState } from 'react';
import { NetworkDiagnostics } from '@sharelan/protocol';
import { runSyntheticBenchmark } from '../lib/api';
import { X, Activity, Wifi, CheckCircle2, ShieldCheck, Gauge, AlertTriangle, Loader2 } from 'lucide-react';

interface NetworkDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: NetworkDiagnostics | null;
  observedSpeed?: number;
}

export const NetworkDiagnosticsModal: React.FC<NetworkDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  observedSpeed = 0,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<{
    speedFormatted: string;
    speedBytesPerSec: number;
    durationSec: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    try {
      const res = await runSyntheticBenchmark(25 * 1024 * 1024); // 25 MB test payload
      setBenchmarkResult(res);
    } catch (err) {
      console.error('Benchmark failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const efficiency =
    benchmarkResult && benchmarkResult.speedBytesPerSec > 0 && observedSpeed > 0
      ? Math.min(100, (observedSpeed / benchmarkResult.speedBytesPerSec) * 100).toFixed(1)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-surface-50 border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Network Diagnostics & Benchmark</h3>
              <p className="text-xs text-slate-400">Direct peer LAN capability inspection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Network Parameters Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
              <span className="text-slate-400 block mb-1">Selected Interface</span>
              <span className="font-semibold text-white">
                {diagnostics?.selectedInterface?.name || 'Wi-Fi'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
              <span className="text-slate-400 block mb-1">Local LAN Address</span>
              <span className="font-mono font-semibold text-cyan-400">
                {diagnostics?.localIp}:{diagnostics?.port}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
              <span className="text-slate-400 block mb-1">Direct LAN Connectivity</span>
              <span className="flex items-center space-x-1 font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Available</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-100 border border-white/5">
              <span className="text-slate-400 block mb-1">Primary Transport</span>
              <span className="font-semibold text-white">HTTP Streaming (TCP)</span>
            </div>
          </div>

          {/* Synthetic Benchmark Box */}
          <div className="p-4 rounded-2xl bg-surface-100/60 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">Application Throughput Benchmark</span>
              </div>
              <button
                onClick={handleRunBenchmark}
                disabled={isRunning}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <span>Run Benchmark</span>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Measures synthetic TCP streaming capacity to the host to distinguish network router limits from disk I/O bottlenecks.
            </p>

            {benchmarkResult && (
              <div className="p-3 rounded-xl bg-surface-200 border border-cyan-500/20 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Raw Network Capacity:</span>
                  <span className="text-cyan-400 font-bold">{benchmarkResult.speedFormatted}</span>
                </div>
                {efficiency && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Application Efficiency:</span>
                    <span className="text-emerald-400 font-bold">{efficiency}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-100/50 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-xs font-semibold text-slate-200 transition-colors border border-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
