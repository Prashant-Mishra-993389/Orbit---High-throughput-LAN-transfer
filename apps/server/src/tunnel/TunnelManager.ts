import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { wsHub } from '../websocket/server.js';
import { getNetworkDiagnostics } from '../diagnostics/network.js';
import { config } from '../config/index.js';

export class TunnelManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private publicUrl: string | null = null;
  private isStarting = false;
  private binaryPath: string | null = null;

  constructor() {
    super();
    this.binaryPath = this.findCloudflared();
  }

  private findCloudflared(): string | null {
    // Check known Windows paths first
    const knownPaths = [
      'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
      'C:\\Program Files\\cloudflared\\cloudflared.exe',
      'cloudflared.exe',
      'cloudflared',
    ];

    for (const p of knownPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return 'cloudflared'; // Fallback to PATH
  }

  public getPublicUrl(): string | null {
    return this.publicUrl;
  }

  public setPublicUrl(url: string): void {
    this.publicUrl = url;
    this.emit('ready', url);
    try {
      const diag = getNetworkDiagnostics(config.port, url);
      wsHub.broadcast({
        type: 'network:diagnostics',
        payload: diag,
      });
    } catch {}
  }

  public isAvailable(): boolean {
    return !!this.binaryPath;
  }

  public async start(targetPort = config.port): Promise<string> {
    if (this.publicUrl) {
      return this.publicUrl;
    }

    if (this.isStarting) {
      return new Promise((resolve) => {
        this.once('ready', (url) => resolve(url));
      });
    }

    this.isStarting = true;
    const bin = this.binaryPath || 'cloudflared';

    return new Promise((resolve, reject) => {
      try {
        const proc = spawn(bin, ['tunnel', '--url', `http://localhost:${targetPort}`], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });

        this.process = proc;

        const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
        let resolved = false;

        const onData = (data: Buffer) => {
          const text = data.toString();
          const match = text.match(urlRegex);
          if (match && !resolved) {
            resolved = true;
            this.publicUrl = match[0];
            this.isStarting = false;
            this.emit('ready', this.publicUrl);

            // Broadcast updated network diagnostics with public tunnel URL
            try {
              const diag = getNetworkDiagnostics(config.port);
              diag.publicTunnelUrl = this.publicUrl;
              wsHub.broadcast({
                type: 'network:diagnostics',
                payload: diag,
              });
            } catch {}

            resolve(this.publicUrl);
          }
        };

        proc.stdout.on('data', onData);
        proc.stderr.on('data', onData);

        proc.on('error', (err) => {
          this.isStarting = false;
          if (!resolved) {
            reject(err);
          }
        });

        proc.on('close', (code) => {
          this.publicUrl = null;
          this.isStarting = false;
          this.process = null;
        });

        // 30s timeout for tunnel setup
        setTimeout(() => {
          if (!resolved) {
            this.isStarting = false;
            reject(new Error('Cloudflare Tunnel connection timed out'));
          }
        }, 30000);
      } catch (err) {
        this.isStarting = false;
        reject(err);
      }
    });
  }

  public stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.publicUrl = null;
      this.isStarting = false;
    }
  }
}

export const tunnelManager = new TunnelManager();
