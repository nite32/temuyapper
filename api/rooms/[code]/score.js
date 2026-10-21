import { firebaseServices } from '../../../lib/server/firebase.js';
import { methodNotAllowed, readBody, requireUser, roomCode, sendError } from '../../../lib/server/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  try {
    const user = await requireUser(req);
    const code = roomCode(req);
    const { participantUid, score } = readBody(req);
    if (typeof participantUid !== 'string' || !Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Pilih nilai dari 1 sampai 5.' });
    }
    if (participantUid === user.uid) return res.status(400).json({ error: 'Kamu tidak bisa menilai dirimu sendiri.' });

    const { database } = firebaseServices();
    const roomSnapshot = await database.ref(`rooms/${code}`).get();
    if (!roomSnapshot.exists() || roomSnapshot.val().phase !== 'done') {
      return res.status(409).json({ error: 'Penilaian tersedia setelah sesi selesai.' });
    }
    const room = roomSnapshot.val();
    if (!room.participants?.[user.uid] || !room.participants?.[participantUid]) {
      return res.status(403).json({ error: 'Peserta sesi tidak ditemukan.' });
    }
    await database.ref(`rooms/${code}/participants/${participantUid}/scores/${user.uid}`).set(score);
    return res.status(200).json({ saved: true });
  } catch (error) {
    return sendError(res, error);
  }
}
