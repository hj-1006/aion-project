import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERTS_DIR = path.join(__dirname, './ssl');
const certPath = path.join(CERTS_DIR, 'cert.pem');
const keyPath = path.join(CERTS_DIR, 'key.pem');
const httpsOptions = {
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
};

console.log(httpsOptions);
