import { firebaseServices } from '../../../lib/server/firebase.js';
import { methodNotAllowed, readBody, requireUser, roomCode, sendError } from '../../../lib/server/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  try {
    const user = await requireUser(req);
    const code = roomCode(req);
    const body = readBody(req);
    const name = String(body.name || '').trim().slice(0, 24) || 'Teman';
    const topic = String(body.topic || '').trim().slice(0, 120);
    if (!topic) return res.status(400).json({ error: 'Topik peserta tidak valid.' });

    const { database } = firebaseServices();
    const roomRef = database.ref(`rooms/${code}`);
    const snapshot = await roomRef.get();
    if (!snapshot.exists()) return res.status(404).json({ error: 'Sesi tidak ditemukan. Periksa kembali kodenya.' });
    const room = snapshot.val();
    if (room.phase === 'done') return res.status(409).json({ error: 'Sesi ini sudah selesai.' });
    await roomRef.child(`participants/${user.uid}`).set({ name, topic, joinedAt: Date.now(), scores: {} });
    return res.status(200).json({ joined: true });
  } catch (error) {
    return sendError(res, error);
  }
}
