import express from 'express';
import { execFile } from 'child_process';
const router = express.Router();

function isValidIp(ip) {
  if (!ip) return false;
  const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const v6 = /^[0-9a-fA-F:]+$/;
  return v4.test(ip) || v6.test(ip);
}

function parsePingMs(output) {
  const match = output.match(/time[=<]([\d.]+)\s*ms/);
  if (!match) return null;
  return Number(match[1]);
}

function parseTraceroute(output) {
  const lines = String(output || '').split('\n');
  const hops = [];
  lines.forEach((line) => {
    const hopMatch = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!hopMatch) return;
    const hop = parseInt(hopMatch[1], 10);
    const rest = hopMatch[2];
    const ipMatch = rest.match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]+)/);
    const ip = ipMatch ? ipMatch[1] : null;
    const rttMatches = rest.match(/([\d.]+)\s*ms/g) || [];
    const rtts = rttMatches.map((v) => Number(v.replace('ms', '').trim())).filter((v) => !isNaN(v));
    const avg = rtts.length ? (rtts.reduce((a, b) => a + b, 0) / rtts.length) : null;
    hops.push({ hop, ip, rtt_ms: avg });
  });
  return hops;
}

router.get('/ping', (req, res) => {
  const ip = String(req.query.ip || '').trim();
  if (!isValidIp(ip)) return res.status(400).json({ success: false, message: 'Invalid ip' });
  execFile('ping', ['-c', '1', '-W', '1', ip], { timeout: 4000 }, (err, stdout) => {
    if (err) {
      return res.json({ success: true, status: 'timeout', ip, ms: null });
    }
    const ms = parsePingMs(stdout);
    if (ms == null) return res.json({ success: true, status: 'timeout', ip, ms: null });
    res.json({ success: true, status: 'ok', ip, ms });
  });
});

router.get('/traceroute', (req, res) => {
  const ip = String(req.query.ip || '').trim();
  if (!isValidIp(ip)) return res.status(400).json({ success: false, message: 'Invalid ip' });
  execFile('traceroute', ['-n', '-m', '15', '-w', '1', ip], { timeout: 8000 }, (err, stdout) => {
    if (err && !stdout) {
      return res.json({ success: true, status: 'timeout', ip, hops: [] });
    }
    const hops = parseTraceroute(stdout);
    const hasReply = hops.some((h) => h.ip);
    res.json({ success: true, status: hasReply ? 'ok' : 'timeout', ip, hops });
  });
});

export default router;
