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
    <header className="border-b border-white/[0.04] bg-obsidian-void/70 backdrop-blur-2xl sticky top-0 z-40 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 flex items-center justify-center shadow-md shadow-blue-500/10">
            <Laptop className="w-4 h-4 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold tracking-tight text-warm-bone">Orbit</span>
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
          </div>
        </div>

        {/* Device Identity, Diagnostics & Settings */}
        <div className="flex items-center space-x-2">
          {/* My Device Name Badge */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-obsidian-card border border-white/[0.08] text-xs text-warm-sand">
            <span className="text-warm-stone">You:</span>
            {isEditingName ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="w-24 px-1 py-0.5 bg-obsidian-hover text-warm-bone rounded text-xs border border-cyan-400 focus:outline-none"
                  autoFocus
                />
                <button onClick={handleSaveName} className="text-emerald-400 hover:text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="flex items-center space-x-1 cursor-pointer hover:text-warm-bone group"
                title="Click to rename device"
              >
                <span suppressHydrationWarning className="font-semibold text-warm-bone truncate max-w-[110px] sm:max-w-none">
                  {session.clientName}
                </span>
                <Edit2 className="w-3 h-3 text-warm-stone group-hover:text-cyan-400" />
              </div>
            )}
          </div>

          {/* Network diagnostics button */}
          <button
            onClick={onOpenBenchmark}
            className="p-2 rounded-xl bg-obsidian-card hover:bg-obsidian-hover border border-white/[0.08] text-warm-sand hover:text-warm-bone transition-colors"
            title="Network Info & Throughput Benchmark"
          >
            <Activity className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Settings button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-obsidian-card hover:bg-obsidian-hover border border-white/[0.08] text-warm-sand hover:text-warm-bone transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-warm-sand hover:text-warm-bone" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
