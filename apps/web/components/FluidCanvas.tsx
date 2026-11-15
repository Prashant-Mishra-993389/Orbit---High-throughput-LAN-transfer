'use client';

import React, { useRef, useState } from 'react';
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
  X,
  Wifi,
  FilePlus2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { QrCodeCard } from './QrCodeCard';

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
}: FluidCanvasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);

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
        className="hidden"
      />

      {/* ============================================================ */}
      {/* 1. TOP AMBIENT STATUS PILL (CALM & MINIMAL)                   */}
      {/* ============================================================ */}
      <div className="w-full flex items-center justify-center pt-1 z-20">
        {pairedDevice ? (
          <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 backdrop-blur-xl shadow-lg shadow-emerald-500/5 animate-fade-in">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-xs font-medium text-emerald-300">
              Connected to <strong className="text-warm-bone font-semibold">{pairedDevice.deviceName}</strong>
            </span>
            <button
              onClick={() => onSelectDevice(null)}
              className="p-1 rounded-full text-warm-sand hover:text-rose-400 hover:bg-white/10 transition-colors"
              title="Disconnect"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-obsidian-card/70 border border-white/[0.06] backdrop-blur-md shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-warm-sand font-medium">
              Local Wi-Fi Active
            </span>
            <span className="text-white/20">•</span>
            <span className="text-xs text-warm-sand/80">
              {activeDevices.length > 0
                ? `${activeDevices.length} ${activeDevices.length === 1 ? 'peer' : 'peers'} nearby`
                : 'Ready to connect'}
            </span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. CENTER STAGE: MAGNETIC PEERS & THE DROP PORTAL             */}
      {/* ============================================================ */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-6 space-y-6 z-10">
        {/* Discovered Peer Constellation (Tactile Rounded Pebble Cards) */}
        {activeDevices.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md mx-auto animate-fade-in px-4">
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
                  className={`group relative px-3.5 py-2 rounded-2xl border transition-all duration-200 flex items-center space-x-2.5 active:scale-95 ${
                    isHovered
                      ? 'scale-105 bg-emerald-500/20 border-emerald-400 ring-4 ring-emerald-500/20 shadow-xl shadow-emerald-500/20'
                      : isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-warm-bone shadow-md'
                      : 'bg-obsidian-card/80 hover:bg-obsidian-hover border-white/[0.08] hover:border-white/[0.18] text-warm-sand hover:text-warm-bone shadow-sm'
                  }`}
                  title={isHovered ? `Drop to send to ${device.deviceName}` : `Beam to ${device.deviceName}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                      isSelected || isHovered
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-white/5 text-warm-sand group-hover:text-warm-bone'
                    }`}
                  >
                    {isMobile ? (
                      <Smartphone className="w-3.5 h-3.5" />
                    ) : (
                      <Laptop className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <span className="text-xs font-semibold tracking-tight truncate max-w-[120px]">
                    {device.deviceName}
                  </span>

                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* The Ethereal Drop Portal (Center Hero) */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`relative group cursor-pointer rounded-full transition-all duration-300 ease-out flex flex-col items-center justify-center text-center p-8 sm:p-12 ${
            isDragOver
              ? 'scale-110 bg-gradient-to-b from-emerald-500/25 via-obsidian-card/90 to-obsidian-void border-2 border-emerald-400 ring-8 ring-emerald-500/15 shadow-[0_0_60px_rgba(16,185,129,0.3)]'
              : 'w-64 h-64 sm:w-72 sm:h-72 bg-gradient-to-b from-obsidian-card/90 via-obsidian-base/80 to-obsidian-void border border-white/[0.08] hover:border-white/[0.2] hover:scale-[1.02] shadow-[0_20px_60px_rgba(0,0,0,0.6)]'
          }`}
        >
          {/* Subtle Ambient Halo */}
          <div
            className={`absolute inset-0 rounded-full transition-opacity duration-500 pointer-events-none ${
              isDragOver
                ? 'opacity-100 bg-emerald-500/15 blur-2xl'
                : 'opacity-0 group-hover:opacity-100 bg-cyan-500/10 blur-xl'
            }`}
          />

          {/* Floating Icon */}
          <div className="relative mb-3">
            <div
              className={`w-16 h-16 sm:w-18 sm:h-18 rounded-3xl flex items-center justify-center transition-all duration-300 ${
                isDragOver
                  ? 'bg-emerald-500 text-slate-950 scale-110 shadow-lg shadow-emerald-500/40'
                  : 'bg-white/[0.04] border border-white/[0.08] text-warm-bone group-hover:border-cyan-400/40 group-hover:text-cyan-300 group-hover:scale-105 shadow-inner'
              }`}
            >
              <UploadCloud
                className={`w-8 h-8 transition-transform ${
                  isDragOver ? 'animate-bounce text-slate-950' : 'group-hover:-translate-y-0.5'
                }`}
              />
            </div>
            {!isDragOver && (
              <span className="absolute -top-1 -right-1 p-1 rounded-full bg-cyan-400 text-slate-950 shadow-md">
                <Sparkles className="w-3 h-3" />
              </span>
            )}
          </div>

          {/* Headline Typography */}
          <h2 className="text-lg sm:text-xl font-bold text-warm-bone tracking-tight mb-1 group-hover:text-white transition-colors">
            {isDragOver ? 'Release to Beam' : 'Drop to Beam'}
          </h2>
          <p className="text-xs text-warm-sand max-w-[200px] leading-relaxed mb-4 group-hover:text-warm-bone/90">
            {isDragOver
              ? 'Zero-copy direct stream'
              : 'or click to browse from device'}
          </p>

          {/* Interactive Browse Pill */}
          <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] group-hover:bg-white/[0.12] border border-white/[0.06] group-hover:border-white/[0.15] text-[11px] font-semibold text-warm-bone transition-all shadow-sm">
            <FilePlus2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Select File</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. THE FLOATING ACTION CAPSULE DOCK (BOTTOM)                 */}
      {/* ============================================================ */}
      <div className="w-full flex flex-col items-center space-y-3 z-20">
        <div className="inline-flex items-center p-1.5 rounded-2xl bg-obsidian-card/90 border border-white/[0.08] backdrop-blur-2xl shadow-2xl space-x-1 sm:space-x-1.5">
          {/* QR Code Action Button */}
          <button
            type="button"
            onClick={onToggleQr}
            className={`flex items-center space-x-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              showQr
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 ring-2 ring-cyan-400/40'
                : 'text-warm-sand hover:text-warm-bone hover:bg-white/[0.06]'
            }`}
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>Connect Phone</span>
          </button>

          {/* Copy Link Action Button */}
          <button
            type="button"
            onClick={onCopyUrl}
            className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold text-warm-sand hover:text-warm-bone hover:bg-white/[0.06] transition-all"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-warm-sand" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {/* 6-Digit Code Action Button */}
          <button
            type="button"
            onClick={() => onOpenPairing('join')}
            className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold text-warm-sand hover:text-warm-bone hover:bg-white/[0.06] transition-all"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Pair Code</span>
          </button>

          <div className="w-[1px] h-4 bg-white/[0.08] mx-0.5" />

          {/* Network Diagnostics */}
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="p-2 rounded-xl text-warm-stone hover:text-cyan-400 hover:bg-white/[0.06] transition-all"
            title="Network Diagnostics & Speed Test"
          >
            <Zap className="w-4 h-4" />
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
