import { randomInt } from 'node:crypto';
import { firebaseServices } from '../../lib/server/firebase.js';
import { methodNotAllowed, readBody, requireUser, sendError } from '../../lib/server/http.js';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function makeCode() {
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  try {
    const user = await requireUser(req);
    const body = readBody(req);
    const name = String(body.name || '').trim().slice(0, 24) || 'Tuan rumah';
    const topic = String(body.topic || '').trim().slice(0, 120);
    const researchMins = Number(body.researchMins);
    const speakMins = Number(body.speakMins);
    if (!topic) return res.status(400).json({ error: 'Pilih topik sebelum membuat sesi.' });
    if (!Number.isInteger(researchMins) || researchMins < 1 || researchMins > 60 || !Number.isInteger(speakMins) || speakMins < 1 || speakMins > 30) {
      return res.status(400).json({ error: 'Waktu riset harus 1–60 menit dan waktu bicara 1–30 menit.' });
    }

    const { database } = firebaseServices();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = makeCode();
      const room = {
        code,
        host: user.uid,
        createdAt: Date.now(),
        topic,
        researchMins,
        speakMins,
        phase: 'waiting',
        phaseEndsAt: null,
        participants: {
          [user.uid]: { name, topic, joinedAt: Date.now(), scores: {} },
        },
      };
      const result = await database.ref(`rooms/${code}`).transaction(current => current === null ? room : undefined, undefined, false);
      if (result.committed) return res.status(201).json({ code });
    }
    return res.status(503).json({ error: 'Tidak dapat membuat kode sesi saat ini. Coba lagi.' });
  } catch (error) {
    return sendError(res, error);
  }
}
