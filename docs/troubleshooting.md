# ShareLAN Troubleshooting Guide

## 1. Devices Cannot Discover Each Other or Connect
- **Hostel / Public Wi-Fi AP Isolation**:
  Many public networks block peer-to-peer traffic between client devices.
  - **Diagnostic**: Use the built-in Network Diagnostics modal. If the ping test fails between laptops, AP Isolation is enforced on the router.
  - **Remedy**: Connect both devices to a mobile hotspot or dedicated Wi-Fi router.
- **Windows Firewall**:
  Windows Defender Firewall might prompt on first run. Ensure you allow "Private Networks" for Node.js on port `37821`.
  - Manual check in PowerShell (Admin):
    ```powershell
    New-NetFirewallRule -DisplayName "ShareLAN Streaming" -Direction Inbound -LocalPort 37821 -Protocol TCP -Action Allow
    ```

## 2. Speed Appears Slower Than Expected
- Run the synthetic benchmark via the UI button.
  - If benchmark speed is high but file transfers are slow: The bottleneck is local disk I/O (e.g. HDD or encrypted/synced folders).
  - If benchmark speed is also low: The bottleneck is Wi-Fi interference, 2.4GHz vs 5GHz band, or router queue delay.
- Avoid placing the ShareLAN download directory inside OneDrive / Google Drive / Dropbox synced folders, as real-time file indexing competes for disk I/O.
