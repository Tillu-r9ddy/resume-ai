#!/usr/bin/env node
/**
 * Free a TCP port before `npm run dev` starts Vite.
 *
 * Why: a stray Vite (or any node) process bound to the dev port — often started
 * from the wrong cwd, so it serves 404 for `/` — will block a fresh Vite from
 * binding, or worse, silently win the port and confuse the browser. This guard
 * kills lingering *node* processes on the port. Non-node holders are reported
 * and left alone (could be another dev server you care about).
 */
import { execFileSync, spawnSync } from 'node:child_process';

const PORT = Number(process.argv[2] ?? 5173);
const isWindows = process.platform === 'win32';

function pidsOnPort(port) {
  if (isWindows) {
    const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout ?? '';
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      // e.g.  TCP    [::1]:5173    [::]:0    LISTENING    16840
      const m = line.match(/\s(?:TCP|UDP)\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
      if (m && Number(m[1]) === port) pids.add(m[2]);
    }
    return [...pids];
  }
  const out = spawnSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout ?? '';
  return out.split(/\s+/).filter(Boolean);
}

function processName(pid) {
  if (isWindows) {
    const out = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).stdout ?? '';
    const m = out.match(/^"([^"]+)"/m);
    return m ? m[1] : '';
  }
  const out = spawnSync('ps', ['-p', pid, '-o', 'comm='], { encoding: 'utf8' }).stdout ?? '';
  return out.trim();
}

function kill(pid) {
  if (isWindows) execFileSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
  else execFileSync('kill', ['-9', pid], { stdio: 'ignore' });
}

const pids = pidsOnPort(PORT);
if (pids.length === 0) process.exit(0);

for (const pid of pids) {
  const name = processName(pid).toLowerCase();
  if (name.includes('node')) {
    console.log(`[free-port] Killing stale node on :${PORT} (PID ${pid})`);
    try { kill(pid); } catch (err) { console.warn(`[free-port] Failed to kill PID ${pid}: ${err.message}`); }
  } else {
    console.error(`[free-port] Port ${PORT} held by non-node process "${name}" (PID ${pid}). Refusing to kill.`);
    process.exit(1);
  }
}
