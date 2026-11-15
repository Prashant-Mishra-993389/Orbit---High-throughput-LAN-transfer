# ShareLAN Architecture

## Overview
ShareLAN is a high-performance local network (LAN) file transfer system designed to operate with AirDrop-like simplicity while maintaining the throughput, reliability, and security of modern distributed streaming engines.

---

## 1. Plane Separation

### Control Plane
- **Technology**: Fastify JSON REST API + bidirectional WebSockets (`ws`).
- **Responsibilities**:
  - Device presence and discovery
  - Pairing authorization & capability negotiation
  - Transfer session creation and metadata exchange
  - Real-time progress updates (throttled to 10 FPS to eliminate UI thread saturation)
  - State machine transitions (`CREATED`, `TRANSFERRING`, `VERIFYING`, `COMPLETED`, `PAUSED`, `FAILED`, `CANCELLED`)
  - Diagnostics and network health polling

### Data Plane
- **Technology**: Direct streaming HTTP/TCP (`PUT /api/transfers/:id/stream`).
- **Responsibilities**:
  - High-throughput transmission of binary payloads
  - Bounded memory usage via stream backpressure
  - Incremental SHA-256 calculation on-the-fly
  - Staging into temporary `.sharelan.part` files
  - Atomic rename upon checksum verification

```
+-------------------------------------------------------------------------+
|                              Control Plane                              |
|                       (Fastify REST + WebSockets)                       |
|   - Session creation   - State machine   - Throttled progress frames    |
+------------------------------------+------------------------------------+
                                     | coordinates
                                     v
+-------------------------------------------------------------------------+
|                               Data Plane                                |
|                        (Streaming HTTP over TCP)                        |
|                                                                         |
|  [ Sender ]                                              [ Receiver ]   |
|      |                                                         |        |
|  Disk / File                                             HTTP Stream    |
|      |                                                         |        |
|  ReadableStream -- TCP Socket (Backpressure Pipeline) --> Transform     |
|                                                            (Hash+Count) |
|                                                                |        |
|                                                           WriteStream   |
|                                                                |        |
|                                                         .sharelan.part  |
|                                                                |        |
|                                                         Atomic Rename   |
|                                                                |        |
|                                                          Final Target   |
+-------------------------------------------------------------------------+
```

---

## 2. Core Modules

1. **`TransferManager`**:
   - Single authoritative manager for transfer sessions.
   - Coordinates state changes and dispatches throttled updates.
2. **`StreamManager`**:
   - Manages Node.js `pipeline` between the incoming HTTP raw socket and the disk `WriteStream`.
   - Incorporates real-time hash digests and backpressure flow control.
3. **`ThroughputCalculator`**:
   - 3-second rolling window for smooth, accurate instantaneous speeds and overall average throughput.
4. **`Security & Sanitizer`**:
   - Prevents path traversal (`../../`).
   - Normalizes Windows-reserved characters (`: * ? " < > |`) and reserved device names (`CON, PRN, AUX, NUL, COM1-9, LPT1-9`).
   - Generates non-colliding destination names (`photo (1).jpg`) to prevent silent overwrites.
5. **`NetworkDiagnostics`**:
   - Identifies active network adapters (prioritizing physical Wi-Fi/Ethernet over virtual adapters like WSL/Hyper-V).
   - Provides synthetic LAN benchmark endpoints to isolate network bottlenecks from disk I/O.
