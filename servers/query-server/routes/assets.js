import express from 'express';
import * as db from '../config/db.js';
import logger from '../../../lib/logger.js';
const router = express.Router();

async function ensurePositionColumns() {
  try {
    const [cols] = await db.pool.execute("SHOW COLUMNS FROM assets LIKE 'pos_x'");
    if (!cols || cols.length === 0) {
      await db.query('ALTER TABLE assets ADD COLUMN pos_x INT DEFAULT NULL, ADD COLUMN pos_y INT DEFAULT NULL');
    }
  } catch (err) {
    logger.error('ensurePositionColumns failed: ' + (err.message || err), { stack: err.stack });
  }
}

async function ensureInterfaceNameColumn() {
  try {
    const [cols] = await db.pool.execute("SHOW COLUMNS FROM assets LIKE 'interface_name'");
    if (!cols || cols.length === 0) {
      await db.query('ALTER TABLE assets ADD COLUMN interface_name VARCHAR(128) DEFAULT NULL AFTER ip');
    }
  } catch (err) {
    logger.error('ensureInterfaceNameColumn failed: ' + (err.message || err), { stack: err.stack });
  }
}

router.get('/', async (req, res) => {
  try {
    await ensurePositionColumns();
    await ensureInterfaceNameColumn();
    let rows = await db.query('SELECT id, device_id, type, location, role, ip, interface_name, pos_x, pos_y, created_at FROM assets ORDER BY device_id');
    if (!rows) rows = [];
    res.json({ success: true, assets: rows });
  } catch (err) {
    logger.error('assets GET /: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/list-for-telemetry', async (req, res) => {
  try {
    const rows = await db.query(
      "SELECT MIN(id) AS id, device_id, MIN(ip) AS ip FROM assets WHERE type IN ('router', 'switch') GROUP BY device_id ORDER BY device_id LIMIT 50"
    );
    res.json({ success: true, assets: rows || [] });
  } catch (err) {
    logger.error('assets GET /list-for-telemetry: ' + (err.message || err));
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensurePositionColumns();
    await ensureInterfaceNameColumn();
    const { device_id, type, role, location, ip, interface_name, pos_x, pos_y } = req.body || {};
    if (!device_id) return res.status(400).json({ success: false, error: 'device_id required' });
    const typeVal = ['router', 'switch', 'server', 'other'].includes(String(type)) ? String(type) : 'other';
    const roleVal = ['hq', 'research', 'datacenter', 'control', 'other'].includes(String(role)) ? String(role) : 'other';
    const numX = pos_x != null ? Number(pos_x) : null;
    const numY = pos_y != null ? Number(pos_y) : null;
    await db.query(
      'INSERT INTO assets (device_id, type, role, location, ip, interface_name, pos_x, pos_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        String(device_id).trim(),
        typeVal,
        roleVal,
        location || null,
        ip ? String(ip).trim() : null,
        interface_name ? String(interface_name).trim() : null,
        Number.isFinite(numX) ? numX : null,
        Number.isFinite(numY) ? numY : null
      ]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    logger.error('assets POST /: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    await ensurePositionColumns();
    await ensureInterfaceNameColumn();
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid asset id' });
    const { device_id, type, role, location, ip, interface_name, pos_x, pos_y } = req.body || {};
    const updates = [];
    const values = [];
    if (device_id !== undefined) { updates.push('device_id = ?'); values.push(String(device_id).trim()); }
    if (type !== undefined) {
      const typeVal = ['router', 'switch', 'server', 'other'].includes(String(type)) ? String(type) : 'other';
      updates.push('type = ?'); values.push(typeVal);
    }
    if (role !== undefined) {
      const roleVal = ['hq', 'research', 'datacenter', 'control', 'other'].includes(String(role)) ? String(role) : 'other';
      updates.push('role = ?'); values.push(roleVal);
    }
    if (location !== undefined) { updates.push('location = ?'); values.push(location || null); }
    if (ip !== undefined) { updates.push('ip = ?'); values.push(ip ? String(ip).trim() : null); }
    if (interface_name !== undefined) { updates.push('interface_name = ?'); values.push(interface_name ? String(interface_name).trim() : null); }
    if (pos_x !== undefined) {
      const numX = pos_x != null ? Number(pos_x) : null;
      updates.push('pos_x = ?'); values.push(Number.isFinite(numX) ? numX : null);
    }
    if (pos_y !== undefined) {
      const numY = pos_y != null ? Number(pos_y) : null;
      updates.push('pos_y = ?'); values.push(Number.isFinite(numY) ? numY : null);
    }
    if (!updates.length) return res.status(400).json({ success: false, error: 'No fields to update' });
    values.push(id);
    await db.query('UPDATE assets SET ' + updates.join(', ') + ' WHERE id = ?', values);
    res.json({ success: true });
  } catch (err) {
    logger.error('assets PATCH /: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid asset id' });
    await db.query('DELETE FROM assets WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('assets DELETE /: ' + (err.message || err), { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
