import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getDatabase, onValue, ref } from 'firebase/database';

const TOPICS = [
  { emoji: '☕', text: 'Apakah kopi enak karena rasanya atau kebiasaannya?' },
  { emoji: '🌙', text: 'Apakah kita lebih jujur saat malam hari?' },
  { emoji: '📱', text: 'Bisakah kita benar-benar hidup tanpa internet?' },
  { emoji: '✈️', text: 'Lebih baik sering jalan-jalan atau punya rumah impian?' },
  { emoji: '🎨', text: 'Apakah seni harus punya makna untuk dinikmati?' },
  { emoji: '🧠', text: 'Lebih baik jadi ahli satu hal atau tahu sedikit banyak hal?' },
  { emoji: '🍜', text: 'Sarapan itu penting atau cuma kebiasaan?' },
  { emoji: '🌱', text: 'Apa perubahan kecil bisa mengubah hidup seseorang?' },
  { emoji: '🎧', text: 'Musik mengubah suasana hati atau cuma mencerminkannya?' },
  { emoji: '📚', text: 'Buku bagus harus menghibur atau mengubah cara berpikir?' },
  { emoji: '🐈', text: 'Hewan peliharaan lebih mirip teman atau keluarga?' },
  { emoji: '💭', text: 'Apakah semua orang punya satu tujuan hidup?' },
];

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const hasFirebaseConfig = Object.values(firebaseConfig).every(value => typeof value === 'string' && value.trim());
const sessionDialog = $('#sessionDialog');
const activeDialog = $('#activeDialog');
const customDialog = $('#customDialog');

let database;
let auth;
let authUser;
let activeApp;
let currentRoomCode;
let roomUnsubscribe;
let timerHandle;
let toastHandle;
let advancing = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => toast.classList.remove('show'), 3200);
}

function customTopics() {
  try { return JSON.parse(localStorage.getItem('temu-custom-topics') || '[]'); }
  catch { return []; }
}

function allTopics() { return [...TOPICS, ...customTopics()]; }

function renderTopicGrid() {
  $('#topicGrid').innerHTML = allTopics().slice(0, 9).map(topic => `
    <article class="topic-tile" tabindex="0" role="button" data-topic="${escapeHtml(topic.text)}">
      <span class="tile-emoji">${escapeHtml(topic.emoji || '✳')}</span>
      <h3>${escapeHtml(topic.text)}</h3><span class="tile-arrow" aria-hidden="true">↗</span>
    </article>`).join('');
  $$('.topic-tile').forEach(tile => {
    const select = () => openSession(tile.dataset.topic);
    tile.addEventListener('click', select);
    tile.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
    });
  });
}

function renderTopicOptions() {
  $('#sessionTopic').innerHTML = allTopics().map(topic =>
    `<option value="${escapeHtml(topic.text)}">${escapeHtml(topic.emoji || '✳')} ${escapeHtml(topic.text)}</option>`).join('');
}

function openSession(topic) {
  renderTopicOptions();
  if (topic) $('#sessionTopic').value = topic;
  $('#backendNote').innerHTML = hasFirebaseConfig
    ? 'Sesi online menggunakan database Firebase. Bagikan kode ruang kepada teman.'
    : '<span class="config-warning">Mode pratinjau lokal aktif. Sesi online dapat digunakan setelah konfigurasi Firebase ditambahkan.</span>';
  sessionDialog.showModal();
}

function getLocalRooms() {
  try { return JSON.parse(localStorage.getItem('temu-local-rooms') || '{}'); }
  catch { return {}; }
}

function saveLocalRoom(room) {
  const rooms = getLocalRooms();
  rooms[room.code] = room;
  localStorage.setItem('temu-local-rooms', JSON.stringify(rooms));
}

function getLocalRoom(code) { return getLocalRooms()[code] || null; }

function randomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

function makeParticipant(name, topic) {
  const options = allTopics();
  const assignedTopic = topic || options[Math.floor(Math.random() * options.length)].text;
  return { name: name.trim().slice(0, 24) || 'Teman', topic: assignedTopic, joinedAt: Date.now(), scores: {} };
}

async function connectFirebase() {
  if (!hasFirebaseConfig) throw new Error('Konfigurasi Firebase belum diisi.');
  if (database && authUser) return;
  activeApp = initializeApp(firebaseConfig);
  database = getDatabase(activeApp);
  auth = getAuth(activeApp);
  authUser = await new Promise(resolve => {
    let unsubscribeAuth;
    unsubscribeAuth = onAuthStateChanged(auth, user => {
      unsubscribeAuth();
      resolve(user);
    });
  });
  if (!authUser) authUser = (await signInAnonymously(auth)).user;
}

async function apiRequest(path, payload) {
  await connectFirebase();
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Permintaan belum berhasil. Coba lagi.');
  return result;
}

