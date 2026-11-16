# Orbit — High-Performance Local Network File Streaming System

[![Download Orbit for Windows](https://img.shields.io/badge/Download-Orbit%20v1.0.0%20(Windows%20Portable)-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Prashant-Mishra-993389/Orbit---High-throughput-LAN-transfer/releases/download/v1.0.0/Orbit-Portable-1.0.0.exe)
[![GitHub Release](https://img.shields.io/github/v/release/Prashant-Mishra-993389/Orbit---High-throughput-LAN-transfer?style=for-the-badge&color=28a745)](https://github.com/Prashant-Mishra-993389/Orbit---High-throughput-LAN-transfer/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

> **AirDrop for laptops and mobile devices on a local network with multi-gigabit streaming throughput, zero cloud storage, and cryptographic integrity verification.**

---

## 📥 Instant Download (No Setup Required)

| Platform | Download | Setup |
| :--- | :--- | :--- |
| **Windows 10 / 11** | [**Download Orbit Portable (.exe)**](https://github.com/Prashant-Mishra-993389/Orbit---High-throughput-LAN-transfer/releases/download/v1.0.0/Orbit-Portable-1.0.0.exe) *(72 MB)* | **Zero install.** Double-click to run anywhere. |
| **Android / iOS / Mac** | **No app needed!** | Scan the on-screen QR code from your phone's camera. |

---

## 💻 The Laptop-to-Laptop Solution

While mobile phones have AirDrop for small photos, transferring **10+ GB desktop payloads** (code repositories, game backups, 4K video exports, ML datasets) between two laptops remains frustratingly broken.

Orbit turns any standard local Wi-Fi network or **personal phone hotspot** into an instant, multi-gigabit data pipeline:
* ⚡ **85+ MB/s Peak Speed:** Directly saturates local 5 GHz Wi-Fi and hotspot link rates, streaming a 10 GB file in ~2 minutes.
* 📶 **Zero Cellular Data Consumed:** Connect both laptops to your phone's portable hotspot—Orbit streams purely over the local ad-hoc wireless layer with **0 MB of mobile data used**.
* 🧠 **Bounded Memory Footprint:** Strict 64 KiB stream backpressure keeps RAM capped under ~50 MB during massive transfers.
* 🖥️ **Cross-Platform:** Runs standalone on Windows via portable `.exe`, while Mac and Linux laptops connect instantly through any modern browser.

---

## Key Features

- ⚡ **Direct LAN Streaming**: Files stream directly from sender to receiver across local Wi-Fi or Ethernet. Zero cloud storage roundtrips.
- 🛡️ **Cryptographic Verification**: Streaming on-the-fly **SHA-256** checksum calculation with atomic finalization (`.part` -> final file).
- 🧠 **Bounded Memory Footprint**: Strict stream backpressure ensures memory consumption remains bounded under ~50MB regardless of whether transferring 100MB or 50GB.
- 📊 **Real-Time Throughput Monitor**: Instantaneous, 3-second moving average, and accurate ETA calculations broadcast via WebSockets.
- 🔒 **Filesystem Sandboxing**: Cross-platform path traversal guard and Windows illegal character sanitization (`: * ? " < > |`).
- 📈 **Network Diagnostics & Benchmark**: Synthetic throughput test engine to isolate Wi-Fi network limitations from disk write bottlenecks.

---

## Quick Start

### 1. Requirements
- **Node.js**: v18+ (tested on Node.js v24 LTS)
- **OS**: Windows 10/11, macOS, or Linux

### 2. Setup & Installation
```bash
# Clone the repository
git clone https://github.com/Prashant-Mishra-993389/Orbit---High-throughput-LAN-transfer.git
cd Orbit---High-throughput-LAN-transfer

# Install all workspace dependencies
npm install

# Build protocol and shared libraries
npm run build
```

### 3. Start the Server
```bash
# Starts the high-performance streaming server on port 37821
npm run dev
```

The server binds to `0.0.0.0:37821` and prints your local LAN IP (e.g. `http://10.35.233.163:37821`).

### 4. Connect Another Laptop
1. Ensure both devices are on the same Wi-Fi network.
2. Open the browser on Laptop B and navigate to `http://<Laptop-A-IP>:37821` (or run `npm run dev:web` on Laptop A).
3. Drag and drop any file or folder to begin high-speed streaming!

---

## Testing & Benchmarks

### Run Automated Tests
```bash
npm test
```

### Generate Deterministic Test Files
```bash
# Generate 10MB test file
node scripts/generate-test-file.js --size=10MB

# Generate 100MB test file
node scripts/generate-test-file.js --size=100MB

# Generate 1GB test file
node scripts/generate-test-file.js --size=1GB
```

---

## Architecture Overview

```
apps/
  ├── server/       # Fastify HTTP/TCP streaming server + WebSocket control hub
  └── web/          # Next.js React 19 desktop-grade user interface
packages/
  ├── protocol/     # Transfer state machine types and protocol definitions
  └── shared/       # Path sanitizers, throughput calculators, formatters
scripts/
  └── generate-test-file.js   # Fast synthetic test file generator
docs/
  ├── architecture.md
  ├── protocol.md
  ├── security.md
  ├── performance.md
  └── troubleshooting.md
```
