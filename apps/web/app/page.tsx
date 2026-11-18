'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useShareLanWebSocket } from '../hooks/useShareLanWebSocket';
import { Navbar } from '../components/Navbar';
import { FluidCanvas } from '../components/FluidCanvas';
import { TransferCard, ActiveTransferState } from '../components/TransferCard';
import { NetworkDiagnosticsModal } from '../components/NetworkDiagnosticsModal';
import { PairingModal } from '../components/PairingModal';
import { OnboardingModal } from '../components/OnboardingModal';
import { SettingsModal } from '../components/SettingsModal';
import { InstantShareCard } from '../components/InstantShareCard';
import { ReceiverView } from '../components/ReceiverView';
import { TransferHistoryModal, CompletedTransferRecord } from '../components/TransferHistoryModal';
import { playSuccessChime, playOfferChime } from '../lib/sound';
import { copyTextToClipboard } from '../lib/clipboard';
import { acquireWakeLock, releaseWakeLock } from '../lib/wakeLock';
import { processDroppedData } from '../lib/folder';
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
  triggerSubnetSweep,
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
  UploadCloud,
} from 'lucide-react';

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
  const [isDropOver, setIsDropOver] = useState(false);
  const [completedRecords, setCompletedRecords] = useState<CompletedTransferRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  // Stored reference to sender's host URL for live receiver progress polling
  const receiverSenderHostRef = useRef<string | null>(null);

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

  const handleCopyShareLink = async () => {
    const url = directPairingUrl || activeSharingUrl || (typeof window !== 'undefined' ? window.location.href : '');
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
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

  // Mobile Screen WakeLock management during active transfers
  useEffect(() => {
    if (activeTransfer?.status === 'TRANSFERRING') {
      acquireWakeLock();
    } else if (
      activeTransfer?.status === 'COMPLETED' ||
      activeTransfer?.status === 'FAILED' ||
      activeTransfer?.status === 'CANCELLED' ||
      !activeTransfer
    ) {
      releaseWakeLock();
    }
  }, [activeTransfer?.status]);

  // Audio cue, History logging & OS Notification on transfer completion
  useEffect(() => {
    if (activeTransfer?.status === 'COMPLETED') {
      playSuccessChime();

      // Record in transfer history
      setCompletedRecords((prev) => {
        const exists = prev.some((r) => r.transferId === activeTransfer.transferId);
        if (exists) return prev;
        return [
          {
            transferId: activeTransfer.transferId,
            role: activeTransfer.role,
            fileName: activeTransfer.fileName,
            fileSize: activeTransfer.fileSize,
            peerName: activeTransfer.peerName,
            completedAt: Date.now(),
            averageSpeed: activeTransfer.averageSpeed || activeTransfer.currentSpeed,
            finalHash: activeTransfer.finalHash,
            isFolder: activeTransfer.fileName.endsWith('.tar'),
          },
          ...prev,
        ];
      });

      // Show system desktop notification
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification('Orbit Transfer Complete', {
              body: `${activeTransfer.fileName} transferred successfully.`,
            });
          } catch {}
        } else if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    }
  }, [activeTransfer?.status, activeTransfer?.transferId]);

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
   * DIRECT AIRDROP-STYLE STREAM WORKFLOW:
   * If a peer device is already connected or found, dropping/picking a file
   * sends the offer directly to that laptop with ZERO interstitial clicks!
   * If no peer is connected yet, shows InstantShareCard for discovery.
   */
  const handleDropFirstFile = useCallback(
    async (file: File) => {
      setIsSending(true);

      try {
        const targetPeer =
          pairedDevice ||
          (devices.length === 1 && devices[0].deviceId !== session.clientId
            ? devices[0]
            : null);

        let transportMode: TransportMode = 'DIRECT_LAN';

        if (targetPeer) {
          const probe = await probeAndSelectTransport(targetPeer.ip, targetPeer.port);
          transportMode = probe.selectedTransport;
        }

        const offer = await createTransferOffer({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          senderClientId: session.clientId,
          senderDeviceName: session.clientName,
          targetDeviceId: targetPeer?.deviceId,
          targetClientId: targetPeer?.deviceId,
          transportMode,
        });

        pendingFileRef.current = {
          file,
          transferId: offer.transferId,
          transportMode,
          relaySessionId: offer.relaySessionId || offer.transferId,
        };

        if (targetPeer) {
          // Direct 1-Click Beam: Immediately transition to active transfer state
          setStagedShare(null);
          setActiveTransfer({
            transferId: offer.transferId,
            role: 'sender',
            fileName: file.name,
            fileSize: file.size,
            peerName: targetPeer.deviceName,
            status: 'OFFERED',
            transportMode,
            bytesTransferred: 0,
            percentage: 0,
            currentSpeed: 0,
            averageSpeed: 0,
            etaSeconds: 0,
          });
        } else {
          setStagedShare({ file, offer });
        }
      } catch (err: unknown) {
        console.error('Instant share offer error:', err);
      } finally {
        setIsSending(false);
      }
    },
    [pairedDevice, devices, session]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDropOver(false);
      if (e.dataTransfer) {
        try {
          const result = await processDroppedData(e.dataTransfer);
          if (result && result.file) {
            handleDropFirstFile(result.file);
          }
        } catch (err) {
          console.error('Error processing dropped data:', err);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleDropFirstFile(e.dataTransfer.files[0]);
          }
        }
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

  // Listen for native Electron download progress & completion on receiver
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const api = (window as any).electronAPI;
    if (!api) return;

    const unsubProg = api.onDownloadProgress?.((data: any) => {
      setActiveTransfer((prev) =>
        prev && prev.role === 'receiver'
          ? {
              ...prev,
              bytesTransferred: data.bytesTransferred,
              fileSize: data.fileSize || prev.fileSize,
              percentage: data.percentage,
              currentSpeed: data.currentSpeed || prev.currentSpeed,
              status: 'TRANSFERRING',
            }
          : prev
      );
    });

    const unsubDone = api.onDownloadCompleted?.((_data: any) => {
      setActiveTransfer((prev) =>
        prev && prev.role === 'receiver'
          ? {
              ...prev,
              status: 'COMPLETED',
              percentage: 100,
              bytesTransferred: prev.fileSize,
            }
          : prev
      );
    });

    const unsubFail = api.onDownloadFailed?.((data: any) => {
      setActiveTransfer((prev) =>
        prev && prev.role === 'receiver'
          ? {
              ...prev,
              status: 'FAILED',
              error: `Download failed (${data?.state || 'interrupted'})`,
            }
          : prev
      );
    });

    return () => {
      unsubProg?.();
      unsubDone?.();
      unsubFail?.();
    };
  }, []);

  // Poll sender's /api/transfers when receiving to guarantee live speed and byte updates in browsers
  useEffect(() => {
    if (!activeTransfer || activeTransfer.role !== 'receiver' || activeTransfer.status !== 'TRANSFERRING') return;
    const targetHost = receiverSenderHostRef.current || getServerBaseUrl();
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${targetHost}/api/transfers`);
        if (!res.ok) return;
        const list = await res.json();
        const found = list.find((t: any) => t.transferId === activeTransfer.transferId);
        if (found && found.bytesTransferred > 0) {
          setActiveTransfer((prev) => {
            if (!prev || prev.transferId !== activeTransfer.transferId) return prev;
            return {
              ...prev,
              bytesTransferred: found.bytesTransferred,
              percentage: found.percentage,
              currentSpeed: found.currentSpeed,
              averageSpeed: found.averageSpeed,
              etaSeconds: found.etaSeconds,
              status: found.status === 'COMPLETED' ? 'COMPLETED' : prev.status,
              finalHash: found.finalHash || prev.finalHash,
            };
          });
        }
      } catch {}
    }, 400);
    return () => clearInterval(interval);
  }, [activeTransfer?.transferId, activeTransfer?.role, activeTransfer?.status]);

  /**
   * RECIPIENT WORKFLOW:
   * Recipient clicks Accept & Save -> stream starts live directly into recipient device.
   * ZERO bytes stored on server or sender!
   */
  const handleAcceptOffer = async (offer: TransferOffer, fileHandle?: any) => {
    try {
      receiverSenderHostRef.current =
        offer.senderIp && offer.senderPort
          ? `http://${offer.senderIp}:${offer.senderPort}`
          : getServerBaseUrl();

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
      const encodedName = encodeURIComponent(offer.fileName);
      if (isRelay) {
        streamUrl = `${getServerBaseUrl()}/api/relay/${offer.relaySessionId || offer.transferId}/stream?filename=${encodedName}`;
      } else {
        const targetHost =
          offer.senderIp && offer.senderPort
            ? `http://${offer.senderIp}:${offer.senderPort}`
            : getServerBaseUrl();
        streamUrl = `${targetHost}/api/transfers/${offer.transferId}/live-pipe?filename=${encodedName}`;
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
    <div className="min-h-screen flex flex-col bg-canvas-atmosphere text-warm-bone selection:bg-white/10 selection:text-white">
      <Navbar
        session={session}
        isConnected={isConnected}
        diagnostics={diagnostics}
        onOpenBenchmark={() => setIsDiagnosticsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={completedRecords.length}
        onRefresh={() => {
          refreshState();
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col justify-center">
        {/* Full-Viewport Drag & Drop Overlay */}
        {isDropOver && (
          <div className="fixed inset-0 z-50 pointer-events-none border-2 border-white/30 bg-black/40 backdrop-blur-[2px] flex items-center justify-center animate-fade-in">
            <div className="p-4 rounded-xl bg-obsidian-card border border-white/20 shadow-2xl flex items-center space-x-3 text-zinc-100 font-semibold text-sm">
              <UploadCloud className="w-5 h-5 text-white animate-bounce" />
              <span>Drop anywhere to transfer immediately</span>
            </div>
          </div>
        )}
        {/* ============================================================ */}
        {/* VIEW 1: ACTIVE LIVE TRANSFER IN PROGRESS OR COMPLETED        */}
        {/* ============================================================ */}
        {activeTransfer ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
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
                  className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white flex items-center space-x-1.5 transition-all border border-white/[0.1] shadow-sm"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Send Another</span>
                </button>
              )}
            </div>

            <TransferCard transfer={activeTransfer} onCancel={handleCancelTransfer} />

            {activeTransfer.status === 'COMPLETED' && (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-center space-y-1 text-xs">
                <div className="flex items-center justify-center space-x-1.5 text-zinc-200 font-medium">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {activeTransfer.role === 'sender'
                      ? 'Streamed directly from source'
                      : 'File saved directly to disk'}
                  </span>
                </div>
                <p className="text-zinc-500 text-[11px]">
                  {activeTransfer.role === 'sender'
                    ? 'Zero intermediate duplicate copies were created on your computer.'
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
              if (stagedShare) {
                const fileToSend = stagedShare.file;
                setStagedShare(null);
                handleDropFirstFile(fileToSend);
              }
            }}
            onCancel={() => {
              setStagedShare(null);
              pendingFileRef.current = null;
            }}
          />
        ) : (
          /* ============================================================ */
          /* VIEW 4: THE LEGENDARY FLUID CANVAS                           */
          /* ============================================================ */
          <FluidCanvas
            clientName={session.clientName}
            activeSharingUrl={activeSharingUrl}
            directPairingUrl={directPairingUrl}
            pairedDevice={pairedDevice}
            nearbyDevices={devices}
            onSelectDevice={(device) => {
              setPairedDevice(device);
            }}
            onFileSelected={handleDropFirstFile}
            onDropOnDevice={(device, file) => {
              setPairedDevice(device);
              handleDropFirstFile(file);
            }}
            onOpenQr={() => setShowNetworkQr(true)}
            showQr={showNetworkQr}
            onToggleQr={() => setShowNetworkQr(!showNetworkQr)}
            onCopyUrl={handleCopyShareLink}
            copiedLink={copiedLink}
            onOpenPairing={handleOpenPairing}
            onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
            isDragOver={isDropOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            diagnostics={diagnostics}
            onSweepPeers={() => triggerSubnetSweep().catch(() => {})}
          />
        )}
      </main>

      {/* Transfer History Modal */}
      <TransferHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        records={completedRecords}
        onClearHistory={() => setCompletedRecords([])}
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
        storageDir="Downloads/Orbit"
      />
    </div>
  );
}
