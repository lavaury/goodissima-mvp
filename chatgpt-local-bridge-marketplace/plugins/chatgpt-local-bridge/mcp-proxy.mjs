#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const target = path.join(os.homedir(), 'plugins', 'chatgpt-local-bridge', 'mcp-server.mjs');
if (!fs.existsSync(target)) {
  console.error(`ChatGPT Local Bridge local server not found: ${target}`);
  process.exit(1);
}

const child = spawn(process.execPath, [target], {
  stdio: ['pipe', 'pipe', 'inherit'],
  windowsHide: true
});

process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);

const stop = () => {
  try { child.kill(); } catch {}
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', code => process.exit(code ?? 0));
child.on('error', err => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
