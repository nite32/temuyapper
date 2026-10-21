import { firebaseServices } from '../../../lib/server/firebase.js';
import { methodNotAllowed, readBody, requireUser, roomCode, sendError } from '../../../lib/server/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  try {
    const user = await requireUser(req);
    const code = roomCode(req);
    const { expectedPhase } = readBody(req);
    if (!['waiting', 'research', 'speaking'].includes(expectedPhase)) {
      return res.status(400).json({ error: 'Tahap sesi tidak valid.' });
    }

    const { database } = firebaseServices();
    const result = await database.ref(`rooms/${code}`).transaction(room => {
      if (!room || room.host !== user.uid || room.phase !== expectedPhase) return undefined;
      const now = Date.now();
      if (room.phase === 'waiting') return { ...room, phase: 'research', phaseEndsAt: now + room.researchMins * 60_000 };
      if (room.phase === 'research') return { ...room, phase: 'speaking', phaseEndsAt: now + room.speakMins * 60_000 };
      return { ...room, phase: 'done', phaseEndsAt: null };
    }, undefined, false);

    if (!result.committed) return res.status(409).json({ error: 'Sesi sudah berubah. Tunggu pembaruan sebelum mencoba lagi.' });
    return res.status(200).json({ phase: result.snapshot.val().phase });
  } catch (error) {
    return sendError(res, error);
  }
}
