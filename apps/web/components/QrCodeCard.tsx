'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode, Smartphone, Sparkles } from 'lucide-react';

interface QrCodeCardProps {
  url: string;
  title?: string;
  subtitle?: string;
  size?: number;
  showCopy?: boolean;
}

export function QrCodeCard({
  url,
  title = 'Scan to Connect',
  subtitle = 'Point your phone camera to open in browser',
  size = 200,
  showCopy = true,
}: QrCodeCardProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, {
      width: size * 2, // 2x for retina sharpness
      margin: 2,
      color: {
        dark: '#090d16',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [url, size]);

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center p-5 rounded-3xl bg-surface-100/90 border border-white/10 shadow-2xl space-y-4 text-center backdrop-blur-md">
      <div className="space-y-1">
        <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-cyan-400 uppercase tracking-wider">
          <Smartphone className="w-3.5 h-3.5" />
          <span>{title}</span>
        </div>
        <p className="text-xs text-slate-400 max-w-xs">{subtitle}</p>
      </div>

      {/* QR Code Container with subtle glow */}
      <div className="relative group p-3.5 rounded-2xl bg-white shadow-xl shadow-cyan-500/10 transition-transform duration-300 hover:scale-[1.02]">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Scan QR Code"
            style={{ width: size, height: size }}
            className="rounded-xl block"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-slate-100 rounded-xl animate-pulse"
          >
            <QrCode className="w-8 h-8 text-slate-400" />
          </div>
        )}
      </div>

      {/* URL Display & Copy */}
      {showCopy && (
        <div className="w-full max-w-xs space-y-2">
          <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-surface-200 border border-white/5 text-xs font-mono text-cyan-300">
            <span className="truncate flex-1 text-left select-all">{url}</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center space-x-1 flex-shrink-0"
              title="Copy URL"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
