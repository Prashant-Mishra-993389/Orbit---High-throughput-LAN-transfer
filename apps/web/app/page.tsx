'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useShareLanWebSocket } from '../hooks/useShareLanWebSocket';
import { Navbar } from '../components/Navbar';
import { SpatialRadar } from '../components/SpatialRadar';
import { TransferCard, ActiveTransferState } from '../components/TransferCard';
import { IncomingTransferModal } from '../components/IncomingTransferModal';
import { NetworkDiagnosticsModal } from '../components/NetworkDiagnosticsModal';
import { PairingModal } from '../components/PairingModal';
import { OnboardingModal } from '../components/OnboardingModal';
import { SettingsModal } from '../components/SettingsModal';
import { InstantShareCard } from '../components/InstantShareCard';
import { ReceiverView } from '../components/ReceiverView';
import { QrCodeCard } from '../components/QrCodeCard';
import { playSuccessChime, playOfferChime } from '../lib/sound';
import {
  createTransferOffer,
  streamFileToBridge,
  streamFileToRelay,
  acceptTransferOffer,
  rejectTransferOffer,
  cancelTransfer,
  consumeIncomingStream,
  getServerBaseUrl,
  joinPairingSession,
  autoConnectPairing,
} from '../lib/api';
import { probeAndSelectTransport } from '../lib/connectivity';
import { DeviceInfo, TransferOffer, TransportMode } from '@sharelan/protocol';
import {
  Laptop,
  KeyRound,
  Check,
  RefreshCw,
  X,
  Zap,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  Loader2,
  FileCheck2,
  Copy,
  QrCode,
  Wifi,
  Sparkles,
} from 'lucide-react';
import { formatBytes } from '@sharelan/shared';

