import path from 'path';
import fs from 'fs';
import winston from 'winston';

const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const serviceName = process.env.SERVICE_NAME || 'aion';

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, ...meta }) =>
        `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
      )
    )
  })
];

if (logDir) {
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}.log`),
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json()
        )
      }),
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}.error.log`),
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json()
        )
      })
    );
  } catch (e) {
    // logDir not writable; file transports skipped, console only
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: serviceName },
  transports
});

export default logger;
