import express from 'express';
import * as queryClient from '../lib/queryClient.js';
import requireAdmin from '../middleware/requireAdmin.js';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const assets = await queryClient.getAssets();
    res.json({ success: true, assets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { device_id, type, role, location, ip, interface_name, pos_x, pos_y } = req.body || {};
    const result = await queryClient.insertAsset({ device_id, type, role, location, ip, interface_name, pos_x, pos_y });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await queryClient.updateAsset(req.params.id, req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await queryClient.deleteAsset(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
