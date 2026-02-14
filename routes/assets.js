import express from 'express';
import * as db from '../config/db.js';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let rows = await db.query('SELECT id, device_id, type, location, role, ip, interface_name, pos_x, pos_y, created_at FROM assets ORDER BY device_id');
    res.json({ success: true, assets: rows || [] });
  } catch (err) {
    try {
      const rows = await db.query('SELECT id, device_id, type, location, role, ip, pos_x, pos_y, created_at FROM assets ORDER BY device_id');
      res.json({ success: true, assets: rows || [] });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: e.message });
    }
  }
});

export default router;
