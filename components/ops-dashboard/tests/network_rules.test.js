// Automated Unit & Integration Tests for Phase 8: Network Micro-Segmentation & Firewall Scripts
// Document ID: SEC-NET-07 / Master Blueprint: start.md

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const NETWORK_DIR = path.join(REPO_ROOT, 'scripts/network');
const WIREGUARD_DIR = path.join(NETWORK_DIR, 'wireguard');

describe('Phase 8: Network Micro-Segmentation & Firewall Rules', () => {
  test('1. Shell scripts exist and have executable permissions', () => {
    const applyScript = path.join(NETWORK_DIR, 'apply_iptables.sh');
    const verifyScript = path.join(NETWORK_DIR, 'verify_network_isolation.sh');

    assert.ok(fs.existsSync(applyScript), 'apply_iptables.sh must exist');
    assert.ok(fs.existsSync(verifyScript), 'verify_network_isolation.sh must exist');

    const applyStat = fs.statSync(applyScript);
    const verifyStat = fs.statSync(verifyScript);

    // Check executable bit for user
    assert.ok((applyStat.mode & 0o111) !== 0, 'apply_iptables.sh must be executable');
    assert.ok((verifyStat.mode & 0o111) !== 0, 'verify_network_isolation.sh must be executable');
  });

  test('2. apply_iptables.sh dry-run produces complete 3-zone microsegmentation rules', () => {
    const applyScript = path.join(NETWORK_DIR, 'apply_iptables.sh');
    const dryRunOutput = execSync(`DRY_RUN=1 bash "${applyScript}" test`, { encoding: 'utf8' });

    assert.match(dryRunOutput, /=== Applying ScatterID Network Microsegmentation Rules ===/);
    assert.match(dryRunOutput, /=== ScatterID Firewall Rules Applied Successfully ===/);

    // Zone 1 Counter VPN denials
    assert.match(dryRunOutput, /iptables -A INPUT -s 10\.20\.0\.0\/24 -p tcp --dport 8080 -j DROP/);
    assert.match(dryRunOutput, /iptables -A INPUT -s 10\.20\.0\.0\/24 -p tcp --dport 3000 -j DROP/);
    assert.match(dryRunOutput, /iptables -A INPUT -s 10\.20\.0\.0\/24 -p tcp --dport 5001 -j DROP/);
    assert.match(dryRunOutput, /iptables -A INPUT -s 10\.20\.0\.0\/24 -p tcp --dport 7050:9051 -j DROP/);

    // Zone 1 Counter VPN allowance (Portal only)
    assert.match(dryRunOutput, /iptables -A INPUT -s 10\.20\.0\.0\/24 -p tcp --dport 5000 -j ACCEPT/);

    // Cross-zone forward isolation
    assert.match(dryRunOutput, /iptables -A FORWARD -s 10\.20\.0\.0\/24 -d 10\.10\.0\.0\/24 -j DROP/);

    // Zone 2 Management LAN allowances
    assert.match(dryRunOutput, /iptables -A INPUT -s 10\.10\.0\.0\/24 -p tcp --dport 8080 -j ACCEPT/);
    assert.match(dryRunOutput, /iptables -A INPUT -s 10\.10\.0\.0\/24 -p tcp --dport 3000 -j ACCEPT/);

    // Zone 3 Core Dataplane isolation (:5001 non-127.0.0.1 drop)
    assert.match(dryRunOutput, /iptables -A INPUT ! -s 127\.0\.0\.1 -p tcp --dport 5001 -j DROP/);
  });

  test('3. WireGuard configuration profiles exist and have valid topology parameters', () => {
    const configs = {
      'wg0-counter-server.conf': { subnet: '10.20.0.1/24', listenPort: '51820' },
      'client-counter.conf': { address: '10.20.0.2/24', allowedIPs: '10.20.0.0/24' },
      'wg1-mgmt-server.conf': { subnet: '10.10.0.1/24', listenPort: '51821' },
      'client-mgmt.conf': { address: '10.10.0.2/24', allowedIPs: '10.10.0.0/24' },
    };

    for (const [filename, expected] of Object.entries(configs)) {
      const filePath = path.join(WIREGUARD_DIR, filename);
      assert.ok(fs.existsSync(filePath), `Config file ${filename} must exist`);

      const content = fs.readFileSync(filePath, 'utf8');
      assert.match(content, /\[Interface\]/, `${filename} must have [Interface] block`);
      assert.match(content, /\[Peer\]/, `${filename} must have [Peer] block`);

      if (expected.subnet) {
        assert.ok(content.includes(`Address = ${expected.subnet}`), `${filename} must specify Address = ${expected.subnet}`);
      }
      if (expected.listenPort) {
        assert.ok(content.includes(`ListenPort = ${expected.listenPort}`), `${filename} must specify ListenPort = ${expected.listenPort}`);
      }
      if (expected.address) {
        assert.ok(content.includes(`Address = ${expected.address}`), `${filename} must specify Address = ${expected.address}`);
      }
      if (expected.allowedIPs) {
        assert.ok(content.includes(`AllowedIPs = ${expected.allowedIPs}`), `${filename} must specify AllowedIPs = ${expected.allowedIPs}`);
      }
    }
  });

  test('4. scripts/network/verify_network_isolation.sh runs and returns 0 exit code', () => {
    const verifyScript = path.join(NETWORK_DIR, 'verify_network_isolation.sh');
    const output = execSync(`bash "${verifyScript}"`, { encoding: 'utf8' });

    assert.match(output, /All network isolation policy checks passed successfully/);
    assert.doesNotMatch(output, /FAIL/);
  });
});
