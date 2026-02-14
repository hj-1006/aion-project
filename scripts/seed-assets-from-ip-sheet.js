#!/usr/bin/env node
/**
 * AION IP관리대장 기반 assets 시드
 * - 기존 assets 삭제 후 인터페이스별 row INSERT
 * - device_id별 동일 pos_x, pos_y 부여 (토폴로지 1노드/기기)
 * 사용: node scripts/seed-assets-from-ip-sheet.js
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = await import('../config/db.js');
const { query, pool } = db;

function deviceType(deviceId) {
  if (!deviceId) return 'other';
  if (/^ISP_R\d+$/.test(deviceId)) return 'router';
  if (/^BB_R\d+$/.test(deviceId)) return 'router';
  if (/^BB_L3SW\d+$/.test(deviceId)) return 'switch';
  if (/^LAB_L3SW\d+$/.test(deviceId)) return 'switch';
  if (/^Management_L2SW\d+$/.test(deviceId)) return 'switch';
  if (/^Research_L2SW\d+$/.test(deviceId)) return 'switch';
  if (/^Server_L2SW\d+$/.test(deviceId)) return 'switch';
  return 'switch';
}

function deviceRole(deviceId) {
  if (!deviceId) return 'other';
  if (/^Research_L2SW\d+$/.test(deviceId)) return 'research';
  if (/^Server_L2SW\d+$/.test(deviceId)) return 'datacenter';
  if (/^Management_L2SW\d+$/.test(deviceId)) return 'control';
  return 'other';
}

const LAYOUT = {
  ISP_R1: { x: 120, y: 60 },
  ISP_R2: { x: 320, y: 60 },
  BB_L3SW1: { x: 120, y: 160 },
  BB_L3SW2: { x: 320, y: 160 },
  BB_R1: { x: 120, y: 260 },
  BB_R2: { x: 320, y: 260 },
  LAB_L3SW1: { x: 120, y: 360 },
  LAB_L3SW2: { x: 320, y: 360 },
  Management_L2SW1: { x: 520, y: 120 },
  Management_L2SW2: { x: 720, y: 120 },
  Research_L2SW1: { x: 520, y: 280 },
  Server_L2SW1: { x: 520, y: 400 },
  Server_L2SW2: { x: 720, y: 400 }
};

const INTERFACES = [
  { device_id: 'ISP_R1', interface_name: 'GigaEthernet 0/0', ip: '172.16.1.1' },
  { device_id: 'ISP_R1', interface_name: 'Serial 0/0/0', ip: '172.16.0.1' },
  { device_id: 'ISP_R1', interface_name: 'Loopback 0', ip: '8.8.8.8' },
  { device_id: 'ISP_R2', interface_name: 'GigaEthernet 0/0', ip: '172.16.4.1' },
  { device_id: 'ISP_R2', interface_name: 'GigaEthernet 0/1', ip: '52.219.60.1' },
  { device_id: 'ISP_R2', interface_name: 'Serial 0/0/0', ip: '172.16.0.2' },
  { device_id: 'ISP_R2', interface_name: 'Loopback 0', ip: '8.8.4.4' },
  { device_id: 'BB_L3SW1', interface_name: 'FastEthernet 0/1', ip: '172.16.1.2' },
  { device_id: 'BB_L3SW1', interface_name: 'FastEthernet 0/2', ip: '172.16.2.1' },
  { device_id: 'BB_L3SW1', interface_name: 'FastEthernet 0/3', ip: '172.16.7.1' },
  { device_id: 'BB_L3SW1', interface_name: 'FastEthernet 0/4', ip: null },
  { device_id: 'BB_L3SW1', interface_name: 'FastEthernet 0/5', ip: null },
  { device_id: 'BB_L3SW1', interface_name: 'VLAN 200 (SVI)', ip: '172.16.200.2' },
  { device_id: 'BB_L3SW1', interface_name: 'VLAN 255 (SVI)', ip: '172.16.255.2' },
  { device_id: 'BB_L3SW2', interface_name: 'FastEthernet 0/1', ip: '172.16.4.2' },
  { device_id: 'BB_L3SW2', interface_name: 'FastEthernet 0/2', ip: '172.16.5.1' },
  { device_id: 'BB_L3SW2', interface_name: 'FastEthernet 0/3', ip: '172.16.7.2' },
  { device_id: 'BB_L3SW2', interface_name: 'FastEthernet 0/4', ip: null },
  { device_id: 'BB_L3SW2', interface_name: 'FastEthernet 0/5', ip: null },
  { device_id: 'BB_L3SW2', interface_name: 'VLAN 200 (SVI)', ip: '172.16.200.3' },
  { device_id: 'BB_L3SW2', interface_name: 'VLAN 255 (SVI)', ip: '172.16.255.3' },
  { device_id: 'BB_R1', interface_name: 'GigaEthernet 0/0', ip: '172.16.2.2' },
  { device_id: 'BB_R1', interface_name: 'GigaEthernet 0/1', ip: '172.16.3.1' },
  { device_id: 'BB_R1', interface_name: 'Serial 0/0/0', ip: '172.16.8.1' },
  { device_id: 'BB_R2', interface_name: 'GigaEthernet 0/0', ip: '172.16.5.2' },
  { device_id: 'BB_R2', interface_name: 'GigaEthernet 0/1', ip: '172.16.6.1' },
  { device_id: 'BB_R2', interface_name: 'Serial 0/0/0', ip: '172.16.8.2' },
  { device_id: 'LAB_L3SW1', interface_name: 'FastEthernet 0/1', ip: '172.16.3.2' },
  { device_id: 'LAB_L3SW1', interface_name: 'FastEthernet 0/2', ip: null },
  { device_id: 'LAB_L3SW1', interface_name: 'FastEthernet 0/3', ip: null },
  { device_id: 'LAB_L3SW1', interface_name: 'FastEthernet 0/4', ip: null },
  { device_id: 'LAB_L3SW1', interface_name: 'FastEthernet 0/5', ip: null },
  { device_id: 'LAB_L3SW1', interface_name: 'FastEthernet 0/6', ip: null },
  { device_id: 'LAB_L3SW1', interface_name: 'VLAN 7 (SVI)', ip: '172.16.9.1' },
  { device_id: 'LAB_L3SW1', interface_name: 'VLAN 10 (SVI)', ip: '10.6.0.2' },
  { device_id: 'LAB_L3SW1', interface_name: 'VLAN 200 (SVI)', ip: '192.168.200.2' },
  { device_id: 'LAB_L3SW2', interface_name: 'FastEthernet 0/1', ip: '172.16.6.2' },
  { device_id: 'LAB_L3SW2', interface_name: 'FastEthernet 0/2', ip: null },
  { device_id: 'LAB_L3SW2', interface_name: 'FastEthernet 0/3', ip: null },
  { device_id: 'LAB_L3SW2', interface_name: 'FastEthernet 0/4', ip: null },
  { device_id: 'LAB_L3SW2', interface_name: 'FastEthernet 0/5', ip: null },
  { device_id: 'LAB_L3SW2', interface_name: 'FastEthernet 0/6', ip: null },
  { device_id: 'LAB_L3SW2', interface_name: 'VLAN 7 (SVI)', ip: '172.16.9.2' },
  { device_id: 'LAB_L3SW2', interface_name: 'VLAN 10 (SVI)', ip: '10.6.0.3' },
  { device_id: 'LAB_L3SW2', interface_name: 'VLAN 200 (SVI)', ip: '192.168.200.3' },
  { device_id: 'Management_L2SW1', interface_name: 'FastEthernet 0/1', ip: null },
  { device_id: 'Management_L2SW1', interface_name: 'FastEthernet 0/2', ip: null },
  { device_id: 'Management_L2SW1', interface_name: 'FastEthernet 0/3', ip: null },
  { device_id: 'Management_L2SW1', interface_name: 'FastEthernet 0/13', ip: null },
  { device_id: 'Management_L2SW1', interface_name: 'VLAN 255 (SVI)', ip: '172.16.255.253' },
  { device_id: 'Management_L2SW2', interface_name: 'FastEthernet 0/1', ip: null },
  { device_id: 'Management_L2SW2', interface_name: 'FastEthernet 0/2', ip: null },
  { device_id: 'Management_L2SW2', interface_name: 'FastEthernet 0/3', ip: null },
  { device_id: 'Management_L2SW2', interface_name: 'FastEthernet 0/13', ip: null },
  { device_id: 'Management_L2SW2', interface_name: 'FastEthernet 0/14', ip: null },
  { device_id: 'Management_L2SW2', interface_name: 'VLAN 255 (SVI)', ip: '172.16.255.254' },
  { device_id: 'Research_L2SW1', interface_name: 'FastEthernet 0/1', ip: null },
  { device_id: 'Research_L2SW1', interface_name: 'FastEthernet 0/2', ip: null },
  { device_id: 'Research_L2SW1', interface_name: 'FastEthernet 0/13', ip: null },
  { device_id: 'Research_L2SW1', interface_name: 'FastEthernet 0/14', ip: null },
  { device_id: 'Research_L2SW1', interface_name: 'FastEthernet 0/15', ip: null },
  { device_id: 'Research_L2SW1', interface_name: 'FastEthernet 0/16', ip: null },
  { device_id: 'Research_L2SW1', interface_name: 'VLAN 10 (SVI)', ip: '10.6.10.254' },
  { device_id: 'Server_L2SW1', interface_name: 'FastEthernet 0/1', ip: null },
  { device_id: 'Server_L2SW1', interface_name: 'FastEthernet 0/2', ip: null },
  { device_id: 'Server_L2SW1', interface_name: 'FastEthernet 0/3', ip: null },
  { device_id: 'Server_L2SW1', interface_name: 'FastEthernet 0/13', ip: null },
  { device_id: 'Server_L2SW1', interface_name: 'FastEthernet 0/14', ip: null },
  { device_id: 'Server_L2SW1', interface_name: 'VLAN 200 (SVI)', ip: '192.168.200.253' },
  { device_id: 'Server_L2SW2', interface_name: 'FastEthernet 0/1', ip: null },
  { device_id: 'Server_L2SW2', interface_name: 'FastEthernet 0/2', ip: null },
  { device_id: 'Server_L2SW2', interface_name: 'FastEthernet 0/3', ip: null },
  { device_id: 'Server_L2SW2', interface_name: 'FastEthernet 0/13', ip: null },
  { device_id: 'Server_L2SW2', interface_name: 'FastEthernet 0/14', ip: null },
  { device_id: 'Server_L2SW2', interface_name: 'VLAN 200 (SVI)', ip: '192.168.200.254' }
];

async function ensureMigration() {
  const [cols] = await pool.execute("SHOW COLUMNS FROM assets LIKE 'interface_name'");
  if (cols && cols.length > 0) return;
  const sqlPath = path.join(__dirname, '../sql/migrations/006_add_asset_interface_name.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8').replace(/\s*;\s*$/, '').trim();
  await query(sql);
  console.log('Applied migration 006 (interface_name)');
}

async function main() {
  await ensureMigration();
  await query('DELETE FROM assets');
  console.log('Deleted existing assets');

  const insertSql = `INSERT INTO assets (device_id, type, role, location, ip, interface_name, pos_x, pos_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  for (const iface of INTERFACES) {
    const pos = LAYOUT[iface.device_id] || { x: 500, y: 260 };
    const type = deviceType(iface.device_id);
    const role = deviceRole(iface.device_id);
    await query(insertSql, [
      iface.device_id,
      type,
      role,
      null,
      iface.ip || null,
      iface.interface_name || null,
      pos.x,
      pos.y
    ]);
  }

  console.log(`Inserted ${INTERFACES.length} asset rows (interfaces). Run monitor to see devices merged by device_id.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
