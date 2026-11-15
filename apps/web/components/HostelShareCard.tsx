import React, { useState } from 'react';
import { Globe, Copy, Check, QrCode, ExternalLink, Loader2, Sparkles, ShieldCheck } from 'lucide-react';

interface HostelShareCardProps {
  publicTunnelUrl?: string;
  localIp: string;
  port: number;
}

export const HostelShareCard: React.FC<HostelShareCardProps> = ({
  publicTunnelUrl,
  localIp,
  port,
}) => {
  const [copied, setCopied] = useState(false);

  const activeUrl = publicTunnelUrl || `http://${localIp}:${port}`;
  const isTunnelActive = !!publicTunnelUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-3xl bg-surface-50/90 border border-cyan-500/25 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                ShareLAN Web Link
              </h4>
              {isTunnelActive ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Hostel Wi-Fi Ready</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>Connecting Tunnel...</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Open this link on the other laptop or phone to send/receive files
            </p>
          </div>
        </div>
      </div>

      {/* URL Display & Action Bar */}
      <div className="flex items-center space-x-2 p-2 rounded-2xl bg-surface-200 border border-white/10">
        <div className="flex-1 min-w-0 px-2">
          <span className="block font-mono text-xs text-cyan-300 truncate select-all">
            {activeUrl}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-all flex items-center space-x-1.5 shadow-md shadow-cyan-500/20 active:scale-95"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        <a
          href={activeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Explanation for why this works on hostel Wi-Fi */}
      <div className="flex items-start space-x-2 text-[11px] text-slate-400 pt-0.5">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <span>
          {isTunnelActive
            ? 'Works on any device! Because hostel routers block local IPs (10.x.x.x), this secure HTTPS link routes through Cloudflare edge so the other person can open the site effortlessly.'
            : 'Hostel Wi-Fi AP-isolation blocks local IPs. Creating a secure outbound public link so the other person can open ShareLAN.'}
        </span>
      </div>
    </div>
  );
};
