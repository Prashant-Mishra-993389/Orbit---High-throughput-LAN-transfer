import React, { useState } from 'react';
import { NetworkDiagnostics } from '@sharelan/protocol';
import { ClientSession, setClientName } from '../lib/session';
import { Wifi, WifiOff, Activity, Laptop, Edit2, Check, Settings, Clock } from 'lucide-react';

interface NavbarProps {
  session: ClientSession;
  isConnected: boolean;
  diagnostics: NetworkDiagnostics | null;
  onOpenBenchmark: () => void;
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
  historyCount?: number;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  isConnected,
  diagnostics,
  onOpenBenchmark,
  onOpenSettings,
  onOpenHistory,
  historyCount = 0,
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
    <header className="border-b border-white/[0.08] bg-obsidian-void/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-md bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-white shadow-sm">
            <span className="font-bold text-[11px] font-mono tracking-tighter">O</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold tracking-tight text-zinc-100">Orbit</span>
              <span className="flex h-1.5 w-1.5 relative">
                {isConnected ? (
                  <span className="rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                ) : (
                  <span className="rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                )}
              </span>
              {diagnostics?.localIp && diagnostics.localIp !== '127.0.0.1' && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06]">
                  <span>{diagnostics.localIp}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Device Identity, Diagnostics & Settings */}
        <div className="flex items-center space-x-1.5">
          {/* My Device Name Badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-400">
            <span className="text-zinc-500 text-[11px]">Device:</span>
            {isEditingName ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="w-24 px-1 py-0.5 bg-obsidian-hover text-zinc-100 rounded text-xs border border-white/30 focus:outline-none"
                  autoFocus
                />
                <button onClick={handleSaveName} className="text-emerald-400 hover:text-emerald-300">
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="flex items-center space-x-1 cursor-pointer hover:text-zinc-200 group"
                title="Click to rename device"
              >
                <span suppressHydrationWarning className="font-medium text-zinc-200 truncate max-w-[110px] sm:max-w-none">
                  {session.clientName}
                </span>
                <Edit2 className="w-2.5 h-2.5 text-zinc-500 group-hover:text-zinc-300" />
              </div>
            )}
          </div>

          {/* Transfer History Button */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="relative p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
              title="Transfer History"
            >
              <Clock className="w-4 h-4" />
              {historyCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white text-[9px] font-bold text-zinc-950 flex items-center justify-center">
                  {historyCount}
                </span>
              )}
            </button>
          )}

          {/* Network diagnostics button */}
          <button
            onClick={onOpenBenchmark}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
            title="Network Info & Benchmark"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Settings button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
