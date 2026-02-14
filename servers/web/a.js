import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERTS_DIR = path.join(__dirname, './ssl');
console.log(CERTS_DIR);

const certPath = path.join(CERTS_DIR, 'cert.pem');
const keyPath = path.join(CERTS_DIR, 'key.pem');

console.log(certPath);
console.log(keyPath);
