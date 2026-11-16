import React, { useState } from 'react';
import {
  X,
  Settings,
  Laptop,
  FolderDown,
  Globe,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName: string;
  onUpdateDeviceName: (name: string) => void;
  storageDir?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  deviceName,
  onUpdateDeviceName,
  storageDir,
}) => {
  const [name, setName] = useState(deviceName);
  const [relayUrl, setRelayUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sharelan_custom_relay') || 'https://relay.sharelan.app';
    }
    return 'https://relay.sharelan.app';
  });
  const [savedRelay, setSavedRelay] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveDeviceName = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onUpdateDeviceName(name.trim());
    }
  };

  const handleSaveRelay = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('sharelan_custom_relay', relayUrl.trim());
    setSavedRelay(true);
    setTimeout(() => setSavedRelay(false), 2000);
  };

  const handleOpenDownloads = () => {
    if ((window as any).electronAPI?.openDownloadsFolder) {
      (window as any).electronAPI.openDownloadsFolder();
    }
  };

  const handleCheckUpdates = () => {
    setUpdateStatus('Checking for updates...');
    setTimeout(() => {
      setUpdateStatus('You are running the latest version of ShareLAN (v1.0.0).');
      setTimeout(() => setUpdateStatus(null), 4000);
    }, 1200);
  };

  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-surface-50 border border-white/10 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Settings</h3>
              <p className="text-xs text-slate-400">Preferences & Application Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Device Name */}
        <form onSubmit={handleSaveDeviceName} className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
            <Laptop className="w-3.5 h-3.5 text-cyan-400" />
            <span>Device Name</span>
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-surface-200 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 text-xs font-semibold text-cyan-300 border border-white/10 transition-all active:scale-95"
            >
              Save
            </button>
          </div>
        </form>

        {/* 2. Downloads Location */}
        <div className="space-y-2 pt-1 border-t border-white/5">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
            <FolderDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Downloads Folder</span>
          </label>
          <div className="p-3 rounded-2xl bg-surface-100/70 border border-white/5 space-y-2">
            <p className="text-xs font-mono text-slate-300 truncate" title={storageDir}>
              {storageDir || 'Downloads/ShareLAN'}
            </p>
            {isElectron && (
              <button
                type="button"
                onClick={handleOpenDownloads}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
              >
                <span>Open in File Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Production Relay Server URL */}
        <form onSubmit={handleSaveRelay} className="space-y-2 pt-1 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-violet-400" />
              <span>Production Streaming Relay</span>
            </label>
            <span className="text-[10px] text-slate-500">AP-Isolation Fallback</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={relayUrl}
              onChange={(e) => setRelayUrl(e.target.value)}
              placeholder="https://relay.sharelan.app"
              className="flex-1 px-3 py-2 rounded-xl bg-surface-200 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 text-xs font-semibold text-violet-300 border border-white/10 transition-all active:scale-95"
            >
              {savedRelay ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : 'Set'}
            </button>
          </div>
        </form>

        {/* 4. About & Updates */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>
              <p className="font-bold text-white">Orbit Desktop</p>
              <p className="text-[11px]">Version 1.0.0 (Production)</p>
            </div>
            <button
              onClick={handleCheckUpdates}
              className="px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-[11px] font-semibold text-slate-300 border border-white/10 flex items-center space-x-1 transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Check for Updates</span>
            </button>
          </div>

          {updateStatus && (
            <p className="text-xs text-emerald-400 font-medium bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              {updateStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
