import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  QrCode,
  Copy,
  Check,
  Loader2,
  Laptop,
  ShieldCheck,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import { createPairingSession, joinPairingSession } from '../lib/api';
import { DeviceInfo, PairingSession } from '@sharelan/protocol';

interface PairingModalProps {
  isOpen: boolean;
  initialTab?: 'create' | 'join';
  onClose: () => void;
  clientId: string;
  clientName: string;
  onDevicePaired: (device: DeviceInfo) => void;
  matchedPairingSession?: PairingSession | null;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  initialTab = 'create',
  onClose,
  clientId,
  clientName,
  onDevicePaired,
  matchedPairingSession,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>(initialTab);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync tab whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Join tab state
  const [inputCode, setInputCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Listen for matched session from WebSocket
  useEffect(() => {
    if (matchedPairingSession && matchedPairingSession.status === 'PAIRED') {
      const isHost = matchedPairingSession.hostClientId === clientId;
      const peerName = isHost
        ? matchedPairingSession.guestDeviceName || 'Paired Device'
        : matchedPairingSession.hostDeviceName;
      const peerIp = isHost
        ? matchedPairingSession.guestIp || '127.0.0.1'
        : matchedPairingSession.hostIp;
      const peerPort = isHost
        ? matchedPairingSession.guestPort || 37821
        : matchedPairingSession.hostPort;
      const peerId = isHost
        ? matchedPairingSession.guestClientId || 'guest-peer'
        : matchedPairingSession.hostClientId;

      onDevicePaired({
        deviceId: peerId,
        deviceName: peerName,
        ip: peerIp,
        port: peerPort,
        os: 'Desktop',
        protocolVersion: '1.0.0',
        capabilities: {
          protocolVersion: '1.0.0',
          transports: ['http-stream', 'relay'],
          hashAlgorithms: ['sha256'],
          resumable: true,
          maxChunkSize: 64 * 1024 * 1024,
        },
        pairingState: 'PAIRED',
        lastSeen: Date.now(),
      });
      onClose();
    }
  }, [matchedPairingSession, clientId, onDevicePaired, onClose]);

  // Generate code on open
  useEffect(() => {
    if (isOpen && tab === 'create' && !generatedCode) {
      handleGenerate();
    }
  }, [isOpen, tab]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const session = await createPairingSession(clientId, clientName);
      setGeneratedCode(session.code);
    } catch (err) {
      console.error('Failed to create pairing session:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputCode.trim();
    if (!cleanCode) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      const res = await joinPairingSession(cleanCode, clientId, clientName);
      if (res.success && res.session) {
        onDevicePaired({
          deviceId: res.session.hostClientId,
          deviceName: res.session.hostDeviceName,
          ip: res.session.hostIp,
          port: res.session.hostPort,
          os: 'Desktop',
          protocolVersion: '1.0.0',
          capabilities: {
            protocolVersion: '1.0.0',
            transports: ['http-stream', 'relay'],
            hashAlgorithms: ['sha256'],
            resumable: true,
            maxChunkSize: 64 * 1024 * 1024,
          },
          pairingState: 'PAIRED',
          lastSeen: Date.now(),
        });
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect with code';
      setJoinError(msg);
    } finally {
      setIsJoining(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-obsidian-card/95 border border-white/[0.08] p-6 shadow-2xl space-y-6 backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Out-of-Band Pairing</h3>
              <p className="text-xs text-slate-400">Works on Hostel Wi-Fi with client isolation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 p-1 bg-surface-200 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              tab === 'create'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Show My Code
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              tab === 'join'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Enter 6-Digit Code
          </button>
        </div>

        {/* Tab 1: Create / Show Code */}
        {tab === 'create' && (
          <div className="space-y-4 text-center">
            <div className="p-6 rounded-2xl bg-surface-100/60 border border-white/5 space-y-3">
              <span className="text-xs font-medium text-slate-400 block uppercase tracking-wider">
                Pairing Code
              </span>

              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2 py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  <span className="text-sm text-slate-300">Generating code...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-3">
                  <span className="font-mono text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-300 tracking-wider">
                    {generatedCode || '--- ---'}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                    title="Copy code"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Enter this 6-digit code on the other laptop to link directly.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 text-xs text-cyan-400/80 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Waiting for other laptop to connect...</span>
            </div>
          </div>
        )}

        {/* Tab 2: Join / Enter Code */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Enter 6-Digit Code from Peer
              </label>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="e.g. 482-195"
                maxLength={7}
                className="w-full px-4 py-3 rounded-2xl bg-surface-200 border border-white/10 text-white placeholder-slate-500 font-mono text-lg text-center tracking-widest focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                autoFocus
              />
            </div>

            {joinError && (
              <p className="text-xs text-rose-400 font-medium bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                {joinError}
              </p>
            )}

            <button
              type="submit"
              disabled={isJoining || !inputCode.trim()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm hover:from-blue-500 hover:to-cyan-400 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 shadow-lg shadow-cyan-500/20"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Connect & Pair</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Security & Transport Note */}
        <div className="pt-2 border-t border-white/5 flex items-center space-x-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400/70 flex-shrink-0" />
          <span>
            Zero-Disk Streaming Relay automatically activates if hostel AP isolation blocks LAN packets.
          </span>
        </div>
      </div>
    </div>
  );
};
