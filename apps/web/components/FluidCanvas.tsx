'use client';

import React, { useRef, useState } from 'react';
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
  Sparkles,
  X,
  FilePlus2,
  FolderPlus,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { packageFilesIntoTar, ScannedFile } from '../lib/folder';
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

  // Check if current network is a mobile phone hotspot
  const isHotspot = isHotspotSubnet(diagnostics?.localIp);

  // Exclude self from nearby devices list
  const activeDevices = nearbyDevices.filter(
    (d) => d.deviceName !== clientName
  );

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
      className="relative w-full min-h-[520px] sm:min-h-[560px] flex flex-col items-center justify-between py-2 select-none"
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
      {/* 1. TOP AMBIENT STATUS PILL (CALM & MINIMAL)                   */}
      {/* ============================================================ */}
      {/* ============================================================ */}
      {/* 1. TOP STATUS PILL: LOW-PROFILE CONNECTION INDICATOR         */}
      {/* ============================================================ */}
      <div className="w-full flex items-center justify-center pt-1 z-20">
        {pairedDevice ? (
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-medium text-emerald-300 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>
              Connected to <strong className="text-white font-medium">{pairedDevice.deviceName}</strong>
            </span>
            <span className="text-white/20">•</span>
            <span className="text-[11px] text-zinc-400 font-mono">Ready</span>
            <button
              onClick={() => onSelectDevice(null)}
              className="p-0.5 rounded text-zinc-400 hover:text-rose-400 transition-colors"
              title="Disconnect"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span>
              {isHotspot ? 'Phone Hotspot (Direct Link)' : 'Local Wi-Fi Network'}
            </span>
            <span className="text-white/20">•</span>
            <span className="text-[11px] text-zinc-400 font-mono">
              {activeDevices.length > 0
                ? `${activeDevices.length} ${activeDevices.length === 1 ? 'peer' : 'peers'} online`
                : isHotspot
                ? '~85+ MB/s'
                : 'Searching peers'}
            </span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. CENTER STAGE: PEERS & THE PRECISION DROP STAGE            */}
      {/* ============================================================ */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-6 space-y-6 z-10">
        {/* Hotspot Radar Scanner (When 0 peers detected) */}
        {activeDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-2 px-4 text-center animate-fade-in max-w-sm mx-auto w-full">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-md bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-300">
              <Radio className="w-3.5 h-3.5 text-zinc-400" />
              <span>Scanning network for nearby laptops...</span>
            </div>

            <div className="w-full p-4 rounded-xl bg-obsidian-card border border-white/[0.08] text-left space-y-2.5 shadow-sm">
              <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-200">
                <Laptop className="w-4 h-4 text-zinc-400" />
                <span>To connect another laptop:</span>
              </div>
              <ol className="text-xs text-zinc-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Connect both laptops to this Wi-Fi / Hotspot</li>
                <li>
                  Open Chrome on the second laptop and go to:
                  <div className="mt-1 flex items-center justify-between p-2 rounded-lg bg-obsidian-base border border-white/[0.08] font-mono text-zinc-200 text-xs select-all">
                    <span className="truncate mr-2">{activeSharingUrl || 'http://192.168.43.x:37821'}</span>
                    <button
                      type="button"
                      onClick={onCopyUrl}
                      className="shrink-0 px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 text-[11px] font-medium transition-all border border-white/[0.08]"
                    >
                      {copiedLink ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </li>
              </ol>
            </div>

            {onSweepPeers && (
              <button
                type="button"
                onClick={handleManualProbe}
                disabled={isProbing}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition-all border border-white/[0.08] active:scale-95"
              >
                <RefreshCw className={`w-3 h-3 text-zinc-400 ${isProbing ? 'animate-spin' : ''}`} />
                <span>{isProbing ? 'Scanning 254 IPs...' : 'Probe Subnet Now'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2.5 animate-fade-in w-full">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-zinc-400">
              Discovered Devices ({activeDevices.length}) — Click to Select
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto px-4">
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
                      setHoveredDeviceId(device.deviceId);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setHoveredDeviceId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHoveredDeviceId(null);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        if (onDropOnDevice) {
                          onDropOnDevice(device, e.dataTransfer.files[0]);
                        } else {
                          onSelectDevice(device);
                          onFileSelected(e.dataTransfer.files[0]);
                        }
                      }
                    }}
                    className={`group relative px-3.5 py-2 rounded-xl border transition-all duration-150 flex items-center space-x-2.5 active:scale-[0.98] ${
                      isHovered
                        ? 'bg-white/[0.12] border-white text-white shadow-lg'
                        : isSelected
                        ? 'bg-white/[0.08] border-white/40 text-white shadow-sm ring-1 ring-white/20'
                        : 'bg-obsidian-card hover:bg-obsidian-hover border-white/[0.08] hover:border-white/[0.18] text-zinc-300 hover:text-white shadow-sm'
                    }`}
                    title={isHovered ? `Drop to send to ${device.deviceName}` : `Select ${device.deviceName}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected || isHovered
                          ? 'bg-white text-zinc-950'
                          : 'bg-white/[0.04] text-zinc-400 group-hover:text-zinc-200 border border-white/[0.06]'
                      }`}
                    >
                      {isMobile ? (
                        <Smartphone className="w-3.5 h-3.5" />
                      ) : (
                        <Laptop className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="text-left">
                      <div className="text-xs font-medium tracking-tight truncate max-w-[120px] text-zinc-100">
                        {device.deviceName}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {device.ip || 'LAN Peer'}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* THE LINEAR-GRADE ARCHITECTURAL DROP STAGE (CENTER HERO)     */}
        {/* ============================================================ */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`relative group cursor-pointer w-full max-w-xl rounded-2xl transition-all duration-200 ease-out flex flex-col items-center justify-center text-center p-8 sm:p-12 border ${
            isDragOver
              ? 'bg-obsidian-hover border-white ring-2 ring-white/10 shadow-2xl scale-[1.01]'
              : 'bg-obsidian-card/80 hover:bg-obsidian-hover/60 border-white/[0.08] hover:border-white/[0.18] shadow-xl'
          }`}
        >
          {/* Subtle Corner Crosshairs (Linear/CAD precision detail) */}
          <span className="absolute top-3 left-3 w-1.5 h-1.5 border-t border-l border-white/20" />
          <span className="absolute top-3 right-3 w-1.5 h-1.5 border-t border-r border-white/20" />
          <span className="absolute bottom-3 left-3 w-1.5 h-1.5 border-b border-l border-white/20" />
          <span className="absolute bottom-3 right-3 w-1.5 h-1.5 border-b border-r border-white/20" />

          {/* Minimalist Icon Box */}
          <div className="relative mb-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                isDragOver
                  ? 'bg-white text-zinc-950 border-white shadow-lg'
                  : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 group-hover:text-zinc-100 group-hover:border-white/20'
              }`}
            >
              <UploadCloud className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
            </div>
          </div>

          {/* Headline Typography */}
          <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight mb-1 group-hover:text-white transition-colors">
            {isDragOver
              ? pairedDevice
                ? `Drop to send to ${pairedDevice.deviceName}`
                : 'Drop to transfer immediately'
              : pairedDevice
              ? `Send to ${pairedDevice.deviceName}`
              : 'Drop files or folders here'}
          </h2>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed mb-5">
            {pairedDevice
              ? 'High-throughput stream • 0 cloud bytes stored'
              : 'Direct peer-to-peer streaming • Saturated local bandwidth'}
          </p>

          {/* Interactive Browse Action Buttons */}
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/[0.18] text-xs font-medium text-zinc-200 hover:text-white transition-all shadow-sm active:scale-95"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200" />
              <span>Select File</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/[0.18] text-xs font-medium text-zinc-200 hover:text-white transition-all shadow-sm active:scale-95"
            >
              <FolderPlus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200" />
              <span>Folder</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. TACTILE TOOLBAR DOCK (BOTTOM)                             */}
      {/* ============================================================ */}
      <div className="w-full flex flex-col items-center space-y-3 z-20">
        <div className="inline-flex items-center p-1 rounded-xl bg-obsidian-card border border-white/[0.08] shadow-lg space-x-1">
          {/* QR Code Action Button */}
          <button
            type="button"
            onClick={onToggleQr}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showQr
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Connect Phone</span>
          </button>

          {/* Copy Link Action Button */}
          <button
            type="button"
            onClick={onCopyUrl}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-all"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {/* 6-Digit Code Action Button */}
          <button
            type="button"
            onClick={() => onOpenPairing('join')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-all"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Pair Code</span>
          </button>

          <div className="w-[1px] h-3.5 bg-white/[0.08] mx-0.5" />

          {/* Network Diagnostics */}
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-all"
            title="Network Diagnostics & Speed Test"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ============================================================ */}
        {/* 4. EXPANDABLE FLOATING QR CONNECT CARD                       */}
        {/* ============================================================ */}
        {showQr && (
          <div className="w-full max-w-sm p-5 rounded-3xl bg-obsidian-card/95 border border-white/[0.12] backdrop-blur-2xl shadow-2xl animate-fade-in relative space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-bold text-warm-bone uppercase tracking-wider">
                  Instant Camera Connect
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleQr}
                className="p-1 rounded-lg text-warm-sand hover:text-warm-bone hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-warm-sand text-center">
              Scan with your phone camera to pair instantly with zero typing.
            </p>

            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-2xl shadow-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    directPairingUrl || activeSharingUrl
                  )}&bgcolor=ffffff&color=0b0c10&margin=0&qzone=1`}
                  alt="Auto-Connect QR Code"
                  width={180}
                  height={180}
                  className="w-44 h-44 rounded-lg block"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                readOnly
                value={directPairingUrl || activeSharingUrl}
                className="flex-1 px-3 py-1.5 rounded-xl bg-obsidian-base border border-white/[0.08] font-mono text-[11px] text-cyan-300 select-all truncate"
              />
              <button
                type="button"
                onClick={onCopyUrl}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-xs shadow-sm flex items-center space-x-1"
              >
                {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
