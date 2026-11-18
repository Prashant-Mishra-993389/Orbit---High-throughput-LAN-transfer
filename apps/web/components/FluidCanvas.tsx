'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DeviceInfo, NetworkDiagnostics } from '@sharelan/protocol';
import {
  UploadCloud,
  Laptop,
  Smartphone,
  QrCode,
  Copy,
  Check,
  KeyRound,
  Zap,
  X,
  FilePlus2,
  FolderPlus,
  Radio,
  RefreshCw,
  Share2,
  Users,
  Send,
  Sparkles,
  Clipboard,
  Flame,
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { playMagneticSnap, playDropLatch } from '../lib/sound';
import { packageFilesIntoTar, processDroppedData, ScannedFile } from '../lib/folder';
import { isHotspotSubnet } from '../lib/network';

interface FluidCanvasProps {
  clientName: string;
  activeSharingUrl: string;
  directPairingUrl: string;
  pairedDevice: DeviceInfo | null;
  nearbyDevices: DeviceInfo[];
  onSelectDevice: (device: DeviceInfo | null) => void;
  onFileSelected: (file: File) => void;
  onDropOnDevice?: (device: DeviceInfo, file: File) => void;
  onOpenQr: () => void;
  showQr: boolean;
  onToggleQr: () => void;
  onCopyUrl: () => void;
  copiedLink: boolean;
  onOpenPairing: (tab?: 'create' | 'join') => void;
  onOpenDiagnostics: () => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  diagnostics?: NetworkDiagnostics | null;
  onSweepPeers?: () => void;
}

export function FluidCanvas({
  clientName,
  activeSharingUrl,
  directPairingUrl,
  pairedDevice,
  nearbyDevices,
  onSelectDevice,
  onFileSelected,
  onDropOnDevice,
  onOpenQr,
  showQr,
  onToggleQr,
  onCopyUrl,
  copiedLink,
  onOpenPairing,
  onOpenDiagnostics,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  diagnostics,
  onSweepPeers,
}: FluidCanvasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const lastSoundDeviceIdRef = useRef<string | null>(null);

  // Global Clipboard Paste Listener (Ctrl+V) for instant file & screenshot sharing
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing into an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (!e.clipboardData || !e.clipboardData.items) return;

      const items: DataTransferItem[] = Array.from(e.clipboardData.items);
      const fileItems = items.filter((item: DataTransferItem) => item.kind === 'file');

      if (fileItems.length > 0) {
        e.preventDefault();
        const files: File[] = [];
        for (const item of fileItems) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }

        if (files.length === 1) {
          playDropLatch();
          onFileSelected(files[0]);
        } else if (files.length > 1) {
          playDropLatch();
          const scanned: ScannedFile[] = files.map((f) => ({
            file: f,
            relativePath: f.name,
          }));
          const tarFile = packageFilesIntoTar(scanned, `Orbit_Pasted_${files.length}_Files`);
          onFileSelected(tarFile);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFileSelected]);

  const isHotspot = isHotspotSubnet(diagnostics?.localIp);
  const activeDevices = nearbyDevices.filter((d) => d.deviceName !== clientName);

  const handleManualProbe = async () => {
    if (onSweepPeers) {
      setIsProbing(true);
      onSweepPeers();
      setTimeout(() => setIsProbing(false), 2000);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length === 1) {
        onFileSelected(e.target.files[0]);
      } else {
        const rawFiles = Array.from(e.target.files);
        const scanned: ScannedFile[] = rawFiles.map((f) => ({
          file: f,
          relativePath: f.name,
        }));
        const tarFile = packageFilesIntoTar(scanned, `Orbit_Batch_${rawFiles.length}_Files`);
        onFileSelected(tarFile);
      }
      e.target.value = '';
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const rawFiles = Array.from(e.target.files);
      const scanned: ScannedFile[] = rawFiles.map((f) => ({
        file: f,
        relativePath: (f as any).webkitRelativePath || f.name,
      }));
      const rootFolder = (rawFiles[0] as any).webkitRelativePath
        ? (rawFiles[0] as any).webkitRelativePath.split('/')[0]
        : 'Folder';
      const tarFile = packageFilesIntoTar(scanned, rootFolder);
      onFileSelected(tarFile);
      e.target.value = '';
    }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative w-full flex flex-col justify-between py-2 select-none"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderInputChange}
        {...({ webkitdirectory: '', directory: '' } as any)}
        className="hidden"
      />

      {/* ============================================================ */}
      {/* 1. TOP AMBIENT STATUS BAR (QUIET, CLEAN)                      */}
      {/* ============================================================ */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-white/[0.06] text-xs text-zinc-400">
        <div className="flex items-center space-x-2">
          {pairedDevice ? (
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                Target: <strong className="text-zinc-100 font-medium">{pairedDevice.deviceName}</strong>
              </span>
              <button
                onClick={() => onSelectDevice(null)}
                className="text-zinc-400 hover:text-rose-400 ml-1 transition-colors"
                title="Deselect target"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-2 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              <span>{isHotspot ? 'Direct Phone Hotspot' : 'Local Wi-Fi Network'}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500 font-mono">
                {activeDevices.length > 0
                  ? `${activeDevices.length} ${activeDevices.length === 1 ? 'peer' : 'peers'} online`
                  : 'Ready'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <span className="text-zinc-500 hidden sm:inline font-mono">Direct-to-disk stream</span>
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-white/[0.04] transition-colors"
            title="Diagnostics"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. THE ORBIT APEX SPLIT-GRID                                 */}
      {/* Left (65%): Payload Drop Canvas | Right (35%): Recipients   */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 my-5 items-stretch">
        {/* LEFT COLUMN: THE PAYLOAD ZONE (ENHANCED SPOTLIGHT CARD) */}
        <SpotlightCard
          onClick={() => fileInputRef.current?.click()}
          className={`md:col-span-7 lg:col-span-8 p-8 sm:p-12 cursor-pointer flex flex-col items-center justify-center text-center relative group min-h-[360px] sm:min-h-[400px] spring-transition ${
            isDragOver
              ? 'bg-obsidian-hover border-white ring-2 ring-white/20 shadow-2xl scale-[1.008]'
              : 'hover:bg-obsidian-hover/70 hover:border-white/[0.18]'
          }`}
        >
          {/* Subtle Corner Markers (Precision engineering detail) */}
          <span className="absolute top-3 left-3 w-1.5 h-1.5 border-t border-l border-white/20 pointer-events-none" />
          <span className="absolute top-3 right-3 w-1.5 h-1.5 border-t border-r border-white/20 pointer-events-none" />
          <span className="absolute bottom-3 left-3 w-1.5 h-1.5 border-b border-l border-white/20 pointer-events-none" />
          <span className="absolute bottom-3 right-3 w-1.5 h-1.5 border-b border-r border-white/20 pointer-events-none" />

          {/* Hero Icon Box with kinetic spring feedback */}
          <div className="mb-4">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center spring-transition border ${
                isDragOver
                  ? 'bg-white text-zinc-950 border-white shadow-xl scale-110'
                  : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 group-hover:text-white group-hover:border-white/20'
              }`}
            >
              <UploadCloud className="w-6 h-6 transition-transform group-hover:-translate-y-0.5" />
            </div>
          </div>

          {/* Headline Typography */}
          <h2 className="text-lg sm:text-xl font-semibold text-zinc-100 tracking-tight mb-1 group-hover:text-white transition-colors">
            {isDragOver
              ? pairedDevice
                ? `Release to send to ${pairedDevice.deviceName}`
                : 'Release files to transfer'
              : pairedDevice
              ? `Send files to ${pairedDevice.deviceName}`
              : 'Drop files here to transfer'}
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-6">
            Direct peer-to-peer stream • Zero duplicate disk storage • Unlimited file size
          </p>

          {/* Tactile Primary Action Triggers */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-5 py-2.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] font-semibold text-xs tracking-tight transition-all shadow-sm flex items-center space-x-2"
            >
              <FilePlus2 className="w-4 h-4 text-zinc-900" />
              <span>Select Files</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="px-4 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] hover:border-white/[0.2] active:scale-[0.98] text-zinc-200 hover:text-white font-medium text-xs transition-all shadow-sm flex items-center space-x-2"
            >
              <FolderPlus className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
              <span>Folder</span>
            </button>
          </div>

          {/* Tactile Clipboard Paste Micro-Pill */}
          <div className="mt-8 flex items-center space-x-2 text-[11px] text-zinc-500 font-mono bg-white/[0.03] px-3 py-1 rounded-full border border-white/[0.06] shadow-sm pointer-events-none">
            <Clipboard className="w-3 h-3 text-zinc-400" />
            <span>Tip: Press <kbd className="text-zinc-300 font-sans font-semibold">Ctrl+V</kbd> to paste files or screenshots</span>
          </div>
        </SpotlightCard>

        {/* RIGHT COLUMN: RECIPIENTS & CONNECT HUB */}
        <SpotlightCard className="md:col-span-5 lg:col-span-4 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <div className="flex items-center space-x-2">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-200 tracking-tight">Recipients</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-zinc-400 bg-white/[0.04] border border-white/[0.06]">
                  {activeDevices.length > 0 ? `${activeDevices.length} online` : 'Idle'}
                </span>
                {onSweepPeers && (
                  <button
                    type="button"
                    onClick={handleManualProbe}
                    disabled={isProbing}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                    title="Rescan local subnet for peers"
                  >
                    <RefreshCw className={`w-3 h-3 ${isProbing ? 'animate-spin text-zinc-200' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {/* Device List or Clean Empty State */}
            {activeDevices.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {activeDevices.map((device) => {
                  const isSelected = pairedDevice?.deviceId === device.deviceId;
                  const isHovered = hoveredDeviceId === device.deviceId;
                  const isMobile =
                    device.os?.toLowerCase().includes('android') ||
                    device.os?.toLowerCase().includes('ios') ||
                    device.deviceName?.toLowerCase().includes('phone');

                  return (
                    <button
                      key={device.deviceId}
                      type="button"
                      onClick={() => onSelectDevice(isSelected ? null : device)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (lastSoundDeviceIdRef.current !== device.deviceId) {
                          lastSoundDeviceIdRef.current = device.deviceId;
                          playMagneticSnap();
                        }
                        setHoveredDeviceId(device.deviceId);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        if (hoveredDeviceId === device.deviceId) {
                          setHoveredDeviceId(null);
                          lastSoundDeviceIdRef.current = null;
                        }
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHoveredDeviceId(null);
                        lastSoundDeviceIdRef.current = null;
                        playDropLatch();
                        if (e.dataTransfer) {
                          try {
                            const result = await processDroppedData(e.dataTransfer);
                            if (result && result.file) {
                              if (onDropOnDevice) {
                                onDropOnDevice(device, result.file);
                              } else {
                                onSelectDevice(device);
                                onFileSelected(result.file);
                              }
                              return;
                            }
                          } catch {}
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            if (onDropOnDevice) {
                              onDropOnDevice(device, e.dataTransfer.files[0]);
                            } else {
                              onSelectDevice(device);
                              onFileSelected(e.dataTransfer.files[0]);
                            }
                          }
                        }
                      }}
                      className={`w-full p-2.5 rounded-lg border text-left spring-transition flex items-center justify-between group active:scale-[0.98] ${
                        isHovered
                          ? 'bg-emerald-500/10 border-emerald-400/80 text-white shadow-lg ring-2 ring-emerald-400/30 scale-[1.03]'
                          : isSelected
                          ? 'bg-white/[0.08] border-white/40 text-white shadow-sm ring-1 ring-white/20'
                          : 'bg-obsidian-base hover:bg-obsidian-hover border-white/[0.06] hover:border-white/[0.16] text-zinc-300'
                      }`}
                      title={isHovered ? `Drop to send directly to ${device.deviceName}` : `Select ${device.deviceName}`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                            isHovered
                              ? 'bg-emerald-400 text-zinc-950 border-emerald-400 shadow-md'
                              : isSelected
                              ? 'bg-white text-zinc-950 border-white'
                              : 'bg-white/[0.04] text-zinc-400 border-white/[0.06] group-hover:text-zinc-200'
                          }`}
                        >
                          {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 truncate group-hover:text-white">
                            {device.deviceName}
                          </div>
                          <div className="text-[10.5px] text-zinc-500 font-mono truncate">
                            {device.ip || 'Nearby LAN'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center space-x-1">
                        {isHovered ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 animate-pulse">
                            Release to Send
                          </span>
                        ) : isSelected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                            Selected
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Beam →
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* CLEAN EMPTY STATE (NO CLUMSY NUMBERED IP INSTRUCTIONS!) */
              <div className="p-4 rounded-lg bg-obsidian-base border border-white/[0.06] space-y-2 text-center my-2">
                <p className="text-xs font-medium text-zinc-300">
                  No other devices detected yet
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Open Orbit on any nearby laptop or phone on this network to transfer instantly.
                </p>
              </div>
            )}
          </div>

          {/* Quick Connect Actions (QR, Copy Link, Pair Code) */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-0.5">
              Connect Another Device
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* Copy Sharing Link */}
              <button
                type="button"
                onClick={onCopyUrl}
                className="py-2 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] text-xs font-medium text-zinc-300 hover:text-white transition-all flex items-center justify-center space-x-1.5 shadow-sm active:scale-95"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              {/* QR Code Trigger */}
              <button
                type="button"
                onClick={onToggleQr}
                className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 ${
                  showQr
                    ? 'bg-white text-zinc-950 border-white'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] hover:border-white/[0.16] text-zinc-300 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Phone QR</span>
              </button>
            </div>

            {/* 6-Digit Pair Code */}
            <button
              type="button"
              onClick={() => onOpenPairing('join')}
              className="w-full py-1.5 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors text-xs flex items-center justify-center space-x-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-zinc-500" />
              <span>Enter 6-Digit Pair Code</span>
            </button>
          </div>
        </SpotlightCard>
      </div>

      {/* ============================================================ */}
      {/* 3. EXPANDABLE PHONE QR CARD (CLEAN OVERLAY)                  */}
      {/* ============================================================ */}
      {showQr && (
        <div className="w-full max-w-sm mx-auto p-5 rounded-2xl bg-obsidian-card border border-white/[0.12] shadow-2xl animate-fade-in relative space-y-3 mt-2">
          <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-semibold text-zinc-200">
                Scan with Phone Camera
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleQr}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex justify-center py-2">
            <div className="p-3 bg-white rounded-xl shadow-xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  directPairingUrl || activeSharingUrl
                )}&bgcolor=ffffff&color=0b0c10&margin=0&qzone=1`}
                alt="Auto-Connect QR Code"
                width={180}
                height={180}
                className="w-40 h-40 rounded-lg block"
              />
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 text-center">
            Scan to pair phone immediately without typing addresses.
          </p>
        </div>
      )}
    </div>
  );
}
