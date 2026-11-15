'use client';

import React, { useRef, useState } from 'react';
import { DeviceInfo } from '@sharelan/protocol';
import {
  Laptop,
  Smartphone,
  UploadCloud,
  Zap,
  Sparkles,
  Check,
  Send,
  Plus,
  QrCode,
} from 'lucide-react';

interface SpatialRadarProps {
  clientName: string;
  pairedDevice: DeviceInfo | null;
  nearbyDevices: DeviceInfo[];
  onFileSelected: (file: File) => void;
  onSelectDevice: (device: DeviceInfo) => void;
  onDropOnDevice?: (device: DeviceInfo, file: File) => void;
  onOpenQr?: () => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function SpatialRadar({
  clientName,
  pairedDevice,
  nearbyDevices,
  onFileSelected,
  onSelectDevice,
  onDropOnDevice,
  onOpenQr,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: SpatialRadarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOverDeviceId, setDragOverDeviceId] = useState<string | null>(null);

  // Exclude self from nearby devices list
  const activeDevices = nearbyDevices.filter(
    (d) => d.deviceName !== clientName
  );

  // If paired device is not in nearby devices, include it in the orbit
  const orbitDevices: (DeviceInfo & { isPaired?: boolean })[] = pairedDevice
    ? [
        { ...pairedDevice, isPaired: true },
        ...activeDevices.filter((d) => d.deviceId !== pairedDevice.deviceId),
      ]
    : activeDevices;

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
      className="relative w-full max-w-xl mx-auto h-[440px] sm:h-[480px] flex items-center justify-center select-none overflow-hidden"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* ============================================================ */}
      {/* 1. AMBIENT RADAR RINGS & RIPPLES                             */}
      {/* ============================================================ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Outer Ring */}
        <div
          className={`w-[420px] h-[420px] sm:w-[460px] sm:h-[460px] rounded-full border border-white/[0.04] transition-all duration-500 ${
            isDragOver ? 'border-cyan-500/25 scale-[1.02]' : ''
          }`}
        />

        {/* Middle Ring */}
        <div
          className={`w-[300px] h-[300px] sm:w-[330px] sm:h-[330px] rounded-full border border-white/[0.07] transition-all duration-500 ${
            isDragOver ? 'border-cyan-500/35 scale-[1.03]' : ''
          }`}
        />

        {/* Inner Ring */}
        <div
          className={`w-[190px] h-[190px] sm:w-[210px] sm:h-[210px] rounded-full border border-cyan-500/15 transition-all duration-500 ${
            isDragOver ? 'border-cyan-400/50 bg-cyan-500/10 scale-105' : ''
          }`}
        />

        {/* Animated Expanding Ripples */}
        <div className="absolute w-44 h-44 rounded-full border border-cyan-400/30 animate-radar-1" />
        <div className="absolute w-44 h-44 rounded-full border border-blue-400/25 animate-radar-2" />
        <div className="absolute w-44 h-44 rounded-full border border-teal-400/20 animate-radar-3" />

