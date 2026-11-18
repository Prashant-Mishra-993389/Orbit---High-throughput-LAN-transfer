'use client';

import React, { useState, useEffect } from 'react';
import { TransferOffer } from '@sharelan/protocol';
import { formatBytes } from '@sharelan/shared';
import { FileIcon } from './FileIcon';
import { copyTextToClipboard } from '../lib/clipboard';
import {
  DownloadCloud,
  Check,
  X,
  Laptop,
  FolderDown,
  FolderOpen,
  Download,
  Zap,
  ShieldCheck,
  RotateCcw,
  Edit2,
  Copy,
  Info,
  HardDrive,
} from 'lucide-react';

interface ReceiverViewProps {
  offer: TransferOffer;
  onAccept: (offer: TransferOffer, fileHandle?: any) => void;
  onReject: (offer: TransferOffer) => void;
  onSwitchToSender?: () => void;
}

export function ReceiverView({
  offer,
  onAccept,
  onReject,
  onSwitchToSender,
}: ReceiverViewProps) {
  const [saveMode, setSaveMode] = useState<'custom' | 'downloads'>('custom');
  const [fileName, setFileName] = useState(offer.fileName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [chosenPath, setChosenPath] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<any | null>(null);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [hasWebPicker, setHasWebPicker] = useState(false);
  const [copiedSettings, setCopiedSettings] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const electronAvailable = Boolean((window as any).electronAPI);
      setIsElectron(electronAvailable);

      if (!electronAvailable && 'showSaveFilePicker' in window && window.isSecureContext) {
        setHasWebPicker(true);
      }
    }
  }, []);

  const handleBrowseLocation = async () => {
    if (isElectron) {
      try {
        setIsBrowsing(true);
        const selected = await (window as any).electronAPI.chooseSavePath(fileName);
        setIsBrowsing(false);
        if (selected) {
          setChosenPath(selected);
          setSaveMode('custom');
        }
      } catch (err) {
        setIsBrowsing(false);
        console.warn('Electron chooseSavePath error:', err);
      }
    } else if (hasWebPicker) {
      try {
        setIsBrowsing(true);
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
        });
        setIsBrowsing(false);
        if (handle) {
          setFileHandle(handle);
          setChosenPath(handle.name);
          setSaveMode('custom');
        }
      } catch (err: any) {
        setIsBrowsing(false);
        if (err.name !== 'AbortError') {
          console.warn('Web save picker error:', err);
        }
      }
    }
  };

  const handleAccept = async () => {
    const finalOffer: TransferOffer = {
      ...offer,
      fileName: fileName.trim() || offer.fileName,
    };

    if (saveMode === 'downloads') {
      if (isElectron) {
        try {
          await (window as any).electronAPI.setPreselectedSavePath('DEFAULT_DOWNLOADS');
        } catch {}
      }
      onAccept(finalOffer);
      return;
    }

    // Custom Location Mode
    if (isElectron) {
      if (chosenPath) {
        // Path is already chosen and registered in main process
        onAccept(finalOffer);
      } else {
        // Prompt native dialog right now
        try {
          setIsBrowsing(true);
          const selected = await (window as any).electronAPI.chooseSavePath(fileName);
          setIsBrowsing(false);
          if (selected) {
            setChosenPath(selected);
            onAccept(finalOffer);
          }
        } catch {
          setIsBrowsing(false);
        }
      }
    } else if (hasWebPicker) {
      if (fileHandle) {
        onAccept(finalOffer, fileHandle);
      } else {
        try {
          setIsBrowsing(true);
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
          });
          setIsBrowsing(false);
          if (handle) {
            setFileHandle(handle);
            setChosenPath(handle.name);
            onAccept(finalOffer, handle);
          }
        } catch (err: any) {
          setIsBrowsing(false);
          if (err.name !== 'AbortError') {
            console.warn('Web save picker error:', err);
          }
        }
      }
    } else {
      // Browser over HTTP LAN (where browser sandbox prohibits direct directory access)
      // The browser's native download manager will handle the stream.
      onAccept(finalOffer);
    }
  };

  const handleCopyChromeSettings = async () => {
    const ok = await copyTextToClipboard('chrome://settings/downloads');
    if (ok) {
      setCopiedSettings(true);
      setTimeout(() => setCopiedSettings(false), 2500);
    }
  };

  const getPrimaryButtonLabel = () => {
    if (isBrowsing) return 'Selecting Location...';
    if (saveMode === 'downloads') return 'Accept & Save to Downloads';
    if (isElectron) {
      return chosenPath ? 'Accept & Save to Chosen Folder' : 'Choose Folder & Accept';
    }
    if (hasWebPicker) {
      return fileHandle ? 'Accept & Save to Selected Folder' : 'Choose Folder & Accept';
    }
    return 'Accept & Download (Save As)';
  };

  return (
    <div className="w-full max-w-md mx-auto p-5 sm:p-6 rounded-xl bg-obsidian-card border border-white/[0.08] shadow-2xl space-y-4 text-center animate-fade-in relative overflow-hidden">
      {/* File Icon Hero */}
      <div className="relative mx-auto w-14 h-14 rounded-xl bg-obsidian-base border border-white/[0.08] flex items-center justify-center shadow-md">
        <FileIcon fileName={fileName} mimeType={offer.mimeType} className="w-7 h-7" />
        <span className="absolute -bottom-1 -right-1 p-1 rounded-md bg-white text-zinc-950 shadow-sm">
          <DownloadCloud className="w-3 h-3" />
        </span>
      </div>

      {/* Sender details & file title */}
      <div className="space-y-1">
        <div className="flex items-center justify-center space-x-1.5 text-xs text-zinc-400 font-medium">
          <Laptop className="w-3.5 h-3.5 text-zinc-500" />
          <span>{offer.senderDeviceName || 'Nearby Device'} wants to send:</span>
        </div>

        {/* Editable File Name */}
        {isEditingName ? (
          <div className="flex items-center justify-center space-x-1.5 pt-1">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="text-sm font-medium text-zinc-100 bg-obsidian-base border border-white/[0.15] rounded-md px-2.5 py-1 text-center focus:outline-none focus:border-zinc-300 w-full max-w-xs font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingName(false);
              }}
            />
            <button
              onClick={() => setIsEditingName(false)}
              className="p-1 rounded bg-white/[0.08] hover:bg-white/[0.15] text-zinc-200"
              title="Confirm file name"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-1 group pt-0.5">
            <h2
              className="text-base font-semibold text-zinc-100 tracking-tight truncate max-w-[280px]"
              title={fileName}
            >
              {fileName}
            </h2>
            <button
              onClick={() => setIsEditingName(true)}
              className="opacity-60 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-opacity"
              title="Rename before saving"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-center space-x-2 pt-0.5">
          <span className="px-2 py-0.5 rounded text-xs font-mono font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.06]">
            {formatBytes(offer.fileSize)}
          </span>
          {fileName.endsWith('.tar') && (
            <span className="px-2 py-0.5 rounded text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.06]">
              Folder Archive
            </span>
          )}
          {offer.transportMode === 'RELAY_STREAM' ? (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06]">
              Relay Stream
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center space-x-1">
              <Zap className="w-2.5 h-2.5" />
              <span>Direct Link</span>
            </span>
          )}
        </div>
      </div>

      {/* WHERE TO SAVE SECTION */}
      <div className="text-left space-y-2 pt-1">
        <label className="text-[11px] font-semibold text-zinc-300 tracking-wider uppercase flex items-center space-x-1 px-1">
          <FolderDown className="w-3.5 h-3.5 text-zinc-400" />
          <span>Where to save this file:</span>
        </label>

        {/* Option 1: Choose Custom Location / Folder */}
        <div
          onClick={() => setSaveMode('custom')}
          className={`p-3 rounded-lg border transition-all cursor-pointer text-xs space-y-2 ${
            saveMode === 'custom'
              ? 'bg-white/[0.06] border-white/[0.22] shadow-sm'
              : 'bg-obsidian-base/60 border-white/[0.06] hover:bg-white/[0.02]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2.5">
              <div className="pt-0.5">
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                    saveMode === 'custom'
                      ? 'border-white bg-white'
                      : 'border-zinc-500 bg-transparent'
                  }`}
                >
                  {saveMode === 'custom' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                  )}
                </div>
              </div>
              <div>
                <div className="font-semibold text-zinc-100 flex items-center space-x-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Choose Location / Folder</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug pt-0.5">
                  {isElectron
                    ? chosenPath
                      ? `Selected: ${chosenPath}`
                      : 'Pick any folder or drive on your computer before saving.'
                    : hasWebPicker
                    ? chosenPath
                      ? `Selected: ${chosenPath}`
                      : 'Select exact directory using your system file manager.'
                    : 'Prompt for save destination via browser Save-As dialog.'}
                </p>
              </div>
            </div>

            {/* Browse Button for Electron / Web Picker */}
            {(isElectron || hasWebPicker) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBrowseLocation();
                }}
                disabled={isBrowsing}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-zinc-200 transition-all flex items-center space-x-1 shrink-0 ml-2"
              >
                <FolderOpen className="w-3 h-3" />
                <span>{chosenPath ? 'Change' : 'Browse...'}</span>
              </button>
            )}
          </div>

          {/* Special Guidance for HTTP Browser LAN Context */}
          {!isElectron && !hasWebPicker && saveMode === 'custom' && (
            <div className="p-2 rounded bg-black/40 border border-white/[0.06] text-[10.5px] text-zinc-400 space-y-1">
              <div className="flex items-center space-x-1 text-zinc-300 font-medium">
                <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>Prompt on Every Download</span>
              </div>
              <p className="leading-relaxed">
                To pick the save folder on every transfer in Chrome/Edge, enable &quot;Ask where to save each file before downloading&quot; in browser settings.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyChromeSettings();
                }}
                className="inline-flex items-center space-x-1 text-[10px] font-mono text-zinc-300 bg-white/[0.06] hover:bg-white/[0.1] px-2 py-0.5 rounded border border-white/[0.08] transition-colors"
              >
                <Copy className="w-2.5 h-2.5" />
                <span>{copiedSettings ? 'Copied settings URL!' : 'Copy chrome://settings/downloads'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Option 2: Default Downloads Folder */}
        <div
          onClick={() => setSaveMode('downloads')}
          className={`p-3 rounded-lg border transition-all cursor-pointer text-xs ${
            saveMode === 'downloads'
              ? 'bg-white/[0.06] border-white/[0.22] shadow-sm'
              : 'bg-obsidian-base/60 border-white/[0.06] hover:bg-white/[0.02]'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            <div className="pt-0.5">
              <div
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                  saveMode === 'downloads'
                    ? 'border-white bg-white'
                    : 'border-zinc-500 bg-transparent'
                }`}
              >
                {saveMode === 'downloads' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                )}
              </div>
            </div>
            <div>
              <div className="font-semibold text-zinc-100 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                <span>Default Downloads Folder</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug pt-0.5 font-mono">
                Downloads / {fileName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleAccept}
          disabled={isBrowsing}
          className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{getPrimaryButtonLabel()}</span>
        </button>

        <button
          type="button"
          onClick={() => onReject(offer)}
          className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center space-x-1"
        >
          <X className="w-3 h-3" />
          <span>Decline</span>
        </button>
      </div>

      {/* Switch to send back */}
      {onSwitchToSender && (
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            onClick={onSwitchToSender}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center space-x-1 mx-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Send a file instead</span>
          </button>
        </div>
      )}
    </div>
  );
}
