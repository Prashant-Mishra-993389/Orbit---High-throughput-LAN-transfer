import React, { useState } from 'react';
import { NetworkDiagnostics } from '@sharelan/protocol';
import { ClientSession, setClientName } from '../lib/session';
import { Wifi, WifiOff, Activity, Laptop, Edit2, Check, Settings } from 'lucide-react';

interface NavbarProps {
  session: ClientSession;
  isConnected: boolean;
  diagnostics: NetworkDiagnostics | null;
  onOpenBenchmark: () => void;
  onOpenSettings?: () => void;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  isConnected,
  diagnostics,
  onOpenBenchmark,
  onOpenSettings,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(session.clientName);

  React.useEffect(() => {
    setNameInput(session.clientName);
  }, [session.clientName]);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      setClientName(nameInput.trim());
      session.clientName = nameInput.trim();
    }
    setIsEditingName(false);
  };

  return (
    <header className="border-b border-white/10 bg-surface-50/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Laptop className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold tracking-tight text-white">ShareLAN</span>
              <span className="flex h-2 w-2 relative">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Direct Local Network Transfer</p>
          </div>
        </div>

        {/* Device Identity, Diagnostics & Settings */}
        <div className="flex items-center space-x-2">
          {/* My Device Name Badge */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-white/5 text-xs text-slate-300">
            <span className="text-slate-500">You:</span>
            {isEditingName ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="w-24 px-1 py-0.5 bg-surface-200 text-white rounded text-xs border border-cyan-400 focus:outline-none"
                  autoFocus
                />
                <button onClick={handleSaveName} className="text-emerald-400 hover:text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="flex items-center space-x-1 cursor-pointer hover:text-white group"
                title="Click to rename device"
              >
                <span suppressHydrationWarning className="font-semibold text-white truncate max-w-[110px] sm:max-w-none">
                  {session.clientName}
                </span>
                <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-cyan-400" />
              </div>
            )}
          </div>

          {/* Network diagnostics button */}
          <button
            onClick={onOpenBenchmark}
            className="p-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-white/5 text-slate-300 hover:text-white transition-colors"
            title="Network Info & Throughput Benchmark"
          >
            <Activity className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Settings button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-white/5 text-slate-300 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