        {/* Radar Rotating Sweep Line */}
        <div className="absolute w-[360px] h-[360px] rounded-full pointer-events-none opacity-25">
          <div className="w-full h-full rounded-full bg-gradient-to-tr from-cyan-500/25 via-transparent to-transparent animate-spin [animation-duration:12s]" />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. ORBITING PEER BUBBLES                                     */}
      {/* ============================================================ */}
      {orbitDevices.length > 0 ? (
        orbitDevices.map((device, index) => {
          // Calculate angular positions around the circle
          const total = orbitDevices.length;
          // Offset angles: distribute evenly around the perimeter
          const angleDeg = -45 + (index * (360 / Math.max(total, 3)));
          const angleRad = (angleDeg * Math.PI) / 180;
          const radius = typeof window !== 'undefined' && window.innerWidth < 640 ? 135 : 155;
          const x = Math.round(Math.cos(angleRad) * radius);
          const y = Math.round(Math.sin(angleRad) * radius);

          const isMobile =
            device.os?.toLowerCase().includes('android') ||
            device.os?.toLowerCase().includes('ios') ||
            device.deviceName?.toLowerCase().includes('phone');

          const isTargetedByDrag = dragOverDeviceId === device.deviceId;

          return (
            <div
              key={device.deviceId}
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              className={`absolute z-20 transition-all duration-500 ${
                index % 2 === 0 ? 'animate-float-1' : 'animate-float-2'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDevice(device)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverDeviceId(device.deviceId);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOverDeviceId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverDeviceId(null);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    if (onDropOnDevice) {
                      onDropOnDevice(device, e.dataTransfer.files[0]);
                    } else {
                      onSelectDevice(device);
                      onFileSelected(e.dataTransfer.files[0]);
                    }
                  }
                }}
                className={`group relative p-2.5 sm:p-3 rounded-2xl border shadow-xl backdrop-blur-xl transition-all duration-300 flex items-center space-x-2.5 active:scale-95 ${
                  isTargetedByDrag
                    ? 'scale-110 ring-4 ring-cyan-400 bg-cyan-500/30 border-cyan-400 shadow-cyan-500/50'
                    : device.isPaired
                    ? 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25 shadow-emerald-500/10 hover:scale-105'
                    : 'bg-surface-100/90 border-cyan-500/30 hover:border-cyan-400 hover:bg-surface-200/90 shadow-cyan-500/10 hover:scale-105'
                }`}
                title={isTargetedByDrag ? `Drop to send to ${device.deviceName}` : `Click to select ${device.deviceName}`}
              >
                {/* Glowing status dot */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      device.isPaired || isTargetedByDrag ? 'bg-emerald-400' : 'bg-cyan-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      device.isPaired || isTargetedByDrag ? 'bg-emerald-500' : 'bg-cyan-500'
                    }`}
                  />
                </span>

                {/* Device Icon */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-inner ${
                    device.isPaired || isTargetedByDrag
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-cyan-500/15 text-cyan-300 group-hover:bg-cyan-500/25'
                  }`}
                >
                  {isMobile ? (
                    <Smartphone className="w-4 h-4" />
                  ) : (
                    <Laptop className="w-4 h-4" />
                  )}
                </div>

                {/* Device Name Label */}
                <div className="text-left pr-1">
                  <p className="text-xs font-bold text-white tracking-tight truncate max-w-[100px] sm:max-w-[120px]">
                    {device.deviceName}
                  </p>
                  <p className="text-[10px] text-cyan-300/80 font-mono flex items-center space-x-1">
                    <Zap className="w-2.5 h-2.5 text-amber-400 inline" />
                    <span>
                      {isTargetedByDrag
                        ? 'Drop to Send'
                        : device.isPaired
                        ? 'Connected'
                        : 'Tap to Pair'}
                    </span>
                  </p>
                </div>
              </button>
            </div>
          );
        })
      ) : (
        /* Empty Radar Orbit Message */
        <div className="absolute top-6 sm:top-8 flex flex-col items-center text-center animate-fade-in z-10 px-4">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-surface-100/80 border border-white/5 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-medium text-slate-300">
              Scanning local Wi-Fi for devices...
            </span>
          </div>
          {onOpenQr && (
            <button
              onClick={onOpenQr}
              type="button"
              className="mt-2 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center space-x-1 transition-colors"
            >
              <QrCode className="w-3 h-3" />
              <span>Connect phone via QR code</span>
            </button>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. CENTER HERO CORE ("YOU" / THE DROP PORTAL)                */}
      {/* ============================================================ */}
      <div className="relative z-30">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`relative w-36 h-36 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center text-center p-4 transition-all duration-300 group shadow-2xl ${
            isDragOver
              ? 'scale-110 bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 shadow-cyan-500/40 ring-4 ring-cyan-300/50'
              : 'bg-gradient-to-b from-surface-100 via-surface-50 to-surface-100 border-2 border-cyan-500/40 hover:border-cyan-400 hover:scale-[1.03] shadow-cyan-500/15'
          }`}
        >
          {/* Pulsing ambient aura */}
          <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />

          {/* Central Icon */}
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-1.5 group-hover:scale-110 group-hover:bg-cyan-500/25 transition-all shadow-inner">
            <UploadCloud
              className={`w-6 h-6 transition-colors ${
                isDragOver ? 'text-white animate-bounce' : 'text-cyan-300'
              }`}
            />
          </div>

          {/* Typography */}
          <span className="text-xs font-bold text-white tracking-tight uppercase group-hover:text-cyan-200">
            {isDragOver ? 'Release File' : 'Drop File'}
          </span>
          <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-300">
            or click to browse
          </span>

          {/* Device identity tag */}
          <div className="mt-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[9px] font-mono text-cyan-300/90 truncate max-w-[120px]">
            {clientName}
          </div>
        </button>
      </div>
    </div>
  );
}
