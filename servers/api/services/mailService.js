/**
 * 내부망 메일 서버(SMTP) 연동
 * 환경변수: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 */
import nodemailer from 'nodemailer';
import logger from '../../../lib/logger.js';

function getTransporter() {
  let host = (process.env.SMTP_HOST || '').trim();
  const port = parseInt(process.env.SMTP_PORT || '25', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host) {
    return { transporter: null, error: 'SMTP_HOST가 설정되지 않았습니다.' };
  }
  if (host.toLowerCase() === 'localhost') {
    host = '127.0.0.1';
  }

  const config = {
    host,
    port,
    secure,
    tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true' }
  };
  if (user && pass) {
    config.auth = { user, pass };
  }

  try {
    const transporter = nodemailer.createTransport(config);
    return { transporter, error: null };
  } catch (err) {
    logger.error('mailService createTransport: ' + (err.message || err));
    return { transporter: null, error: err.message || 'SMTP 설정 오류' };
  }
}

/**
 * 메일 발송
 */
async function sendMail(opts) {
  const { to, subject, text, html, from: fromOpt } = opts || {};
  if (!to || !subject) {
    return { success: false, message: '수신(to), 제목(subject)은 필수입니다.' };
  }

  const { transporter, error } = getTransporter();
  if (error || !transporter) {
    return { success: false, message: error || 'SMTP를 사용할 수 없습니다.' };
  }

  const from = (fromOpt && fromOpt.trim()) || process.env.MAIL_FROM || process.env.SMTP_USER || 'aion@localhost';

  try {
    await transporter.sendMail({
      from,
      to: Array.isArray(to) ? to.join(', ') : String(to),
      subject: String(subject),
      text: text || (html ? undefined : '(본문 없음)'),
      html: html || undefined
    });
    logger.info('Mail sent to ' + to + ' subject=' + subject);
    return { success: true, message: '발송되었습니다.' };
  } catch (err) {
    logger.error('Mail send error: ' + (err.message || err), { stack: err.stack });
    return { success: false, message: err.message || '발송 실패' };
  }
}

async function verifyConnection() {
  const { transporter, error } = getTransporter();
  if (error || !transporter) return { ok: false, message: error || 'SMTP 미설정' };
  try {
    await transporter.verify();
    return { ok: true, message: '연결됨' };
  } catch (err) {
    return { ok: false, message: err.message || '연결 실패' };
  }
}

export { sendMail, getTransporter, verifyConnection };
