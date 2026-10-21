import { firebaseServices } from './firebase.js';

export function methodNotAllowed(res, method) {
  res.setHeader('Allow', method);
  return res.status(405).json({ error: 'Metode permintaan tidak didukung.' });
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export async function requireUser(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Sesi login anonim tidak ditemukan. Muat ulang halaman dan coba lagi.');
    error.statusCode = 401;
    throw error;
  }
  const { auth } = firebaseServices();
  try {
    return await auth.verifyIdToken(match[1]);
  } catch {
    const error = new Error('Sesi sudah kedaluwarsa. Muat ulang halaman dan coba lagi.');
    error.statusCode = 401;
    throw error;
  }
}

export function roomCode(req) {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    const error = new Error('Kode sesi tidak valid.');
    error.statusCode = 400;
    throw error;
  }
  return code;
}

export function sendError(res, error) {
  console.error(error);
  const status = error.statusCode || 500;
  const message = status < 500 ? error.message : 'Layanan sesi sedang bermasalah. Coba lagi sebentar.';
  return res.status(status).json({ error: message });
}