async function createSession(event) {
  event.preventDefault();
  const name = $('#hostName').value.trim() || 'Tuan rumah';
  const topic = $('#sessionTopic').value;
  const researchMins = Math.max(1, Math.min(60, Number($('#researchMins').value) || 5));
  const speakMins = Math.max(1, Math.min(30, Number($('#speakMins').value) || 2));

  if (!hasFirebaseConfig) {
    const code = randomCode();
    const uid = `local-${Date.now()}`;
    const room = {
      code, host: uid, createdAt: Date.now(), topic, researchMins, speakMins,
      phase: 'waiting', phaseEndsAt: null, local: true,
      participants: { [uid]: { name, topic, joinedAt: Date.now(), scores: {} } },
    };
    authUser = { uid };
    saveLocalRoom(room);
    sessionDialog.close();
    watchRoom(code);
    showToast('Pratinjau sesi lokal dibuat.');
    return;
  }

  try {
    const result = await apiRequest('/api/rooms', { name, topic, researchMins, speakMins });
    sessionDialog.close();
    watchRoom(result.code);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Sesi gagal dibuat. Periksa konfigurasi backend.');
  }
}

async function joinSession(event) {
  event.preventDefault();
  const code = $('#roomCode').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) { showToast('Masukkan kode sesi 6 karakter.'); return; }
  const name = $('#hostName').value.trim() || 'Teman';

  if (!hasFirebaseConfig) {
    const room = getLocalRoom(code);
    if (!room) { showToast('Pratinjau lokal hanya tersedia di browser ini.'); return; }
    const uid = `local-${Date.now()}`;
    room.participants[uid] = makeParticipant(name);
    authUser = { uid };
    saveLocalRoom(room);
    sessionDialog.close();
    watchRoom(code);
    return;
  }

  try {
    await connectFirebase();
    await apiRequest(`/api/rooms/${code}/join`, { name, topic: makeParticipant(name).topic });
    sessionDialog.close();
    watchRoom(code);
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Tidak bisa bergabung ke sesi.');
  }
}

function watchRoom(code) {
  if (roomUnsubscribe) { roomUnsubscribe(); roomUnsubscribe = null; }
  currentRoomCode = code;
  if (!hasFirebaseConfig) {
    const room = getLocalRoom(code);
    if (room) renderRoom(room);
    activeDialog.showModal();
    return;
  }
  roomUnsubscribe = onValue(ref(database, `rooms/${code}`), snapshot => {
    if (!snapshot.exists()) { activeDialog.close(); showToast('Sesi sudah ditutup.'); return; }
    renderRoom(snapshot.val());
  }, error => {
    console.error(error);
    showToast('Koneksi sesi terputus. Periksa aturan Firebase.');
  });
  activeDialog.showModal();
}

function renderRoom(room) {
  const participants = Object.entries(room.participants || {});
  if (!room.participants?.[authUser?.uid]) return;
  const isHost = room.host === authUser.uid;
  const active = room.phase === 'research' || room.phase === 'speaking';
  const phaseName = { waiting: 'SESI SIAP', research: 'WAKTU RISET', speaking: 'WAKTU BICARA', done: 'SESI SELESAI' }[room.phase] || 'SESI';
  const title = room.phase === 'done' ? ['Obrolan yang', 'berkesan.'] : ['Ruang untuk', 'berbagi.'];
  let html = `${room.local ? '<p class="config-warning">Pratinjau lokal di browser ini. Konfigurasikan Firebase agar kode undangan bekerja secara online.</p>' : ''}
    <div class="eyebrow muted">${phaseName}</div><h2>${title[0]} <em>${title[1]}</em></h2>
    <div class="room-code-display" aria-label="Kode sesi ${escapeHtml(room.code)}">${escapeHtml(room.code)}</div>
    <div class="session-meta"><span class="pill">${escapeHtml(room.topic)}</span><span class="pill">${room.researchMins} mnt riset</span><span class="pill">${room.speakMins} mnt bicara</span><span class="pill">${participants.length} peserta</span></div>`;
  html += active
    ? `<div class="countdown" id="countdown" aria-live="polite">--:--</div><p class="session-status">${room.phase === 'research' ? 'Waktu riset. Siapkan pendapatmu.' : 'Giliran bicara. Dengarkan dan tanggapi.'}</p>`
    : `<p class="session-status">${room.phase === 'done' ? 'Diskusi selesai. Beri apresiasi pada kontribusi teman.' : 'Menunggu tuan rumah memulai sesi. Bagikan kode ini kepada temanmu.'}</p>`;
  html += `<div class="participants"><h3>Yang ikut ngobrol</h3>${participants.map(([uid, participant]) => `
    <div class="participant"><span>${escapeHtml(participant.name)}${uid === room.host ? ' <small>· tuan rumah</small>' : ''}<br><small>${escapeHtml(participant.topic || room.topic)}</small></span><span aria-hidden="true">●</span></div>`).join('')}</div>`;

  if (room.phase === 'done') {
    const others = participants.filter(([uid]) => uid !== authUser.uid);
    html += `<h3 class="session-topic-heading">Apresiasi kontribusi</h3><p class="integration-note">Beri nilai 1–5 untuk cara teman menyampaikan ide dan mendengarkan.</p>`;
    html += others.length ? others.map(([uid, participant]) => `<div class="score-row"><span>${escapeHtml(participant.name)}</span><span class="score-buttons">${[1, 2, 3, 4, 5].map(value => `<button class="${participant.scores?.[authUser.uid] === value ? 'selected' : ''}" data-score-user="${escapeHtml(uid)}" data-score="${value}" aria-label="Beri nilai ${value} kepada ${escapeHtml(participant.name)}">${value}</button>`).join('')}</span></div>`).join('') : '<p class="empty-state">Belum ada peserta lain untuk dinilai.</p>';
  }

  const nextLabel = { waiting: 'Mulai riset', research: 'Mulai bicara', speaking: 'Akhiri & beri nilai' }[room.phase];
  html += `<div class="session-actions">${isHost && nextLabel ? `<button class="button primary" id="startPhase">${nextLabel} <span>↗</span></button>` : ''}<button class="button outline" id="copyCode">Salin kode</button></div>
    <p class="integration-note">Diskusi berlangsung langsung atau melalui Discord. Situs ini tidak meminta akses mikrofon.</p>`;

  $('#activeContent').innerHTML = html;
  $('#copyCode').onclick = async () => {
    try { await navigator.clipboard.writeText(room.code); showToast('Kode sesi disalin.'); }
    catch { showToast(`Kode sesi: ${room.code}`); }
  };
  $('#startPhase')?.addEventListener('click', () => advancePhase(room));
  $$('[data-score-user]').forEach(button => button.addEventListener('click', () => saveScore(button.dataset.scoreUser, Number(button.dataset.score))));

  clearInterval(timerHandle);
  if (active) {
    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil(((room.phaseEndsAt || Date.now()) - Date.now()) / 1000));
      const countdown = $('#countdown');
      if (countdown) countdown.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      if (seconds === 0 && isHost) autoAdvance(room);
    };
    updateCountdown();
    timerHandle = setInterval(updateCountdown, 1000);
  }
}

