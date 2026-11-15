'use client';

import React, { useRef, useState, useEffect } from 'react';
import { DeviceInfo } from '@sharelan/protocol';
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
  Command,
  ArrowRight,
  X,
  Wifi,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';

interface DynamicIslandProps {
  clientName: string;
  activeSharingUrl: string;
  directPairingUrl: string;
  pairedDevice: DeviceInfo | null;
  nearbyDevices: DeviceInfo[];
  onSelectDevice: (device: DeviceInfo | null) => void;
  onFileSelected: (file: File) => void;
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
}

export function DynamicIsland({
  clientName,
  activeSharingUrl,
  directPairingUrl,
  pairedDevice,
  nearbyDevices,
  onSelectDevice,
  onFileSelected,
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
}: DynamicIslandProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quickCodeInput, setQuickCodeInput] = useState('');

  // Exclude self from nearby devices list
  const activeDevices = nearbyDevices.filter(
    (d) => d.deviceName !== clientName
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
      e.target.value = '';
    }
  };

  // Keyboard shortcut listener (Ctrl+O to open file picker, Ctrl+K to toggle QR)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggleQr();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleQr]);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center select-none animate-fade-in">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* ============================================================ */}
      {/* 1. THE DYNAMIC ISLAND CAPSULE                                 */}
      {/* ============================================================ */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`w-full rounded-[28px] transition-all duration-300 ease-out backdrop-blur-2xl border shadow-2xl relative overflow-hidden ${
          isDragOver
            ? 'scale-[1.02] bg-gradient-to-b from-surface-100/95 via-cyan-950/20 to-surface-100/95 border-cyan-400 ring-4 ring-cyan-500/20 shadow-cyan-500/20'
            : pairedDevice
            ? 'bg-surface-50/80 border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-500/5'
            : 'bg-surface-50/80 border-white/10 hover:border-cyan-500/30 hover:bg-surface-50/90 shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
        }`}
      >
        {/* Ambient Top Glow Line */}
        <div
          className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-500 ${
            isDragOver
              ? 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-100'
              : pairedDevice
              ? 'bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent opacity-80'
              : 'bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent opacity-50'
          }`}
        />

        {/* ============================================================ */}
        {/* A. CAPSULE HEADER BAR                                        */}
        {/* ============================================================ */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  pairedDevice ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  pairedDevice ? 'bg-emerald-500' : 'bg-cyan-500'
                }`}
              />
            </span>
            <span className="text-xs font-semibold tracking-wide text-slate-300">
              {pairedDevice ? (
                <span>
                  Connected to{' '}
                  <strong className="text-white font-bold">
                    {pairedDevice.deviceName}
                  </strong>
                </span>
              ) : (
                <span className="text-slate-400 font-medium">
                  Dynamic Island • Ready
                </span>
              )}
            </span>
            {pairedDevice && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDevice(null);
                }}
                className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors"
                title="Disconnect peer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Device IP Pill with 1-click Copy */}
          <button
            onClick={onCopyUrl}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] font-mono text-cyan-300 transition-all active:scale-95 group"
            title="Click to copy sharing URL"
          >
            <Wifi className="w-3 h-3 text-cyan-400 group-hover:animate-pulse" />
            <span className="truncate max-w-[120px] sm:max-w-none">
              {activeSharingUrl
                ? activeSharingUrl.replace(/^https?:\/\//, '')
                : '127.0.0.1'}
            </span>
            {copiedLink ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-slate-500 group-hover:text-cyan-400" />
            )}
          </button>
        </div>

        {/* ============================================================ */}
        {/* B. TACTILE DROP & BROWSE CORE                                */}
        {/* ============================================================ */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer group transition-all"
        >
          {/* Animated Hero Icon */}
          <div className="relative mb-3.5">
            <div
              className={`w-16 h-16 sm:w-18 sm:h-18 rounded-3xl flex items-center justify-center border transition-all duration-300 shadow-xl ${
                isDragOver
                  ? 'bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 border-cyan-300 scale-110 shadow-cyan-500/40 text-white'
                  : 'bg-gradient-to-tr from-blue-600/20 via-cyan-500/15 to-teal-400/10 border-white/10 group-hover:border-cyan-400/40 group-hover:scale-105 group-hover:shadow-cyan-500/20 text-cyan-400'
              }`}
            >
              <UploadCloud
                className={`w-8 h-8 transition-transform ${
                  isDragOver ? 'animate-bounce text-white' : 'group-hover:-translate-y-0.5'
                }`}
              />
            </div>
            <span className="absolute -top-1 -right-1 p-1 rounded-full bg-cyan-400 text-slate-950 shadow-md">
              <Sparkles className="w-3 h-3" />
            </span>
          </div>

          {/* Typography */}
          <h3 className="text-base sm:text-lg font-bold text-white mb-1 tracking-tight group-hover:text-cyan-200 transition-colors">
            {isDragOver ? 'Release to Beam File' : 'Drop any file to share'}
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed group-hover:text-slate-300">
            Streams zero-copy directly over local Wi-Fi. No uploads, no size limits.
          </p>

          {/* Action Pills & Hotkey Hint */}
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 group-hover:bg-cyan-500/20 text-xs font-semibold text-white border border-white/10 group-hover:border-cyan-500/30 transition-all shadow-sm">
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Browse Files</span>
            </span>
            <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-surface-200/60 border border-white/5 text-[10px] font-mono text-slate-400">
              <Command className="w-3 h-3 text-slate-500" />
              <span>O</span>
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* C. TARGET RECIPIENT SELECTOR BAR (RAYCAST PILL SELECTOR)     */}
        {/* ============================================================ */}
        <div className="px-5 py-3 bg-surface-100/50 border-t border-white/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0">
              Beam Target:
            </span>

            {/* Recipient Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
              {/* Broadcast / Any Receiver Pill */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDevice(null);
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all flex items-center space-x-1.5 flex-shrink-0 ${
                  !pairedDevice
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <span>Anyone via QR / Link</span>
              </button>

              {/* Online Wi-Fi Peer Pills */}
              {activeDevices.map((device) => {
                const isSelected = pairedDevice?.deviceId === device.deviceId;
                const isMobile =
                  device.os?.toLowerCase().includes('android') ||
                  device.os?.toLowerCase().includes('ios') ||
                  device.deviceName?.toLowerCase().includes('phone');

                return (
                  <button
                    key={device.deviceId}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDevice(isSelected ? null : device);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all flex items-center space-x-1.5 flex-shrink-0 ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    {isMobile ? (
                      <Smartphone className="w-3 h-3 text-cyan-400" />
                    ) : (
                      <Laptop className="w-3 h-3 text-cyan-400" />
                    )}
                    <span className="truncate max-w-[100px]">
                      {device.deviceName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discovered Peer Count Indicator */}
          {activeDevices.length > 0 && (
            <span className="text-[10px] font-mono text-emerald-400/80 flex-shrink-0 hidden sm:inline">
              {activeDevices.length} online
            </span>
          )}
        </div>

        {/* ============================================================ */}
        {/* D. RAYCAST COMMAND ACTION DOCK (BOTTOM PILL BAR)              */}
        {/* ============================================================ */}
        <div className="px-5 py-3 bg-surface-200/80 border-t border-white/[0.06] flex items-center justify-between text-xs">
          {/* Left Action Buttons */}
          <div className="flex items-center space-x-1.5">
            {/* QR Code Quick Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleQr();
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                showQr
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 ring-2 ring-cyan-400/40'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>QR Connect</span>
            </button>

            {/* Copy Share URL */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopyUrl();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 font-semibold transition-all active:scale-95"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            {/* 6-Digit Pairing Code */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPairing('join');
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 font-semibold transition-all active:scale-95"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Pair Code</span>
            </button>
          </div>

          {/* Right Speed Benchmark Button */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDiagnostics();
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-400 border border-white/5 transition-all"
              title="Network Speed & Diagnostics"
            >
              <Zap className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. FLOATING DYNAMIC QR CARD                                  */}
      {/* ============================================================ */}
      {showQr && (
        <div className="w-full max-w-sm mt-4 p-5 rounded-3xl bg-surface-100/95 border border-cyan-500/30 backdrop-blur-2xl shadow-2xl animate-fade-in relative space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Instant Auto-Connect QR
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleQr}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 text-center">
            Point any phone camera to connect immediately with zero typing.
          </p>

          <div className="flex justify-center py-2">
            <div className="p-3 bg-white rounded-2xl shadow-xl">
              {/* Retina QR Renderer */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  directPairingUrl || activeSharingUrl
                )}&bgcolor=ffffff&color=0b0f19&margin=0&qzone=1`}
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
              className="flex-1 px-3 py-1.5 rounded-xl bg-surface-200 border border-white/10 font-mono text-[11px] text-cyan-300 select-all truncate"
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
  );
}
