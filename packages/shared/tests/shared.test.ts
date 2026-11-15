import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatSpeed,
  formatDuration,
  sanitizeFilename,
  calculateETA,
  ThroughputCalculator,
} from '../src/index.js';

describe('Shared Utilities', () => {
  describe('formatBytes', () => {
    it('formats binary sizes correctly', () => {
      assert.equal(formatBytes(0), '0 B');
      assert.equal(formatBytes(1024), '1 KiB');
      assert.equal(formatBytes(1048576), '1 MiB');
      assert.equal(formatBytes(1073741824), '1 GiB');
      assert.equal(formatBytes(5368709120), '5 GiB');
    });
  });

  describe('formatSpeed', () => {
    it('formats throughput strings', () => {
      assert.equal(formatSpeed(0), '0 B/s');
      assert.equal(formatSpeed(104857600), '100 MiB/s');
    });
  });

  describe('formatDuration', () => {
    it('formats time intervals', () => {
      assert.equal(formatDuration(0), '0s');
      assert.equal(formatDuration(45), '45s');
      assert.equal(formatDuration(90), '1m 30s');
      assert.equal(formatDuration(3665), '1h 1m');
    });
  });

  describe('calculateETA', () => {
    it('calculates remaining seconds accurately', () => {
      assert.equal(calculateETA(1000, 500, 100), 5);
      assert.equal(calculateETA(1000, 1000, 100), 0);
      assert.equal(calculateETA(1000, 500, 0), 0);
    });
  });

  describe('sanitizeFilename', () => {
    it('removes invalid Windows characters', () => {
      assert.equal(sanitizeFilename('movie:special*edition?.mkv'), 'movie_special_edition_.mkv');
      assert.equal(sanitizeFilename('<secret>|pipe"quote.txt'), '_secret__pipe_quote.txt');
    });

    it('sanitizes directory traversal attempts', () => {
      assert.equal(sanitizeFilename('../../Windows/System32/calc.exe'), 'calc.exe');
      assert.equal(sanitizeFilename('..\\..\\secret.txt'), 'secret.txt');
    });

    it('protects reserved Windows names', () => {
      assert.equal(sanitizeFilename('CON.txt'), '_CON.txt');
      assert.equal(sanitizeFilename('NUL'), '_NUL');
      assert.equal(sanitizeFilename('com1.log'), '_com1.log');
    });

    it('handles empty or blank inputs', () => {
      assert.equal(sanitizeFilename(''), 'unnamed_file');
      assert.equal(sanitizeFilename('   '), 'unnamed_file');
      assert.equal(sanitizeFilename('...'), 'unnamed_file');
    });
  });

  describe('ThroughputCalculator', () => {
    it('computes rolling speeds', () => {
      const calc = new ThroughputCalculator(3000);
      const t0 = 1000000;
      calc.recordProgress(0, t0);
      calc.recordProgress(100 * 1024 * 1024, t0 + 1000); // 100 MiB transferred in 1 sec

      const speed = calc.getCurrentSpeed(t0 + 1000);
      assert.ok(Math.abs(speed - 100 * 1024 * 1024) < 1000);
    });
  });
});