export default function Home() {
  const {
    session,
    isConnected,
    devices,
    incomingOffer,
    setIncomingOffer,
    acceptedOfferEvent,
    matchedPairingSession,
    pairedDevice,
    setPairedDevice,
    diagnostics,
    refreshState,
    transfers,
  } = useShareLanWebSocket();

  const [activeTransfer, setActiveTransfer] = useState<ActiveTransferState | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [pairingTab, setPairingTab] = useState<'create' | 'join'>('join');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showNetworkQr, setShowNetworkQr] = useState(false);
  const [isRadarDragOver, setIsRadarDragOver] = useState(false);

  // Drop-First instant staged share: when sender drops a file, an offer is pre-created immediately
  const [stagedShare, setStagedShare] = useState<{
    file: File;
    offer: TransferOffer;
  } | null>(null);

  // Stored reference to the pending file on sender for live streaming
  const pendingFileRef = useRef<{
    file: File;
    transferId: string;
    transportMode: TransportMode;
    relaySessionId?: string;
  } | null>(null);

  const handleOpenPairing = (tab: 'create' | 'join' = 'join') => {
    setPairingTab(tab);
    setIsPairingOpen(true);
  };

  // Canonical active network sharing URL
  const activeSharingUrl =
    diagnostics?.publicTunnelUrl ||
    (diagnostics && diagnostics.localIp && diagnostics.localIp !== '127.0.0.1'
      ? `http://${diagnostics.localIp}:${diagnostics.port}`
      : typeof window !== 'undefined'
      ? window.location.origin
      : '');

  // Direct auto-pairing URL embedded in QR codes and share links
  const directPairingUrl =
    activeSharingUrl && session.clientId && session.clientId !== 'client-pending'
      ? `${activeSharingUrl}${activeSharingUrl.includes('?') ? '&' : '?'}pairHostId=${session.clientId}&pairHostName=${encodeURIComponent(session.clientName)}`
      : activeSharingUrl;

  const handleCopyShareLink = () => {
    const url = directPairingUrl || activeSharingUrl || (typeof window !== 'undefined' ? window.location.href : '');
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Auto-pair when exactly 1 other peer is discovered on the local network
  useEffect(() => {
    if (!pairedDevice && devices.length === 1 && devices[0].deviceId !== session.clientId) {
      setPairedDevice(devices[0]);
    }
  }, [devices, pairedDevice, session.clientId]);

  // Audio cue when an incoming offer arrives
  useEffect(() => {
    if (incomingOffer && incomingOffer.status === 'OFFERED') {
      playOfferChime();
    }
  }, [incomingOffer]);

  // Audio cue on transfer completion
  useEffect(() => {
    if (activeTransfer?.status === 'COMPLETED') {
      playSuccessChime();
    }
  }, [activeTransfer?.status]);

  // Instant QR Code Auto-Connect: Connects guest and host automatically upon scanning
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pairHostId = params.get('pairHostId');
    const pairHostName = params.get('pairHostName');
    const pairCode = params.get('pairCode');

    if (pairHostId && pairHostId !== session.clientId && !pairedDevice) {
      autoConnectPairing({
        hostClientId: pairHostId,
        guestClientId: session.clientId,
        guestDeviceName: session.clientName,
        hostDeviceName: pairHostName ? decodeURIComponent(pairHostName) : undefined,
      })
        .then((res) => {
          if (res.success && res.session) {
            setPairedDevice({
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
            playSuccessChime();
          }
        })
        .catch((err) => console.warn('Auto-pair error:', err));
    } else if (pairCode && !pairedDevice) {
      joinPairingSession(pairCode, session.clientId, session.clientName)
        .then((res) => {
          if (res.success && res.session) {
            playSuccessChime();
          }
        })
        .catch((err) => console.warn('Pair code error:', err));
    }
  }, [session.clientId, session.clientName, pairedDevice]);

  // Check URL query parameters: If someone scans a QR code with ?offerId=xxx, auto-connect to that offer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requestedOfferId = params.get('offerId');
    if (requestedOfferId && !incomingOffer && !activeTransfer) {
      fetch(`${getServerBaseUrl()}/api/transfers/offers`)
        .then((res) => res.json())
        .then((offers: TransferOffer[]) => {
          const found = offers.find(
            (o) => o.transferId === requestedOfferId && o.status === 'OFFERED'
          );
          if (found) {
            setIncomingOffer(found);
            playOfferChime();
          }
        })
        .catch(() => {});
    }
  }, [incomingOffer, activeTransfer]);

  /**
   * DROP-FIRST, SHARE-INSTANT WORKFLOW:
   * The moment user drops/picks a file, we create the transfer offer on the server
   * and show the InstantShareCard with dynamic QR code & 1-click peer targets!
   */
  const handleDropFirstFile = useCallback(
    async (file: File) => {
      setIsSending(true);

      try {
        let transportMode: TransportMode = 'DIRECT_LAN';

        if (pairedDevice) {
          const probe = await probeAndSelectTransport(pairedDevice.ip, pairedDevice.port);
          transportMode = probe.selectedTransport;
        }

        const offer = await createTransferOffer({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          senderClientId: session.clientId,
          senderDeviceName: session.clientName,
          targetDeviceId: pairedDevice?.deviceId,
          targetClientId: pairedDevice?.deviceId,
          transportMode,
        });

        pendingFileRef.current = {
          file,
          transferId: offer.transferId,
          transportMode,
          relaySessionId: offer.relaySessionId || offer.transferId,
        };

        setStagedShare({ file, offer });
      } catch (err: unknown) {
        console.error('Instant share offer error:', err);
      } finally {
        setIsSending(false);
      }
    },
    [pairedDevice, session]
  );

  const handleRadarDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsRadarDragOver(true);
  }, []);

  const handleRadarDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsRadarDragOver(false);
  }, []);

  const handleRadarDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsRadarDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleDropFirstFile(e.dataTransfer.files[0]);
      }
    },
    [handleDropFirstFile]
  );

  /**
   * SENDER LISTENER:
   * Triggers ONLY when recipient accepts.
   * Reads original file directly and streams on-the-fly.
   * ZERO duplicate file created on sender!
   */
  useEffect(() => {
    if (
      acceptedOfferEvent &&
      pendingFileRef.current &&
      acceptedOfferEvent.transferId === pendingFileRef.current.transferId
    ) {
      const { file, transferId, transportMode, relaySessionId } = pendingFileRef.current;
      const receiverName = acceptedOfferEvent.receiverDeviceName || 'Recipient';

      // Clear staged share and move directly into active transfer
      setStagedShare(null);

      setActiveTransfer({
        transferId,
        role: 'sender',
        fileName: file.name,
        fileSize: file.size,
        peerName: receiverName,
        status: 'TRANSFERRING',
        transportMode,
        bytesTransferred: 0,
        percentage: 0,
        currentSpeed: 0,
        averageSpeed: 0,
        etaSeconds: 0,
      });

      // Stream directly into zero-disk stream pipe (Relay or StreamBridge)
      const streamPromise =
        transportMode === 'RELAY_STREAM'
          ? streamFileToRelay(relaySessionId || transferId, file, (loaded, total) => {
              setActiveTransfer((prev) =>
                prev && prev.transferId === transferId
                  ? {
                      ...prev,
                      bytesTransferred: loaded,
                      percentage: total > 0 ? (loaded / total) * 100 : 0,
                    }
                  : prev
              );
            })
          : streamFileToBridge(transferId, file, (loaded, total) => {
              setActiveTransfer((prev) =>
                prev && prev.transferId === transferId
                  ? {
                      ...prev,
                      bytesTransferred: loaded,
                      percentage: total > 0 ? (loaded / total) * 100 : 0,
                    }
                  : prev
              );
            });

      streamPromise
        .then((res) => {
          setActiveTransfer((prev) =>
            prev && prev.transferId === transferId
              ? {
                  ...prev,
                  status: 'COMPLETED',
                  percentage: 100,
                  bytesTransferred: file.size,
                  finalHash: res.finalHash,
                }
              : prev
          );
        })
        .catch((err) => {
          console.error('Streaming error:', err);
          setActiveTransfer((prev) =>
            prev && prev.transferId === transferId
              ? { ...prev, status: 'FAILED', error: err.message }
              : prev
          );
        })
        .finally(() => {
          pendingFileRef.current = null;
        });
    }
  }, [acceptedOfferEvent]);

  // Sync transfer progress to Windows Taskbar in desktop mode
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setTaskbarProgress) {
      if (activeTransfer && activeTransfer.status === 'TRANSFERRING') {
        const prog = Math.min(Math.max((activeTransfer.percentage || 0) / 100, 0), 1);
        (window as any).electronAPI.setTaskbarProgress(prog);
      } else {
        (window as any).electronAPI.setTaskbarProgress(-1);
      }
    }
  }, [activeTransfer?.status, activeTransfer?.percentage]);

  /**
   * RECIPIENT WORKFLOW:
   * Recipient clicks Accept & Save -> stream starts live directly into recipient device.
   * ZERO bytes stored on server or sender!
   */
  const handleAcceptOffer = async (offer: TransferOffer, fileHandle?: any) => {
    try {
      await acceptTransferOffer(offer.transferId, {
        receiverClientId: session.clientId,
        receiverDeviceName: session.clientName,
      });

      const isRelay = offer.transportMode === 'RELAY_STREAM';

      setActiveTransfer({
        transferId: offer.transferId,
        role: 'receiver',
        fileName: offer.fileName,
        fileSize: offer.fileSize,
        peerName: offer.senderDeviceName,
        status: 'TRANSFERRING',
        transportMode: offer.transportMode || 'DIRECT_LAN',
        bytesTransferred: 0,
        percentage: 0,
        currentSpeed: 0,
        averageSpeed: 0,
        etaSeconds: 0,
      });

      setIncomingOffer(null);

      // Connect to the live stream pipe and save directly on recipient machine
      let streamUrl: string;
      if (isRelay) {
        streamUrl = `${getServerBaseUrl()}/api/relay/${offer.relaySessionId || offer.transferId}/stream`;
      } else {
        const targetHost =
          offer.senderIp && offer.senderPort
            ? `http://${offer.senderIp}:${offer.senderPort}`
            : getServerBaseUrl();
        streamUrl = `${targetHost}/api/transfers/${offer.transferId}/live-pipe`;
      }

      consumeIncomingStream(
        streamUrl,
        offer.fileName,
        (loaded) => {
          setActiveTransfer((prev) =>
            prev && prev.transferId === offer.transferId
              ? {
                  ...prev,
                  bytesTransferred: loaded,
                  percentage: offer.fileSize > 0 ? (loaded / offer.fileSize) * 100 : 0,
                }
              : prev
          );
        },
        fileHandle
      )
        .then((result) => {
          if (fileHandle) {
            setActiveTransfer((prev) =>
              prev && prev.transferId === offer.transferId
                ? {
                    ...prev,
                    status: 'COMPLETED',
                    percentage: 100,
                    bytesTransferred: offer.fileSize,
                    finalHash: result.calculatedHash,
                  }
                : prev
            );
          }
        })
        .catch((err) => {
          console.error('Receiver stream error:', err);
          setActiveTransfer((prev) =>
            prev && prev.transferId === offer.transferId
              ? { ...prev, status: 'FAILED', error: err.message || 'Stream connection failed' }
              : prev
          );
        });
    } catch (err) {
      console.error('Failed to accept transfer offer:', err);
    }
  };

  const handleRejectOffer = async (offer: TransferOffer) => {
    try {
      await rejectTransferOffer(offer.transferId, 'User declined');
    } catch {}
    setIncomingOffer(null);
  };

  const handleCancelTransfer = async (transferId: string) => {
    try {
      await cancelTransfer(transferId);
      setActiveTransfer((prev) =>
        prev && prev.transferId === transferId ? { ...prev, status: 'CANCELLED' } : null
      );
      pendingFileRef.current = null;
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  // Sync server progress into activeTransfer card
  useEffect(() => {
    if (!activeTransfer) return;
    const serverSession = transfers.find((t) => t.transferId === activeTransfer.transferId);
    if (serverSession && serverSession.bytesTransferred > 0) {
      setActiveTransfer((prev) =>
        prev
          ? {
              ...prev,
              bytesTransferred: serverSession.bytesTransferred,
              percentage: serverSession.percentage,
              currentSpeed: serverSession.currentSpeed,
              averageSpeed: serverSession.averageSpeed,
              etaSeconds: serverSession.etaSeconds,
              status:
                serverSession.status === 'COMPLETED'
                  ? 'COMPLETED'
                  : serverSession.status === 'VERIFYING'
                  ? 'VERIFYING'
                  : prev.status,
              finalHash: serverSession.finalHash || prev.finalHash,
            }
          : null
      );
    }
  }, [transfers, activeTransfer]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-100 selection:bg-cyan-500/20 selection:text-cyan-200">
      <Navbar
        session={session}
        isConnected={isConnected}
        diagnostics={diagnostics}
        onOpenBenchmark={() => setIsDiagnosticsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={refreshState}
      />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* ============================================================ */}
        {/* VIEW 1: ACTIVE LIVE TRANSFER IN PROGRESS OR COMPLETED        */}
        {/* ============================================================ */}
        {activeTransfer ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
                  {activeTransfer.status === 'COMPLETED'
                    ? 'Transfer Complete'
                    : activeTransfer.status === 'OFFERED'
                    ? 'Waiting for Recipient'
                    : activeTransfer.role === 'sender'
                    ? 'Streaming to Peer'
                    : 'Receiving from Peer'}
                </span>
              </div>

              {activeTransfer.status === 'COMPLETED' && (
                <button
                  onClick={() => {
                    setActiveTransfer(null);
                    setStagedShare(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center space-x-1.5 transition-all shadow-sm"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Send Another File</span>
                </button>
              )}
            </div>

            <TransferCard transfer={activeTransfer} onCancel={handleCancelTransfer} />

            {activeTransfer.status === 'COMPLETED' && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2 text-xs">
                <div className="flex items-center justify-center space-x-1.5 text-emerald-400 font-bold">
                  <FileCheck2 className="w-4 h-4" />
                  <span>
                    {activeTransfer.role === 'sender'
                      ? 'Streamed directly from original location'
                      : 'File saved directly to your device'}
                  </span>
                </div>
                <p className="text-slate-400">
                  {activeTransfer.role === 'sender'
                    ? 'Zero duplicate files or uploads were created on your computer.'
                    : 'Bit-for-bit SHA-256 hash verified successfully.'}
                </p>
              </div>
            )}
          </div>
        ) : incomingOffer && incomingOffer.status === 'OFFERED' ? (
          /* ============================================================ */
          /* VIEW 2: DEDICATED AIRDROP-STYLE MOBILE/WEB RECEIVER VIEW     */
          /* ============================================================ */
          <ReceiverView
            offer={incomingOffer}
            onAccept={handleAcceptOffer}
            onReject={handleRejectOffer}
            onSwitchToSender={() => setIncomingOffer(null)}
          />
        ) : stagedShare ? (
          /* ============================================================ */
          /* VIEW 3: DROP-FIRST "READY TO SHARE" HERO STAGE              */
          /* ============================================================ */
          <InstantShareCard
            file={stagedShare.file}
            offer={stagedShare.offer}
            sharingUrl={activeSharingUrl}
            nearbyDevices={devices}
            pairedDevice={pairedDevice}
            onSendToDevice={(device) => {
              setPairedDevice(device);
            }}
            onCancel={() => {
              setStagedShare(null);
              pendingFileRef.current = null;
            }}
          />
        ) : (
          /* ============================================================ */
          /* VIEW 4: DIRECTION 1 - APPLE AIRDROP SPATIAL RADAR            */
          /* ============================================================ */
          <div className="flex flex-col items-center space-y-4 animate-fade-in">
            {/* Top Minimal Ambient Status Pill */}
            {pairedDevice ? (
              <div className="flex items-center justify-center animate-fade-in">
                <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-xl text-xs font-semibold text-emerald-300 shadow-lg shadow-emerald-500/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>
                    Connected to <strong className="text-white">{pairedDevice.deviceName}</strong>
                  </span>
                  <button
                    onClick={() => setPairedDevice(null)}
                    className="ml-1.5 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-rose-300 transition-colors"
                    title="Disconnect"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center animate-fade-in">
                <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-surface-100/70 border border-white/5 backdrop-blur-md text-[11px] font-medium text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>AirDrop Radar Active</span>
                  <span className="text-slate-600">•</span>
                  <span className="font-mono text-cyan-300/80">
                    {activeSharingUrl ? activeSharingUrl.replace(/^https?:\/\//, '') : 'Ready'}
                  </span>
                </div>
              </div>
            )}

            {/* THE SPATIAL RADAR HERO */}
            <SpatialRadar
              clientName={session.clientName}
              pairedDevice={pairedDevice}
              nearbyDevices={devices}
              onFileSelected={handleDropFirstFile}
              onSelectDevice={(device) => {
                setPairedDevice(device);
              }}
              onDropOnDevice={(device, file) => {
                setPairedDevice(device);
                handleDropFirstFile(file);
              }}
              onOpenQr={() => setShowNetworkQr(true)}
              isDragOver={isRadarDragOver}
              onDragOver={handleRadarDragOver}
              onDragLeave={handleRadarDragLeave}
              onDrop={handleRadarDrop}
            />

            {/* FLOATING GLASS DOCK (CONTROL PILL) */}
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="inline-flex items-center p-1.5 rounded-2xl bg-surface-100/90 border border-white/10 backdrop-blur-2xl shadow-2xl space-x-1 sm:space-x-1.5">
                {/* QR Code Connect Pill */}
                <button
                  type="button"
                  onClick={() => setShowNetworkQr(!showNetworkQr)}
                  className={`flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    showNetworkQr
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 ring-2 ring-cyan-400/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  <span>QR Connect</span>
                </button>

                {/* Copy Link Pill */}
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>

                {/* 6-Digit Code Pill */}
                <button
                  type="button"
                  onClick={() => handleOpenPairing('join')}
                  className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>6-Digit Code</span>
                </button>

                <div className="w-[1px] h-5 bg-white/10 mx-0.5" />

                {/* Benchmark / Diagnostics Pill */}
                <button
                  type="button"
                  onClick={() => setIsDiagnosticsOpen(true)}
                  className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-all"
                  title="Network Diagnostics & Speed Test"
                >
                  <Zap className="w-4 h-4" />
                </button>
              </div>

              {/* Collapsible Instant Auto-Connect QR Card */}
              {showNetworkQr && (
                <div className="w-full max-w-sm p-4 rounded-3xl bg-surface-100/95 border border-cyan-500/30 backdrop-blur-2xl shadow-2xl animate-fade-in relative space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-white/5">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Scan to Pair Instantly
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNetworkQr(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <QrCodeCard
                    url={directPairingUrl || activeSharingUrl}
                    title=""
                    subtitle="Point your phone camera to pair both devices in 1 second with zero typing"
                    size={190}
                    showCopy={true}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Recipient Incoming Transfer Modal (Sender NEVER sees this) */}
      <IncomingTransferModal
        offer={activeTransfer?.role === 'sender' ? null : incomingOffer}
        onAccept={handleAcceptOffer}
        onReject={handleRejectOffer}
      />

      {/* 6-Digit Code Pairing Modal */}
      <PairingModal
        isOpen={isPairingOpen}
        initialTab={pairingTab}
        onClose={() => setIsPairingOpen(false)}
        clientId={session.clientId}
        clientName={session.clientName}
        onDevicePaired={(device) => {
          setPairedDevice(device);
        }}
        matchedPairingSession={matchedPairingSession}
      />

      {/* Diagnostics Modal */}
      <NetworkDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        diagnostics={diagnostics}
        observedSpeed={activeTransfer?.currentSpeed || 0}
      />

      {/* Consumer Onboarding Modal (first run) */}
      <OnboardingModal
        initialDeviceName={session.clientName}
        onComplete={(name) => {
          session.clientName = name;
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        deviceName={session.clientName}
        onUpdateDeviceName={(name) => {
          session.clientName = name;
          setIsSettingsOpen(false);
        }}
        storageDir="Downloads/ShareLAN"
      />
    </div>
  );
}
