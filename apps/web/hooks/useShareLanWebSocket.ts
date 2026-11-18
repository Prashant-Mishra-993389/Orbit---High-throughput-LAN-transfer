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
      if (diag) setDiagnostics(diag);

      // Only show incoming offers originating from OTHER devices that are fresh (not expired)
      const now = Date.now();
      const validOffers = oList
        .filter(
          (o) =>
            o.status === 'OFFERED' &&
            o.senderClientId !== currentSession.clientId &&
            (!o.targetClientId || o.targetClientId === currentSession.clientId) &&
            now - o.createdAt <= 3 * 60 * 1000
        )
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

            case 'transfer:offer':
              // SENDER NEVER ACCEPTS THEIR OWN TRANSFER!
              if (
                msg.payload.senderClientId !== currentSession.clientId &&
                (!msg.payload.targetClientId || msg.payload.targetClientId === currentSession.clientId)
              ) {
                setIncomingOffer(msg.payload);
              }
              break;

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
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

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

