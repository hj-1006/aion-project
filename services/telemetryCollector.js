import * as db from '../config/db.js';

const POLL_MS = parseInt(process.env.TELEMETRY_POLL_INTERVAL_MS || '60000', 10);
let intervalId = null;

async function collectAndStore() {
  try {
    const assets = await db.query('SELECT id, device_id, ip FROM assets LIMIT 20');
    let snmp;
    try {
      snmp = (await import('net-snmp')).default;
    } catch (_) {
      snmp = null;
    }
    for (const a of assets) {
      const value = { device_id: a.device_id, cpu_pct: null, mem_pct: null, temp_c: null };
      if (snmp && a.ip) {
        try {
          const session = snmp.createSession(a.ip, process.env.SNMP_COMMUNITY || 'public');
          const oids = ['1.3.6.1.4.1.9.9.109.1.1.1.1.6.1'];
          session.get(oids, (err, varbinds) => {
            session.close();
            if (!err && varbinds && varbinds[0]) value.cpu_pct = Number(varbinds[0].value);
            db.query(
              'INSERT INTO telemetry_snapshots (asset_id, metric_type, value_json) VALUES (?, ?, ?)',
              [a.id, 'cpu', JSON.stringify(value)]
            ).catch((e) => console.error('Telemetry insert:', e.message));
          });
        } catch (_) {
          await db.query(
            'INSERT INTO telemetry_snapshots (asset_id, metric_type, value_json) VALUES (?, ?, ?)',
            [a.id, 'cpu', JSON.stringify(value)]
          ).catch((e) => console.error('Telemetry insert:', e.message));
        }
      } else {
        await db.query(
          'INSERT INTO telemetry_snapshots (asset_id, metric_type, value_json) VALUES (?, ?, ?)',
          [a.id, 'cpu', JSON.stringify(value)]
        ).catch((e) => console.error('Telemetry insert:', e.message));
      }
    }
  } catch (err) {
    console.error('Telemetry collect:', err.message);
  }
}

function startTelemetryCollector() {
  if (intervalId) return;
  collectAndStore();
  intervalId = setInterval(collectAndStore, POLL_MS);
  console.log('Telemetry collector started, interval ms:', POLL_MS);
}

export { startTelemetryCollector, collectAndStore };
