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
import { copyTextToClipboard } from '../lib/clipboard';
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

  const handleCopy = async () => {
    if (!generatedCode) return;
    const ok = await copyTextToClipboard(generatedCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-xl bg-obsidian-card border border-white/[0.08] p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-300">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">6-Digit Code Pairing</h3>
              <p className="text-xs text-zinc-400">Direct link across isolated networks & subnets</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 p-0.5 bg-black/40 rounded-lg border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`py-1.5 text-xs font-medium rounded-md transition-all ${
              tab === 'create'
                ? 'bg-white/[0.1] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Show My Code
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-1.5 text-xs font-medium rounded-md transition-all ${
              tab === 'join'
                ? 'bg-white/[0.1] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Enter 6-Digit Code
          </button>
        </div>

        {/* Tab 1: Create / Show Code */}
        {tab === 'create' && (
          <div className="space-y-4 text-center">
            <div className="p-5 rounded-lg bg-obsidian-base border border-white/[0.06] space-y-2.5">
              <span className="text-[11px] font-medium text-zinc-500 block uppercase tracking-wider">
                Pairing Code
              </span>

              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  <span className="text-xs text-zinc-400">Generating code...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-3">
                  <span className="font-mono text-2xl font-bold text-white tracking-widest">
                    {generatedCode || '--- ---'}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors border border-white/[0.08]"
                    title="Copy code"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}

              <p className="text-[11px] text-zinc-500">
                Enter this 6-digit code on the other device to link directly.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 text-xs text-zinc-400">
              <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
              <span>Listening for incoming connection...</span>
            </div>
          </div>
        )}

        {/* Tab 2: Join / Enter Code */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-zinc-300">
                Enter 6-Digit Code from Peer
              </label>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="e.g. 482-195"
                maxLength={7}
                className="w-full px-3 py-2.5 rounded-lg bg-obsidian-base border border-white/[0.08] text-white placeholder-zinc-600 font-mono text-base text-center tracking-widest focus:outline-none focus:border-white/30"
                autoFocus
              />
            </div>

            {joinError && (
              <p className="text-xs text-rose-400 font-medium bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 text-left">
                {joinError}
              </p>
            )}

            <button
              type="submit"
              disabled={isJoining || !inputCode.trim()}
              className="w-full py-2.5 rounded-lg bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-all flex items-center justify-center space-x-1.5 disabled:opacity-40 shadow-sm"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Connect & Pair</span>
              )}
            </button>
          </form>
        )}

        {/* Security & Transport Note */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center space-x-2 text-[11px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80 flex-shrink-0" />
          <span>
            Zero-Disk in-memory stream activates automatically if network AP isolation blocks direct LAN packets.
          </span>
        </div>
      </div>
    </div>
  );
};
