import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ControlMessage,
  TransferSession,
  TransferOffer,
  NetworkDiagnostics,
  DeviceInfo,
  ProgressPayload,
  PairingSession,
} from '@sharelan/protocol';
import {
  getWebSocketUrl,
  fetchTransfers,
  fetchOffers,
  fetchNetworkDiagnostics,
  fetchDevices,
} from '../lib/api';
import { getClientSession, ClientSession } from '../lib/session';

const DEFAULT_SESSION: ClientSession = {
  clientId: 'client-pending',
  clientName: 'Desktop',
};

export function useShareLanWebSocket() {
  const [session, setSession] = useState<ClientSession>(DEFAULT_SESSION);
  const [isConnected, setIsConnected] = useState(false);
  const [transfers, setTransfers] = useState<TransferSession[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [incomingOffer, setIncomingOffer] = useState<TransferOffer | null>(null);
  const [acceptedOfferEvent, setAcceptedOfferEvent] = useState<{
    transferId: string;
    receiverClientId?: string;
    receiverDeviceName?: string;
    receiverDeviceId?: string;
    transportMode?: 'DIRECT_LAN' | 'RELAY_STREAM';
  } | null>(null);
  const [rejectedOfferEvent, setRejectedOfferEvent] = useState<{
    transferId: string;
    reason?: string;
  } | null>(null);
  const [cancelledTransferEvent, setCancelledTransferEvent] = useState<{
    transferId: string;
    reason?: string;
  } | null>(null);
  const [matchedPairingSession, setMatchedPairingSession] = useState<PairingSession | null>(null);
  const [pairedDevice, setPairedDevice] = useState<DeviceInfo | null>(null);
  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pairedDeviceRef = useRef<DeviceInfo | null>(null);
  const diagnosticsRef = useRef<NetworkDiagnostics | null>(null);

  pairedDeviceRef.current = pairedDevice;
  diagnosticsRef.current = diagnostics;

  // Keep session up to date
  useEffect(() => {
    setSession(getClientSession());
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const currentSession = getClientSession();
      const [tList, dList, oList, diag] = await Promise.all([
        fetchTransfers().catch(() => []),
        fetchDevices().catch(() => []),
        fetchOffers().catch(() => []),
        fetchNetworkDiagnostics().catch(() => null),
      ]);
      setTransfers(tList);
      setDevices(dList);
      if (diag) {
        setDiagnostics(diag);
        diagnosticsRef.current = diag;
      }

      // Only show incoming offers originating from OTHER devices that are fresh (not expired)
      const now = Date.now();
      const activePartner = pairedDeviceRef.current;
      const validOffers = oList
        .filter((o) => {
          if (o.status !== 'OFFERED') return false;
          if (o.senderClientId === currentSession.clientId) return false;
          if (now - o.createdAt > 3 * 60 * 1000) return false;

          // Must be explicitly targeted to us or to our host server
          const isTargetedToUs =
            (o.targetClientId && o.targetClientId === currentSession.clientId) ||
            (o.targetDeviceId && o.targetDeviceId === currentSession.clientId) ||
            Boolean(
              diagnosticsRef.current?.localIp &&
                ((o.targetDeviceId && o.targetDeviceId.includes(diagnosticsRef.current.localIp.replace(/\./g, '-'))) ||
                  (o.targetDeviceId && o.targetDeviceId === diagnosticsRef.current.localIp))
            );

          const isFromPartner = Boolean(
            activePartner &&
              (o.senderClientId === activePartner.deviceId ||
                o.senderDeviceId === activePartner.deviceId ||
                o.senderIp === activePartner.ip)
          );

          // STRICT: Only accept if targeted directly to us or from our paired partner.
          // Untargeted/unconnected broadcasts NEVER trigger popups!
          return isTargetedToUs || isFromPartner;
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      const latestOffer = validOffers[0];
      if (latestOffer) {
        setIncomingOffer(latestOffer);
      }
    } catch {
      // Ignore initial fetch errors
    }
  }, []);

  const sendWsMessage = useCallback((msg: ControlMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const ws = new WebSocket(getWebSocketUrl());
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        refreshState();
      };

      ws.onmessage = (event) => {
        try {
          const msg: ControlMessage = JSON.parse(event.data);
          const currentSession = getClientSession();

          switch (msg.type) {
            case 'network:diagnostics':
              setDiagnostics(msg.payload);
              break;

            case 'device:presence':
              setDevices((prev) => {
                const exists = prev.some((d) => d.deviceId === msg.payload.deviceId);
                if (exists) {
                  return prev.map((d) => (d.deviceId === msg.payload.deviceId ? msg.payload : d));
                }
                return [...prev, msg.payload];
              });
              break;

            case 'device:offline':
              setDevices((prev) => prev.filter((d) => d.deviceId !== msg.payload.deviceId));
              break;

            case 'transfer:offer': {
              const offer = msg.payload as TransferOffer;
              // 1. SENDER NEVER ACCEPTS THEIR OWN TRANSFER!
              if (offer.senderClientId === currentSession.clientId) {
                break;
              }

              const activePartner = pairedDeviceRef.current;
              const isTargetedToUs =
                (offer.targetClientId && offer.targetClientId === currentSession.clientId) ||
                (offer.targetDeviceId && offer.targetDeviceId === currentSession.clientId) ||
                Boolean(
                  diagnosticsRef.current?.localIp &&
                    ((offer.targetDeviceId && offer.targetDeviceId.includes(diagnosticsRef.current.localIp.replace(/\./g, '-'))) ||
                      (offer.targetDeviceId && offer.targetDeviceId === diagnosticsRef.current.localIp))
                );

              const isFromPartner = Boolean(
                activePartner &&
                  (offer.senderClientId === activePartner.deviceId ||
                    offer.senderDeviceId === activePartner.deviceId ||
                    offer.senderIp === activePartner.ip)
              );

              // STRICT: Only show popup if explicitly targeted to us or from our paired partner.
              // Untargeted/unconnected broadcasts NEVER trigger popups!
              if (isTargetedToUs || isFromPartner) {
                setIncomingOffer(offer);
              }
              break;
            }

            case 'transfer:accepted':
              setAcceptedOfferEvent(msg.payload);
              setIncomingOffer((prev) =>
                prev?.transferId === msg.payload.transferId ? null : prev
              );
              break;

            case 'transfer:reject':
              setRejectedOfferEvent(msg.payload);
              setIncomingOffer((prev) =>
                prev?.transferId === msg.payload.transferId ? null : prev
              );
              break;

            case 'transfer:cancelled':
              setCancelledTransferEvent(msg.payload);
              setIncomingOffer((prev) =>
                prev?.transferId === msg.payload.transferId ? null : prev
              );
              break;

            case 'transfer:created':
              setTransfers((prev) => {
                const exists = prev.some((t) => t.transferId === msg.payload.transferId);
                if (exists) {
                  return prev.map((t) =>
                    t.transferId === msg.payload.transferId ? msg.payload : t
                  );
                }
                return [msg.payload, ...prev];
              });
              break;

            case 'transfer:progress': {
              const p = msg.payload as ProgressPayload;
              setTransfers((prev) =>
                prev.map((t) => {
                  if (t.transferId !== p.transferId) return t;
                  return {
                    ...t,
                    bytesTransferred: p.bytesTransferred,
                    percentage: p.percentage,
                    currentSpeed: p.currentSpeed,
                    averageSpeed: p.averageSpeed,
                    etaSeconds: p.etaSeconds,
                    status: p.status,
                  };
                })
              );
              break;
            }

            case 'transfer:state_change':
              if (msg.payload.status === 'CANCELLED') {
                setCancelledTransferEvent({ transferId: msg.payload.transferId });
                setIncomingOffer((prev) =>
                  prev?.transferId === msg.payload.transferId ? null : prev
                );
              } else if (msg.payload.status === 'REJECTED') {
                setRejectedOfferEvent({ transferId: msg.payload.transferId, reason: msg.payload.error });
                setIncomingOffer((prev) =>
                  prev?.transferId === msg.payload.transferId ? null : prev
                );
              }
              setTransfers((prev) =>
                prev.map((t) =>
                  t.transferId === msg.payload.transferId
                    ? { ...t, status: msg.payload.status, error: msg.payload.error }
                    : t
                )
              );
              break;

            case 'transfer:completed':
              setTransfers((prev) =>
                prev.map((t) =>
                  t.transferId === msg.payload.transferId
                    ? {
                        ...t,
                        status: 'COMPLETED',
                        finalHash: msg.payload.finalHash,
                        percentage: 100,
                        bytesTransferred: t.fileSize,
                        currentSpeed: 0,
                        etaSeconds: 0,
                      }
                    : t
                )
              );
              break;

            case 'pairing:matched': {
              const isHost = msg.payload.hostClientId === currentSession.clientId;
              const isGuest = msg.payload.guestClientId === currentSession.clientId;
              if (isHost || isGuest) {
                setMatchedPairingSession(msg.payload);
                setPairedDevice({
                  deviceId: isHost ? msg.payload.guestClientId! : msg.payload.hostClientId,
                  deviceName: isHost ? msg.payload.guestDeviceName! : msg.payload.hostDeviceName,
                  ip: isHost ? msg.payload.guestIp! : msg.payload.hostIp,
                  port: isHost ? msg.payload.guestPort! : msg.payload.hostPort,
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
              }
              break;
            }

            case 'pairing:expired':
              setMatchedPairingSession((prev) => (prev?.code === msg.payload.code ? null : prev));
              break;
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;
        // Auto-reconnect after 2 seconds
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimerRef.current = setTimeout(connect, 2000);
    }
  }, [refreshState]);

  useEffect(() => {
    connect();
    // Background polling interval to guarantee incoming offers are never missed on completion screen
    const pollInterval = setInterval(() => {
      refreshState();
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect, refreshState]);

  return {
    session,
    isConnected,
    devices,
    incomingOffer,
    setIncomingOffer,
    acceptedOfferEvent,
    rejectedOfferEvent,
    cancelledTransferEvent,
    matchedPairingSession,
    pairedDevice,
    setPairedDevice,
    diagnostics,
    refreshState,
    transfers,
    sendWsMessage,
  };
}

