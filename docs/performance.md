# ShareLAN Performance Philosophy

## Core Tenets
1. **Never Load Whole Files into RAM**:
   Regardless of file size (100 MB, 1 GB, 50 GB), streaming buffers are bounded (64 KiB `highWaterMark`).
2. **True Stream Backpressure**:
   If the receiving disk is slower than the incoming network socket, backpressure propagates through TCP window updates to slow down the sender automatically without runaway memory consumption.
3. **Incremental Integrity Hashing**:
   SHA-256 is computed progressively on the stream as chunks pass through. This eliminates an expensive second disk-read pass after the transfer finishes.
4. **Synthetic Network Benchmarking**:
   ShareLAN provides an integrated benchmark endpoint (`/api/system/benchmark-upload`) that discards incoming bytes to measure pure network capacity, allowing users to differentiate router/Wi-Fi bottlenecks from disk write speeds.
