# ShareLAN Protocol Specification v1.0

## 1. Overview
The ShareLAN Protocol coordinates transfers between sender and receiver devices on local networks.

---

## 2. Transfer State Machine

```
         [CREATED]
             |
             v
      [TRANSFERRING] <====> [PAUSED]
             |
             v
       [VERIFYING]
             |
      +------+------+
      |             |
      v             v
 [COMPLETED]     [FAILED]
```

- `CREATED`: Transfer session registered in control plane. Staging metadata initialized.
- `TRANSFERRING`: Active binary streaming across data plane.
- `VERIFYING`: All bytes received. Computing final SHA-256 and comparing with expected digest.
- `COMPLETED`: File verified and atomically moved to destination.
- `FAILED`: Aborted due to network error, hash mismatch, or storage error. Staging `.part` file is deleted.
- `CANCELLED`: Explicitly terminated by user.

---

## 3. Control Plane REST Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/system/network` | Enumerate LAN IP, port, and adapter info. |
| `GET` | `/api/capabilities` | Return protocol version, max chunk size, and supported transports. |
| `POST` | `/api/transfers` | Register new transfer session. Returns `TransferSession`. |
| `GET` | `/api/transfers` | List active and historical transfers. |
| `GET` | `/api/transfers/:id` | Query single transfer state and progress. |
| `DELETE` | `/api/transfers/:id` | Cancel transfer and clean up staging file. |
| `PUT` | `/api/transfers/:id/stream` | Direct streaming data plane endpoint. |
| `GET` | `/api/files/:id/download` | Download verified completed file. |
| `POST` | `/api/system/benchmark-upload`| Synthetic speed test endpoint. |

---

## 4. WebSocket Control Events

Messages are JSON envelopes conforming to:
```typescript
interface ControlMessage {
  type: string;
  payload: any;
}
```

Key Event Types:
- `transfer:created`: Broadcast when a new transfer session is initiated.
- `transfer:progress`: Throttled (100ms) progress payload:
  ```json
  {
    "transferId": "...",
    "bytesTransferred": 52428800,
    "totalBytes": 104857600,
    "percentage": 50.0,
    "currentSpeed": 118485760,
    "averageSpeed": 115343360,
    "etaSeconds": 4.5,
    "status": "TRANSFERRING"
  }
  ```
- `transfer:completed`: Broadcast when SHA-256 checksum is verified and atomic rename succeeds.
- `transfer:state_change`: State change notifications (`PAUSED`, `CANCELLED`, `FAILED`).