async function advancePhase(room) {
  if (advancing) return;
  advancing = true;
  try {
    if (room.local) {
      const transition = {
        waiting: ['research', room.researchMins],
        research: ['speaking', room.speakMins],
        speaking: ['done', null],
      }[room.phase];
      if (!transition) return;
      room.phase = transition[0];
      room.phaseEndsAt = transition[1] ? Date.now() + transition[1] * 60_000 : null;
      saveLocalRoom(room);
      renderRoom(room);
    } else {
      await apiRequest(`/api/rooms/${currentRoomCode}/phase`, { expectedPhase: room.phase });
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Tahap sesi tidak dapat diperbarui.');
  } finally {
    advancing = false;
  }
}

async function autoAdvance(room) { if (!advancing) await advancePhase(room); }

async function saveScore(participantUid, score) {
  try {
    if (currentRoomCode && !hasFirebaseConfig) {
      const room = getLocalRoom(currentRoomCode);
      room.participants[participantUid].scores[authUser.uid] = score;
      saveLocalRoom(room);
      renderRoom(room);
    } else {
      await apiRequest(`/api/rooms/${currentRoomCode}/score`, { participantUid, score });
    }
    showToast('Penilaian tersimpan.');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Penilaian tidak dapat disimpan.');
  }
}

renderTopicGrid();
renderTopicOptions();
['#heroStart', '#navStart', '#bottomStart'].forEach(selector => $(selector).addEventListener('click', () => openSession()));
$('#shuffleBtn').addEventListener('click', () => {
  const tiles = $$('.topic-tile');
  if (!tiles.length) return;
  const tile = tiles[Math.floor(Math.random() * tiles.length)];
  tile.scrollIntoView({ behavior: 'smooth', block: 'center' });
  tile.focus({ preventScroll: true });
  showToast(`Topik pilihan: ${tile.dataset.topic}`);
});
$('#customBtn').addEventListener('click', () => customDialog.showModal());
$('#saveTopic').addEventListener('click', event => {
  event.preventDefault();
  const text = $('#customTopic').value.trim();
  if (text.length < 5) { showToast('Tulis topik setidaknya 5 karakter.'); return; }
  const saved = customTopics();
  if (!saved.some(topic => topic.text.toLowerCase() === text.toLowerCase())) saved.push({ emoji: '💬', text });
  localStorage.setItem('temu-custom-topics', JSON.stringify(saved));
  $('#customTopic').value = '';
  customDialog.close();
  renderTopicGrid();
  renderTopicOptions();
  showToast('Topikmu tersimpan di perangkat ini.');
});
$('#createSession').addEventListener('click', createSession);
$('#joinSession').addEventListener('click', joinSession);
$('#roomCode').addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
activeDialog.addEventListener('close', () => {
  if (roomUnsubscribe) { roomUnsubscribe(); roomUnsubscribe = null; }
  clearInterval(timerHandle);
  currentRoomCode = null;
});
