import dgram from 'dgram';
import * as db from '../config/db.js';

const SYSLOG_PORT = parseInt(process.env.SYSLOG_PORT || '5514', 10);

// RFC 3164 / 5424 minimal parse: <priority>timestamp host message
function parseSyslog(buf) {
  const raw = buf.toString('utf8', 0, Math.min(buf.length, 8192));
  let priority = null;
  let facility = null;
  let severity = null;
  let host_from = null;
  let message = raw;
  const priMatch = raw.match(/^<(\d+)>/);
  if (priMatch) {
    const pri = parseInt(priMatch[1], 10);
    facility = String(Math.floor(pri / 8));
    severity = String(pri % 8);
  }
  const rest = raw.replace(/^<\d+>/, '').trim();
  const parts = rest.match(/^(\S+)\s+(\S+)\s+(.+)$/);
  if (parts) {
    host_from = parts[2];
    message = parts[3];
  }
  return { facility, severity, message, raw, host_from };
}

let server = null;

function startSyslogServer() {
  server = dgram.createSocket('udp4');
  server.on('message', async (msg, rinfo) => {
    try {
      const { facility, severity, message, raw, host_from } = parseSyslog(msg);
      await db.query(
        'INSERT INTO syslog_events (asset_id, severity, facility, message, raw, host_from) VALUES (NULL, ?, ?, ?, ?, ?)',
        [severity, facility, message, raw, host_from || rinfo.address]
      );
    } catch (err) {
      console.error('Syslog insert error:', err.message);
    }
  });
  server.on('error', (err) => {
    console.error('Syslog UDP error:', err.message);
  });
  server.bind(SYSLOG_PORT, () => {
    console.log(`Syslog UDP listening on port ${SYSLOG_PORT}`);
  });
}

export { startSyslogServer };
