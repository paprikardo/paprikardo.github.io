import * as db from './db.js';
import { makeZip, readZip, entryData } from './zip.js';
import { canRecordInApp, mountRecorder, mountAudioRecorder, getPref, setPref } from './recorder.js';
import { HOP, analyzeBlob, compare, range, noteName, isNatural } from './pitch.js';

const app = document.getElementById('app');
const sheet = document.getElementById('sheet');
const toastEl = document.getElementById('toast');
const loc = navigator.language || 'en-GB';
const PART_BYTES = 1.5e9;
const BACKUP_NUDGE_DAYS = 7;

const state = { exercises: [], attempts: [], goal: 4, lastBackupAt: null, sort: 'newest' };
let pendingBackup = null;

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const byDate = (a, b) => a.createdAt - b.createdAt;
const attemptsOf = (id) => state.attempts.filter((a) => a.exerciseId === id);
const exerciseOf = (id) => state.exercises.find((e) => e.id === id);
const bestOf = (list) => list.reduce((b, a) => (!b || a.score > b.score || (a.score === b.score && a.createdAt > b.createdAt) ? a : b), null);
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const fmtDay = (t) => new Date(t).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (t) => new Date(t).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fmtBytes = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function fmtRelative(t) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return new Date(t).toLocaleDateString(loc, { weekday: 'long' });
  return fmtDay(t);
}

function extFor(a) {
  const m = (a.mime || '').toLowerCase();
  if (m.startsWith('audio/')) {
    if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
    if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
    if (m.includes('wav')) return 'wav';
    if (m.includes('webm')) return 'webm';
    if (m.includes('ogg')) return 'ogg';
  }
  if (m.includes('quicktime')) return 'mov';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('webm')) return 'webm';
  const fromName = /\.([a-z0-9]{2,4})$/i.exec(a.fileName || '');
  return fromName ? fromName[1].toLowerCase() : 'mov';
}
const slug = (s) => (s || 'exercise').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'exercise';
function stamp(t) {
  const d = new Date(t), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
const videoFileName = (a) => `${stamp(a.createdAt)}_score${a.score}.${extFor(a)}`;
const refPath = (e) => `references/${slug(e.name)}_${e.id.slice(0, 8)}.${extFor({ mime: e.ref.mime, fileName: e.ref.name }).replace('mov', 'm4a')}`;

let pageURLs = [];
let sheetURLs = [];
const pageURL = (b) => { const u = URL.createObjectURL(b); pageURLs.push(u); return u; };
const sheetURL = (b) => { const u = URL.createObjectURL(b); sheetURLs.push(u); return u; };

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

const icons = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  backup: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z"/><path d="M12 15V9m-3 3l3-3 3 3"/></svg>',
  rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" class="fill"/></svg>',
};

function downloadFile(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// Must be called directly inside a tap handler: iOS only opens the share sheet then.
async function shareFiles(files, title) {
  if (navigator.canShare && navigator.canShare({ files })) {
    await navigator.share({ files, title });
  } else {
    files.forEach(downloadFile);
  }
}

function requestPersist() {
  navigator.storage?.persist?.().catch(() => {});
}

/* ---------- sheet (bottom dialog) ---------- */

let sheetCleanup = null;
function cleanupSheet() {
  sheetCleanup?.();
  sheetCleanup = null;
  sheet.innerHTML = '';
  sheetURLs.forEach(URL.revokeObjectURL);
  sheetURLs = [];
}
function openSheet(html) {
  // Callers create blob URLs while building `html`, so don't revoke URLs here.
  sheetCleanup?.();
  sheetCleanup = null;
  sheet.innerHTML = html;
  if (!sheet.open) sheet.showModal();
  return sheet;
}
function closeSheet() {
  if (sheet.open) sheet.close();
  cleanupSheet();
}
sheet.addEventListener('close', () => { if (!sheet.open) cleanupSheet(); });
sheet.addEventListener('click', (e) => {
  if (e.target === sheet || e.target.closest('[data-close]')) closeSheet();
});

function scorePicker(current) {
  let h = '<fieldset class="score-pick"><legend>Score</legend><div class="score-grid">';
  for (let n = 1; n <= 10; n++) {
    h += `<label class="score-opt"><input type="radio" name="score" value="${n}" class="vh" ${n === current ? 'checked' : ''}><span>${n}</span></label>`;
  }
  return h + '</div></fieldset>';
}

/* ---------- video helpers ---------- */

function waitFor(el, ev, ms) {
  return new Promise((res, rej) => {
    const h = () => { clearTimeout(t); res(); };
    const t = setTimeout(() => { el.removeEventListener(ev, h); rej(new Error('timeout')); }, ms);
    el.addEventListener(ev, h, { once: true });
  });
}

function drawThumb(video) {
  return new Promise((res, rej) => {
    const h = 200;
    const w = Math.round((h * video.videoWidth) / video.videoHeight) || 150;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(video, 0, 0, w, h);
    c.toBlob((b) => (b ? res(b) : rej(new Error('no thumb'))), 'image/jpeg', 0.72);
  });
}

async function captureThumb(video) {
  if (video.readyState < 2) await waitFor(video, 'loadeddata', 2500);
  if (video.paused && video.currentTime < 0.05 && video.duration > 0.6) {
    video.currentTime = Math.min(0.5, video.duration / 2);
    await waitFor(video, 'seeked', 2000);
  }
  return drawThumb(video);
}

/* ---------- views ---------- */

function weekStrip() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const practiced = new Set(state.attempts.map((a) => dayKey(a.createdAt)));
  const todayKey = dayKey(Date.now());
  let count = 0;
  let days = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = dayKey(d);
    const done = practiced.has(k);
    if (done) count++;
    const name = d.toLocaleDateString(loc, { weekday: 'long' });
    days += `<li class="${done ? 'done' : ''} ${k === todayKey ? 'today' : ''}" aria-label="${name}${done ? ', practised' : ''}"><span class="dot"></span><span class="wd" aria-hidden="true">${d.toLocaleDateString(loc, { weekday: 'narrow' })}</span></li>`;
  }
  const line = count >= state.goal
    ? `Weekly goal reached: ${plural(count, 'day')} of practice.`
    : `${count} of ${state.goal} practice days this week.`;
  return `<section class="week"><ol class="week-days">${days}</ol><p class="week-line">${line}</p></section>`;
}

function unbackedCounts() {
  return {
    recs: state.attempts.filter((a) => !a.backedUpAt).length,
    refs: state.exercises.filter((e) => e.ref && !e.ref.backedUpAt).length,
  };
}

function unbackedText({ recs, refs }) {
  const parts = [];
  if (recs) parts.push(plural(recs, 'recording'));
  if (refs) parts.push(plural(refs, 'reference track'));
  return `${parts.join(' and ')} ${recs + refs === 1 ? "isn't" : "aren't"} backed up yet.`;
}

function backupNudge() {
  const c = unbackedCounts();
  if (!c.recs && !c.refs) return '';
  const stale = !state.lastBackupAt || Date.now() - state.lastBackupAt > BACKUP_NUDGE_DAYS * 864e5;
  if (!stale && c.recs + c.refs < 5) return '';
  return `<a class="nudge" href="#/settings">${icons.backup}<span>${unbackedText(c)} <u>Back up now</u></span></a>`;
}

function viewHome() {
  const last = (id) => Math.max(exerciseOf(id)?.createdAt || 0, ...attemptsOf(id).map((a) => a.createdAt));
  const list = [...state.exercises].sort((a, b) => last(b.id) - last(a.id));
  const rows = list.map((ex) => {
    const at = attemptsOf(ex.id);
    const best = bestOf(at);
    const latest = at.length ? at.reduce((m, a) => (a.createdAt > m.createdAt ? a : m)) : null;
    const meta = at.length
      ? `${plural(at.length, 'attempt')}, best ${best.score}, last ${fmtRelative(latest.createdAt)}`
      : 'No attempts yet';
    return `<li><a class="ex-row" href="#/ex/${ex.id}"><span class="ex-name">${esc(ex.name)}</span><span class="ex-meta">${meta}</span></a></li>`;
  }).join('');

  app.innerHTML = `
    <header class="top">
      <h1 class="title">Practice</h1>
      <a class="icon-btn" href="#/settings" aria-label="Backup and storage">${icons.backup}</a>
    </header>
    ${weekStrip()}
    ${backupNudge()}
    ${list.length
      ? `<ul class="ex-list">${rows}</ul>`
      : `<div class="empty"><p>An exercise is one thing you want to get better at, like the chorus of a song or a tricky phrase. Add one, then record short attempts and score them.</p></div>`}
    <div class="bar"><button class="btn primary" data-act="new-ex">New exercise</button></div>`;
}

function staffChart(list, best) {
  const pts = [...list].sort(byDate);
  const L = 12, step = 30, padL = 30, padR = 16, line1 = 64, H = 84;
  const avail = Math.min(app.clientWidth || 360, 640) - 40;
  const W = Math.max(padL + pts.length * step + padR, avail);
  let s = '';
  for (let i = 0; i < 5; i++) s += `<line class="staff" x1="${padL - 8}" x2="${W}" y1="${line1 - i * L}" y2="${line1 - i * L}"/>`;
  s += `<text class="axis" x="${padL - 14}" y="${line1 - 4 * L + 4}" text-anchor="end">10</text>`;
  s += `<text class="axis" x="${padL - 14}" y="${line1 + L / 2 + 4}" text-anchor="end">1</text>`;
  pts.forEach((a, i) => {
    const x = padL + step * (i + 0.5);
    const y = line1 - ((a.score - 2) * L) / 2;
    const up = a.score < 6;
    const stem = up ? `<line class="stem" x1="${x + 5.6}" x2="${x + 5.6}" y1="${y - 1}" y2="${y - 36}"/>` : `<line class="stem" x1="${x - 5.6}" x2="${x - 5.6}" y1="${y + 1}" y2="${y + 36}"/>`;
    s += `<a href="#/a/${a.id}" class="note${a.id === best.id ? ' best' : ''}"><title>Score ${a.score}, ${esc(fmtDay(a.createdAt))}</title>
      <rect class="hit" x="${x - step / 2}" y="0" width="${step}" height="${H}"/>
      ${stem}<ellipse cx="${x}" cy="${y}" rx="6.6" ry="4.7" transform="rotate(-22 ${x} ${y})"/></a>`;
  });
  const summary = `Scores from first to latest attempt: ${pts.map((a) => a.score).join(', ')}.`;
  return `<figure class="chart">
    <div class="staff-scroll"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${summary}">${s}</svg></div>
    <figcaption>Each note is one attempt; higher notes are higher scores. The coloured note is your best.</figcaption>
  </figure>`;
}

function attemptRow(a, best, hasVideo) {
  return `<li><a class="att-row" href="#/a/${a.id}">
    <span class="thumb" data-thumb="${a.id}"></span>
    <span class="att-main">
      <span class="att-date">${esc(fmtDay(a.createdAt))} <span class="muted">${esc(fmtTime(a.createdAt))}</span></span>
      ${a.note ? `<span class="att-note">${esc(a.note)}</span>` : ''}
      ${a.id === best.id ? '<span class="best-tag">Best so far</span>' : ''}
      ${hasVideo ? '' : '<span class="att-note warn">Video not on this phone</span>'}
    </span>
    <span class="att-score"><span class="vh">Score </span>${a.score}</span>
  </a></li>`;
}

async function viewExercise(id) {
  const ex = exerciseOf(id);
  if (!ex) { location.hash = '#/'; return; }
  const list = attemptsOf(id);
  const best = bestOf(list);
  const sorted = [...list].sort(state.sort === 'best' ? (a, b) => b.score - a.score || b.createdAt - a.createdAt : (a, b) => b.createdAt - a.createdAt);
  const videoFlags = await Promise.all(sorted.map((a) => db.has('videos', a.id)));
  const refBlob = ex.ref ? await db.get('refs', id) : null;
  if (refBlob && !ex.ref.pitch) analyzeRef(ex);

  app.innerHTML = `
    <header class="top sub">
      <a class="back" href="#/">${icons.back}<span>Practice</span></a>
      <button class="text-btn" data-act="edit-ex">Edit</button>
    </header>
    <h1 class="title ex-title">${esc(ex.name)}</h1>
    ${ex.notes ? `<p class="ex-notes">${esc(ex.notes)}</p>` : ''}
    ${refSection(ex, refBlob)}
    ${list.length ? staffChart(list, best) : ''}
    ${list.length >= 2 ? `<a class="link-row" href="#/ex/${id}/compare">Compare first, best and latest</a>` : ''}
    ${list.length
      ? `<div class="list-head"><h2>${plural(list.length, 'attempt')}</h2>
          <div class="seg" role="group" aria-label="Sort attempts">
            <button data-act="sort" data-sort="newest" aria-pressed="${state.sort === 'newest'}">Newest</button>
            <button data-act="sort" data-sort="best" aria-pressed="${state.sort === 'best'}">Best</button>
          </div></div>
         <ul class="attempts">${sorted.map((a, i) => attemptRow(a, best, videoFlags[i])).join('')}</ul>`
      : `<div class="empty"><p>Record yourself singing this, then score the attempt from 1 to 10. Short clips of 20 to 60 seconds are easiest to compare later.</p></div>`}
    <div class="bar two">
      ${canRecordInApp()
        ? `<a class="btn primary" href="#/ex/${id}/record">${icons.rec}Record</a>`
        : `<label class="btn primary">${icons.rec}Record<input type="file" accept="video/*" capture="user" class="vh" data-pick></label>`}
      <button class="btn" data-act="add-video">Add video</button>
    </div>`;

  const scroller = app.querySelector('.staff-scroll');
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;

  for (const a of sorted) {
    db.get('thumbs', a.id).then((b) => {
      const slot = app.querySelector(`[data-thumb="${a.id}"]`);
      if (b && slot) { const img = new Image(); img.alt = ''; img.src = pageURL(b); slot.append(img); }
    });
  }
}

function attemptSheet(file, exId, opts = {}) {
  const isVideo = (file.type || '').startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(file.name || '');
  if (!opts.recorded && !isVideo) { toast("That file isn't a video."); return; }
  const s = openSheet(`
    <form class="sheet-body" id="att-form">
      <h2>How did it go?</h2>
      <video class="preview" src="${sheetURL(file)}" controls playsinline preload="auto"></video>
      ${scorePicker()}
      <label class="field">Note<textarea name="note" rows="2" placeholder="What changed? For example: the jump into the chorus felt easier."></textarea></label>
      <div class="actions"><button type="button" class="btn" data-close>Discard</button><button class="btn primary" type="submit" disabled>Save attempt</button></div>
    </form>`);
  const form = s.querySelector('form');
  const submit = form.querySelector('[type=submit]');
  form.addEventListener('change', () => { submit.disabled = !form.score.value; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Saving…';
    const video = form.querySelector('video');
    const thumb = await captureThumb(video).catch(() => null);
    const mime = file.type || (/\.mp4$/i.test(file.name || '') ? 'video/mp4' : 'video/quicktime');
    const attempt = {
      id: uid(), exerciseId: exId, createdAt: Date.now(),
      score: Number(form.score.value), note: form.note.value.trim(),
      duration: opts.duration ?? (Number.isFinite(video.duration) ? video.duration : null),
      mime, size: file.size, fileName: file.name || '', backedUpAt: null,
      pitch: opts.meta?.pitch ?? null,
      withRef: !!opts.meta?.withRef, refOffset: opts.meta?.refOffset ?? 0, refLoop: !!opts.meta?.refLoop,
      recInfo: opts.meta?.recInfo ?? null,
    };
    let stored;
    try {
      // Copy the bytes so the stored video doesn't depend on the picker's temporary file.
      stored = new Blob([await file.arrayBuffer()], { type: mime });
      await db.saveAttempt(attempt, stored, thumb);
    } catch (err) {
      submit.disabled = false;
      submit.textContent = 'Save attempt';
      toast(err?.name === 'QuotaExceededError' ? 'Not enough storage. Back up and delete old recordings, then try again.' : `Couldn't save: ${err?.message || err}`);
      return;
    }
    state.attempts.push(attempt);
    if (state.attempts.length === 1) requestPersist();
    if (!attempt.pitch) analyzeAttempt(attempt, stored);
    closeSheet();
    if (opts.afterSave) { opts.afterSave(); return; }
    await viewExercise(exId);
    toast('Attempt saved');
  });
}

function exerciseSheet(ex) {
  const s = openSheet(`
    <form class="sheet-body" id="ex-form">
      <h2>${ex ? 'Edit exercise' : 'New exercise'}</h2>
      <label class="field">Name<input name="name" required maxlength="120" autocomplete="off" placeholder="Just the Two of Us, chorus" value="${esc(ex?.name)}"></label>
      <label class="field">Notes<textarea name="notes" rows="3" placeholder="What to focus on, the key, your goal">${esc(ex?.notes)}</textarea></label>
      <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">${ex ? 'Save changes' : 'Add exercise'}</button></div>
      ${ex ? '<button type="button" class="btn danger wide" data-act="del-ex">Delete exercise</button>' : ''}
    </form>`);
  const form = s.querySelector('form');
  if (!ex) form.name.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    if (!name) return;
    const rec = ex ? { ...ex, name, notes: form.notes.value.trim(), updatedAt: Date.now() } : { id: uid(), name, notes: form.notes.value.trim(), createdAt: Date.now(), updatedAt: Date.now() };
    await db.put('exercises', rec);
    if (ex) Object.assign(ex, rec); else state.exercises.push(rec);
    closeSheet();
    location.hash = `#/ex/${rec.id}`;
    if (ex) await viewExercise(rec.id);
    toast(ex ? 'Changes saved' : 'Exercise added');
  });
  s.querySelector('[data-act=del-ex]')?.addEventListener('click', async () => {
    const ids = attemptsOf(ex.id).map((a) => a.id);
    const msg = ids.length ? `Delete “${ex.name}” and its ${plural(ids.length, 'attempt')}? The videos are deleted too, unless you have a backup.` : `Delete “${ex.name}”?`;
    if (!confirm(msg)) return;
    await db.deleteExercise(ex.id, ids);
    state.exercises = state.exercises.filter((e) => e.id !== ex.id);
    state.attempts = state.attempts.filter((a) => a.exerciseId !== ex.id);
    closeSheet();
    location.hash = '#/';
    toast('Exercise deleted');
  });
}

const analyzing = new Map();

// Work out an attempt's pitch from its video (for imported videos and older attempts).
function analyzeAttempt(a, blob, onProgress) {
  if (analyzing.has(a.id)) return analyzing.get(a.id);
  const job = (async () => {
    try {
      const b = blob || (await db.get('videos', a.id));
      if (!b) return;
      a.pitch = await analyzeBlob(b, onProgress);
    } catch {
      a.pitch = { hop: HOP, midi: [], failed: true };
    }
    await db.put('attempts', a);
  })().finally(() => analyzing.delete(a.id));
  analyzing.set(a.id, job);
  return job;
}

function analyzeRef(ex) {
  const key = `ref:${ex.id}`;
  if (analyzing.has(key) || !ex.ref) return analyzing.get(key);
  const job = (async () => {
    const name = ex.ref.name;
    let pitch;
    try {
      const b = await db.get('refs', ex.id);
      if (!b) return;
      pitch = await analyzeBlob(b);
    } catch {
      pitch = { hop: HOP, midi: [], failed: true };
    }
    if (!ex.ref || ex.ref.name !== name) return; // replaced meanwhile
    ex.ref.pitch = pitch;
    await db.put('exercises', ex);
  })().finally(() => analyzing.delete(key));
  analyzing.set(key, job);
  return job;
}

function refSection(ex, refBlob) {
  if (refBlob) {
    return `<section class="ref">
      <div class="ref-head"><h2>Reference</h2><button class="text-btn" data-act="ref-sheet">Change</button></div>
      <audio controls preload="metadata" src="${pageURL(refBlob)}"></audio>
    </section>`;
  }
  if (ex.ref) return `<section class="ref"><p class="missing small">The reference track isn't on this phone. Restore the backup that contains it, or <button class="text-btn inline" data-act="ref-sheet">add a new one</button>.</p></section>`;
  return `<section class="ref"><button class="link-row as-btn" data-act="ref-sheet">Add a reference track</button></section>`;
}

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|aif|aiff|caf|flac|ogg|opus|mp4|mov|m4v|webm)$/i;

async function saveRef(exId, blob, meta) {
  const ex = exerciseOf(exId);
  const mime = blob.type || (/\.mp3$/i.test(meta.name) ? 'audio/mpeg' : 'audio/mp4');
  const data = new Blob([await blob.arrayBuffer()], { type: mime });
  const rec = { ...ex, ref: { name: meta.name, mime, size: data.size, addedAt: Date.now(), backedUpAt: null }, updatedAt: Date.now() };
  await db.saveRef(rec, data);
  Object.assign(ex, rec);
  requestPersist();
  analyzeRef(ex);
}

function refSheet(exId) {
  const ex = exerciseOf(exId);
  const s = openSheet(`
    <div class="sheet-body">
      <h2>Reference track</h2>
      <p class="muted">Something to sing along to: a backing track, the original song, or your teacher singing the phrase. You can play it while you record.</p>
      ${ex.ref ? `<p>Current: <strong>${esc(ex.ref.name)}</strong></p>` : ''}
      <label class="btn">Choose a file<input type="file" accept="audio/*,video/*" class="vh" data-ref-file></label>
      <p class="muted small">Audio files from the Files app, or a video from Photos (only its sound is used). For a Voice Memo, first tap Share → Save to Files in Voice Memos.</p>
      <h3>Or record one now</h3>
      <div data-mini-root></div>
      <div class="mini-preview"></div>
      <div class="actions">
        ${ex.ref ? '<button type="button" class="btn danger" data-act-sheet="ref-remove">Remove</button>' : '<button type="button" class="btn" data-close>Cancel</button>'}
        <button type="button" class="btn primary" data-act-sheet="ref-save" disabled>Save reference</button>
      </div>
      ${ex.ref ? '<button type="button" class="btn wide" data-close>Close</button>' : ''}
    </div>`);
  let pending = null;
  const save = s.querySelector('[data-act-sheet=ref-save]');
  const preview = s.querySelector('.mini-preview');
  const offer = (blob, name) => {
    pending = { blob, name };
    preview.innerHTML = `<p class="small">${esc(name)}</p><audio controls preload="metadata" src="${sheetURL(blob)}"></audio>`;
    save.disabled = false;
  };
  if (canRecordInApp()) {
    sheetCleanup = mountAudioRecorder(s.querySelector('[data-mini-root]'), {
      onRecorded: (blob) => offer(blob, `Recorded ${new Date().toLocaleDateString(loc, { day: 'numeric', month: 'short' })}`),
    });
  } else {
    s.querySelector('[data-mini-root]').innerHTML = '<p class="muted small">Recording isn’t available in this browser.</p>';
  }
  s.querySelector('[data-ref-file]').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = /^(audio|video)\//.test(f.type) || AUDIO_EXT.test(f.name);
    if (!ok) { toast("That file isn't audio or video."); return; }
    offer(f, f.name || 'Reference track');
  });
  save.addEventListener('click', async () => {
    if (!pending) return;
    save.disabled = true;
    save.textContent = 'Saving…';
    try {
      await saveRef(exId, pending.blob, { name: pending.name });
    } catch (err) {
      save.disabled = false;
      save.textContent = 'Save reference';
      toast(err?.name === 'QuotaExceededError' ? 'Not enough storage for this file.' : `Couldn't save: ${err?.message || err}`);
      return;
    }
    closeSheet();
    await viewExercise(exId);
    toast('Reference saved');
  });
  s.querySelector('[data-act-sheet=ref-remove]')?.addEventListener('click', async () => {
    if (!confirm('Remove the reference track from this exercise?')) return;
    const rec = { ...ex, ref: null, updatedAt: Date.now() };
    await db.saveRef(rec, null);
    Object.assign(ex, rec);
    closeSheet();
    await viewExercise(exId);
    toast('Reference removed');
  });
}

function addVideoSheet(exId) {
  openSheet(`
    <div class="sheet-body">
      <h2>Add video</h2>
      <label class="btn">Record with the iOS Camera<input type="file" accept="video/*" capture="user" class="vh" data-pick data-ex="${exId}"></label>
      <label class="btn">Choose from library<input type="file" accept="video/*" class="vh" data-pick data-ex="${exId}"></label>
      <p class="muted small">The iOS Camera can’t play your reference track while it records. Use Record for that.</p>
      <button type="button" class="btn wide" data-close>Cancel</button>
    </div>`);
}

async function viewRecord(id) {
  const ex = exerciseOf(id);
  if (!ex) { location.hash = '#/'; return; }
  if (!canRecordInApp()) { location.hash = `#/ex/${id}`; return; }
  const refBlob = ex.ref ? await db.get('refs', id) : null;
  if (refBlob && !ex.ref.pitch) await Promise.race([analyzeRef(ex), new Promise((r) => setTimeout(r, 4000))]);
  viewCleanup = mountRecorder(app, {
    title: ex.name,
    backHref: `#/ex/${id}`,
    refURL: refBlob ? pageURL(refBlob) : null,
    refName: ex.ref?.name,
    refPitch: ex.ref?.pitch && !ex.ref.pitch.failed ? ex.ref.pitch : null,
    onRecorded: (blob, seconds, meta) => attemptSheet(blob, id, {
      recorded: true,
      duration: seconds,
      meta,
      afterSave: () => toast('Attempt saved. Ready for the next take.'),
    }),
  });
}

function pitchSection(a, ex, hasVideo) {
  const body = pitchBody(a, ex, hasVideo);
  if (!body) return '';
  const shown = getPref('pitchGraph', true);
  return `<section class="pitch${shown ? '' : ' collapsed'}"${body.pps ? ` data-pps="${body.pps}"` : ''}>
    <div class="pitch-head">
      <h2>Pitch</h2>
      <button type="button" class="text-btn" data-act="toggle-pitch" aria-expanded="${shown}">${shown ? 'Hide' : 'Show'}</button>
    </div>
    <div class="pitch-body">${body.html}</div>
  </section>`;
}

function pitchBody(a, ex, hasVideo) {
  const wrap = (html, pps) => ({ html, pps });
  if (!a.pitch) {
    return hasVideo ? wrap('<button class="btn" data-act="analyze">Analyse pitch</button><p class="progress" data-analyze-msg></p>') : null;
  }
  if (a.pitch.failed) return wrap('<p class="muted small">This browser couldn’t read the sound of this video.</p>');
  const you = a.pitch;
  const r = range(you);
  if (!r) return wrap('<p class="muted small">No clear sung pitch was detected in this take.</p>');

  // Reference sampled on the attempt's time grid, moved into your octave.
  const refTrack = a.withRef && ex.ref?.pitch && !ex.ref.pitch.failed ? ex.ref.pitch : null;
  let refVals = null, octave = 0;
  if (refTrack) {
    const dur = refTrack.midi.length * refTrack.hop;
    refVals = you.midi.map((_, i) => {
      let t = i * you.hop - (a.refOffset || 0);
      if (t < 0) return null;
      if (a.refLoop) t %= dur; else if (t >= dur) return null;
      return refTrack.midi[Math.round(t / refTrack.hop)] ?? null;
    });
    const diffs = you.midi.map((m, i) => (m != null && refVals[i] != null ? m - refVals[i] : null)).filter((d) => d != null).sort((p, q) => p - q);
    if (diffs.length) octave = Math.round(diffs[Math.floor(diffs.length / 2)] / 12);
    refVals = refVals.map((m) => (m == null ? null : m + 12 * octave));
    if (!refVals.some((m) => m != null)) refVals = null;
  }

  let lo = r.lo, hi = r.hi;
  if (refVals) {
    const rv = refVals.filter((m) => m != null && m > r.lo - 7 && m < r.hi + 7);
    if (rv.length) { lo = Math.min(lo, Math.min(...rv)); hi = Math.max(hi, Math.max(...rv)); }
  }
  lo = Math.floor(lo) - 1; hi = Math.ceil(hi) + 1;
  const span = hi - lo;
  const rowH = Math.max(6, Math.min(14, 210 / span));
  const H = Math.round(span * rowH) + 8;
  const pps = 40;
  const W = Math.max(Math.ceil(you.midi.length * you.hop * pps), Math.min(app.clientWidth || 360, 640) - 74);
  const y = (m) => (hi - m) * rowH + 4;
  const clampY = (m) => (m < lo - 0.5 || m > hi + 0.5 ? null : y(m));
  const path = (vals) => {
    let d = '', pen = false;
    vals.forEach((m, i) => {
      const yy = m == null ? null : clampY(m);
      if (yy == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${(i * you.hop * pps).toFixed(1)} ${yy.toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  let grid = '', labels = '';
  for (let n = lo; n <= hi; n++) {
    const nat = isNatural(n);
    grid += `<line class="${nat ? 'g-nat' : 'g-sharp'}${n % 12 === 0 ? ' g-c' : ''}" x1="0" x2="${W}" y1="${y(n)}" y2="${y(n)}"/>`;
    if (n % 12 === 0 || (nat && rowH >= 10)) labels += `<text x="30" y="${y(n) + 3.5}" text-anchor="end"${n % 12 === 0 ? ' class="c"' : ''}>${noteName(n)}</text>`;
  }

  const cmp = refVals ? compare(you, refTrack, { offset: a.refOffset || 0, loop: a.refLoop }) : null;
  const octText = octave ? ` (shown ${Math.abs(octave) === 1 ? 'an octave' : `${Math.abs(octave)} octaves`} ${octave < 0 ? 'lower' : 'higher'})` : '';
  const legend = refVals ? `<p class="legend"><span class="key you"></span>You <span class="key ref"></span>Reference${octText}</p>` : '';
  const stats = [`Range ${noteName(r.lo)} to ${noteName(r.hi)}.`];
  if (cmp) stats.push(`Within a quarter tone of the reference ${Math.round(cmp.share * 100)}% of the time you were both sounding.`);

  return wrap(`
    ${legend}
    <div class="pitch-wrap">
      <svg class="pitch-axis" width="34" height="${H}" aria-hidden="true">${labels}</svg>
      <div class="pitch-scroll">
        <svg class="pitch-plot" width="${W}" height="${H}" role="img" aria-label="Pitch over time. ${esc(stats.join(' '))}">
          ${grid}
          ${refVals ? `<path class="p-ref" d="${path(refVals)}"/>` : ''}
          <path class="p-you" d="${path(you.midi)}"/>
          <line class="playhead" x1="0" x2="0" y1="0" y2="${H}"/>
        </svg>
      </div>
    </div>
    <p class="pitch-stats">${stats.join(' ')} Tap the graph to jump there in the video.</p>`, pps);
}

function describeRecInfo(r) {
  const codec = /webm/.test(r.mime || '') ? 'Opus' : 'AAC';
  const parts = [`Audio: ${codec}`];
  if (r.sampleRate) parts.push(`${r.sampleRate / 1000} kHz`);
  if (r.channels) parts.push(r.channels === 1 ? 'mono' : `${r.channels} channels`);
  if (r.bitrate) parts.push(`about ${Math.round(r.bitrate / 1000)} kbps`);
  const processing = [r.echoCancellation, r.noiseSuppression, r.autoGainControl].some((v) => v === true) ? 'voice processing on' : 'voice processing off';
  parts.push(processing);
  if (r.mic) parts.push(`mic: ${r.mic}`);
  return `${parts.join(', ')}.`;
}

function bindPitch(video) {
  const sec = app.querySelector('.pitch[data-pps]');
  if (!video || !sec) return;
  const pps = Number(sec.dataset.pps);
  const scroll = sec.querySelector('.pitch-scroll'), plot = sec.querySelector('.pitch-plot'), head = sec.querySelector('.playhead');
  let raf = 0;
  const update = (follow = true) => {
    const x = video.currentTime * pps;
    head.setAttribute('x1', x); head.setAttribute('x2', x);
    const vis = scroll.clientWidth;
    if (follow && (x < scroll.scrollLeft + 10 || x > scroll.scrollLeft + vis - 30)) scroll.scrollLeft = x - vis * 0.25;
  };
  const tick = () => { update(); if (!video.paused) raf = requestAnimationFrame(tick); };
  video.addEventListener('play', () => { cancelAnimationFrame(raf); tick(); });
  video.addEventListener('seeked', () => update());
  plot.addEventListener('click', (e) => {
    const t = (e.clientX - plot.getBoundingClientRect().left) / pps;
    video.currentTime = Math.max(0, Number.isFinite(video.duration) ? Math.min(t, video.duration) : t);
    update(false);
  });
}

async function viewAttempt(id) {
  const a = state.attempts.find((x) => x.id === id);
  const ex = a && exerciseOf(a.exerciseId);
  if (!a || !ex) { location.hash = '#/'; return; }
  const blob = await db.get('videos', id);
  const hasThumb = await db.has('thumbs', id);

  app.innerHTML = `
    <header class="top sub"><a class="back" href="#/ex/${ex.id}">${icons.back}<span>${esc(ex.name)}</span></a></header>
    ${blob
      ? `<video class="player" src="${pageURL(blob)}" controls playsinline preload="auto"></video>`
      : '<p class="missing">This video isn’t on this phone. Restore the backup that contains it under Backup and storage.</p>'}
    <p class="att-when">${esc(fmtDay(a.createdAt))}, ${esc(fmtTime(a.createdAt))}${a.duration ? `, ${fmtDur(a.duration)}` : ''}</p>
    ${a.recInfo ? `<p class="rec-info">${esc(describeRecInfo(a.recInfo))}</p>` : ''}
    ${pitchSection(a, ex, !!blob)}
    <form id="edit-att" class="edit-att">
      ${scorePicker(a.score)}
      <label class="field">Note<textarea name="note" rows="3" placeholder="What changed?">${esc(a.note)}</textarea></label>
      <button class="btn primary wide" type="submit" disabled>Save changes</button>
    </form>
    <div class="more-actions">
      ${blob ? '<button class="btn" data-act="share-video">Save video to Files</button>' : ''}
      <button class="btn danger" data-act="del-att">Delete attempt</button>
    </div>`;

  const form = app.querySelector('#edit-att');
  const submit = form.querySelector('[type=submit]');
  const dirty = () => { submit.disabled = Number(form.score.value) === a.score && form.note.value.trim() === a.note; };
  form.addEventListener('input', dirty);
  form.addEventListener('change', dirty);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const scoreChanged = Number(form.score.value) !== a.score;
    a.score = Number(form.score.value);
    a.note = form.note.value.trim();
    if (scoreChanged) a.backedUpAt = null; // the backup holds the old score
    await db.put('attempts', a);
    submit.disabled = true;
    toast('Changes saved');
  });

  const video = app.querySelector('video.player');
  bindPitch(video);
  if (video && !hasThumb) {
    video.addEventListener('timeupdate', function once() {
      if (video.currentTime < 0.3) return;
      video.removeEventListener('timeupdate', once);
      drawThumb(video).then((t) => db.put('thumbs', t, id)).catch(() => {});
    });
  }
  app._blob = blob;
}

async function viewCompare(id) {
  const ex = exerciseOf(id);
  if (!ex) { location.hash = '#/'; return; }
  const list = attemptsOf(id).sort(byDate);
  if (list.length < 2) { location.hash = `#/ex/${id}`; return; }
  const labels = new Map();
  const add = (label, a) => labels.set(a.id, [...(labels.get(a.id) || []), label]);
  add('First', list[0]);
  add('Best', bestOf(list));
  add('Latest', list.at(-1));
  const chosen = list.filter((a) => labels.has(a.id));
  const blobs = await Promise.all(chosen.map((a) => db.get('videos', a.id)));
  const join = (arr) => (arr.length > 1 ? `${arr.slice(0, -1).join(', ')} and ${arr.at(-1).toLowerCase()}` : arr[0]);

  app.innerHTML = `
    <header class="top sub"><a class="back" href="#/ex/${id}">${icons.back}<span>${esc(ex.name)}</span></a></header>
    <h1 class="title">Compare</h1>
    ${chosen.map((a, i) => `
      <section class="cmp">
        <h2>${join(labels.get(a.id))}</h2>
        <p class="cmp-meta">Score ${a.score}, ${esc(fmtDay(a.createdAt))}</p>
        ${blobs[i] ? `<video src="${pageURL(blobs[i])}" controls playsinline preload="metadata"></video>` : '<p class="missing">Video not on this phone.</p>'}
        ${a.note ? `<p class="cmp-note">${esc(a.note)}</p>` : ''}
      </section>`).join('')}`;
}

async function viewSettings() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const c = unbackedCounts();
  const unbacked = c.recs + c.refs;
  const anything = state.attempts.length || state.exercises.some((e) => e.ref);
  const status = !anything ? 'No recordings yet.' : unbacked ? unbackedText(c) : 'Everything is backed up.';

  app.innerHTML = `
    <header class="top sub"><a class="back" href="#/">${icons.back}<span>Practice</span></a></header>
    <h1 class="title">Backup and storage</h1>

    <section class="block">
      <h2>Back up</h2>
      <p>Your recordings are stored only on this phone. A backup is a .zip file with your videos, reference tracks, scores and notes. When the share sheet opens, choose Save to Files and pick a folder in iCloud Drive.</p>
      <p class="status">${status}${state.lastBackupAt ? ` Last backup ${esc(fmtRelative(state.lastBackupAt))}.` : ''}</p>
      <div class="stack">
        <button class="btn primary" data-act="prep-backup" data-scope="new" ${unbacked ? '' : 'disabled'}>Back up new recordings</button>
        <button class="btn" data-act="prep-backup" data-scope="all" ${state.exercises.length ? '' : 'disabled'}>Back up everything</button>
      </div>
      <div id="backup-out" aria-live="polite"></div>
    </section>

    <section class="block">
      <h2>Restore</h2>
      <p>Add exercises and recordings from one or more backup files. Nothing already on this phone is deleted or overwritten.</p>
      <label class="btn">Choose backup files<input type="file" accept=".zip,application/zip" multiple class="vh" data-restore></label>
      <div id="restore-out" aria-live="polite"></div>
    </section>

    <section class="block">
      <h2>Weekly goal</h2>
      <div class="stepper">
        <button class="btn" data-act="goal" data-d="-1" aria-label="One day fewer">−</button>
        <output>${plural(state.goal, 'day')} a week</output>
        <button class="btn" data-act="goal" data-d="1" aria-label="One day more">+</button>
      </div>
    </section>

    <section class="block">
      <h2>Storage</h2>
      ${est?.usage != null ? `<p>This app is using ${fmtBytes(est.usage)}.</p>` : ''}
      ${persisted
        ? '<p>iOS has agreed to keep this app’s data when space runs low.</p>'
        : '<p>iOS can clear website data when the phone runs low on space. Asking it to keep this app’s data lowers that risk, but backups are still the safe copy.</p><button class="btn" data-act="persist">Ask iOS to keep my data</button>'}
    </section>

    ${standalone ? '' : `<section class="block">
      <h2>Install</h2>
      <p>In Safari, tap Share, then Add to Home Screen. The app then opens full screen and works offline. Data saved in Safari and in the installed app is kept separately, so install it before you start recording.</p>
    </section>`}

    <p class="fine">Nothing you record leaves this phone unless you save a backup. The app makes no network requests apart from loading its own code.</p>`;
}

/* ---------- backup & restore ---------- */

async function prepBackup(scope, btn) {
  const out = document.getElementById('backup-out');
  const chosen = (scope === 'new' ? state.attempts.filter((a) => !a.backedUpAt) : state.attempts).slice().sort(byDate);
  const refExs = state.exercises.filter((e) => e.ref && (scope === 'all' || !e.ref.backedUpAt));
  app.querySelectorAll('[data-act=prep-backup]').forEach((b) => (b.disabled = true));
  out.innerHTML = '<p class="progress">Preparing backup…</p>';
  try {
    const exName = (id) => slug(exerciseOf(id)?.name);
    const files = [];
    const sizes = chosen.map((a) => a.size || 0);
    const groups = [];
    let cur = [], curSize = 0;
    chosen.forEach((a, i) => {
      if (cur.length && curSize + sizes[i] > PART_BYTES) { groups.push(cur); cur = []; curSize = 0; }
      cur.push(a); curSize += sizes[i];
    });
    if (cur.length || !groups.length) groups.push(cur);

    const exportedAt = Date.now();
    const data = {
      app: 'singing-practice', version: 1, exportedAt,
      exercises: state.exercises.map((e) => (e.ref ? { ...e, refFile: refPath(e) } : e)),
      attempts: state.attempts.map((a) => ({ ...a, file: `videos/${exName(a.exerciseId)}/${videoFileName(a)}` })),
    };
    const dataBlob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const day = stamp(exportedAt).slice(0, 10);

    for (let g = 0; g < groups.length; g++) {
      const entries = [{ name: 'data.json', blob: dataBlob }];
      if (g === 0) {
        for (const e of refExs) {
          const r = await db.get('refs', e.id);
          if (r) entries.push({ name: refPath(e), blob: r });
        }
      }
      for (const a of groups[g]) {
        const v = await db.get('videos', a.id);
        if (v) entries.push({ name: `videos/${exName(a.exerciseId)}/${videoFileName(a)}`, blob: v });
        const t = await db.get('thumbs', a.id);
        if (t) entries.push({ name: `thumbs/${a.id}.jpg`, blob: t });
      }
      const zip = await makeZip(entries, (done, total) => {
        out.innerHTML = `<p class="progress">Preparing backup${groups.length > 1 ? ` part ${g + 1} of ${groups.length}` : ''}… ${Math.round((done / total) * 100)}%</p>`;
      });
      const suffix = groups.length > 1 ? `-part${g + 1}of${groups.length}` : '';
      files.push(new File([zip], `singing-backup-${day}${suffix}.zip`, { type: 'application/zip' }));
    }
    pendingBackup = { files, ids: chosen.map((a) => a.id), refIds: refExs.map((e) => e.id), at: exportedAt };
    const total = files.reduce((s, f) => s + f.size, 0);
    const what = [chosen.length ? plural(chosen.length, 'recording') : '', refExs.length ? plural(refExs.length, 'reference track') : ''].filter(Boolean).join(' and ') || 'Scores and notes';
    out.innerHTML = `<p class="progress">Backup ready: ${what}, ${fmtBytes(total)}${files.length > 1 ? `, in ${files.length} files` : ''}.</p>
      <button class="btn primary" data-act="share-backup">Save backup</button>`;
  } catch (err) {
    out.innerHTML = `<p class="progress warn">Couldn't prepare the backup: ${esc(err?.message || err)}</p>`;
    app.querySelectorAll('[data-act=prep-backup]').forEach((b) => (b.disabled = false));
  }
}

async function shareBackup() {
  if (!pendingBackup) return;
  const { files, ids, refIds, at } = pendingBackup;
  try {
    await shareFiles(files, 'Singing practice backup');
  } catch (err) {
    if (err?.name === 'AbortError') { toast('Backup not saved'); return; }
    toast(`Couldn't share the backup: ${err?.message || err}`);
    return;
  }
  const marked = state.attempts.filter((a) => ids.includes(a.id));
  marked.forEach((a) => (a.backedUpAt = at));
  await db.putMany('attempts', marked);
  const refMarked = state.exercises.filter((e) => e.ref && refIds.includes(e.id));
  refMarked.forEach((e) => (e.ref.backedUpAt = at));
  if (refMarked.length) await db.putMany('exercises', refMarked);
  state.lastBackupAt = at;
  await db.put('meta', at, 'lastBackupAt');
  pendingBackup = null;
  await viewSettings();
  toast('Backup saved');
}

async function restore(fileList) {
  const out = document.getElementById('restore-out');
  const files = [...fileList];
  let addedEx = 0, addedAtt = 0, addedVid = 0, addedRefs = 0;
  const problems = [];
  for (const [fi, f] of files.entries()) {
    out.innerHTML = `<p class="progress">Reading ${esc(f.name)}${files.length > 1 ? ` (${fi + 1} of ${files.length})` : ''}…</p>`;
    try {
      const entries = await readZip(f);
      const byName = new Map(entries.map((e) => [e.name, e]));
      const dataEntry = byName.get('data.json');
      if (!dataEntry) throw new Error('not a backup from this app');
      const data = JSON.parse(await (await entryData(dataEntry)).text());
      if (data.app !== 'singing-practice') throw new Error('not a backup from this app');

      for (const { refFile, ...ex } of data.exercises || []) {
        let local = exerciseOf(ex.id);
        if (!local) { await db.put('exercises', ex); state.exercises.push(ex); local = ex; addedEx++; }
        else if ((ex.updatedAt || 0) > (local.updatedAt || 0)) { Object.assign(local, ex); await db.put('exercises', local); }
        const refEntry = refFile && byName.get(refFile);
        if (refEntry && ex.ref && !(await db.has('refs', ex.id))) {
          if (!local.ref) local.ref = { ...ex.ref };
          local.ref.backedUpAt = local.ref.backedUpAt || data.exportedAt;
          await db.saveRef(local, await entryData(refEntry, ex.ref.mime || 'audio/mp4'));
          addedRefs++;
        }
      }
      for (const raw of data.attempts || []) {
        const { file: path, ...a } = raw;
        if (!exerciseOf(a.exerciseId)) continue;
        if (!state.attempts.some((x) => x.id === a.id)) {
          a.backedUpAt = a.backedUpAt || data.exportedAt;
          await db.put('attempts', a);
          state.attempts.push(a);
          addedAtt++;
        }
        const entry = byName.get(path);
        if (entry && !(await db.has('videos', a.id))) {
          await db.put('videos', await entryData(entry, a.mime || 'video/quicktime'), a.id);
          addedVid++;
          const t = byName.get(`thumbs/${a.id}.jpg`);
          if (t) await db.put('thumbs', await entryData(t, 'image/jpeg'), a.id);
        }
      }
    } catch (err) {
      problems.push(`${f.name}: ${err?.message || err}`);
    }
  }
  const parts = [];
  if (addedEx) parts.push(plural(addedEx, 'exercise'));
  if (addedAtt) parts.push(plural(addedAtt, 'attempt'));
  if (addedVid) parts.push(plural(addedVid, 'video'));
  if (addedRefs) parts.push(plural(addedRefs, 'reference track'));
  const summary = parts.length ? `Restored ${parts.join(', ')}.` : 'Nothing new to restore: everything in the backup is already on this phone.';
  out.innerHTML = `<p class="progress">${esc(summary)}</p>${problems.map((p) => `<p class="progress warn">Couldn't read ${esc(p)}</p>`).join('')}`;
  if (addedVid || addedRefs) requestPersist();
}

/* ---------- events ---------- */

app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const route = parseRoute();
  if (act === 'new-ex') exerciseSheet(null);
  else if (act === 'ref-sheet') refSheet(route.id);
  else if (act === 'toggle-pitch') {
    const sec = el.closest('.pitch');
    const shown = sec.classList.toggle('collapsed') === false;
    setPref('pitchGraph', shown);
    el.textContent = shown ? 'Hide' : 'Show';
    el.setAttribute('aria-expanded', String(shown));
  }
  else if (act === 'analyze') {
    const a = state.attempts.find((x) => x.id === route.id);
    const msg = app.querySelector('[data-analyze-msg]');
    el.disabled = true;
    await analyzeAttempt(a, null, (f) => { if (msg) msg.textContent = `Analysing… ${Math.round(f * 100)}%`; });
    const ex = exerciseOf(a.exerciseId);
    if (ex?.ref && !ex.ref.pitch) await analyzeRef(ex);
    if (parseRoute().id === a.id) await render();
  }
  else if (act === 'add-video') addVideoSheet(route.id);
  else if (act === 'edit-ex') exerciseSheet(exerciseOf(route.id));
  else if (act === 'sort') { state.sort = el.dataset.sort; await viewExercise(route.id); }
  else if (act === 'prep-backup') prepBackup(el.dataset.scope, el);
  else if (act === 'share-backup') shareBackup();
  else if (act === 'persist') {
    const ok = await navigator.storage?.persist?.().catch(() => false);
    toast(ok ? 'iOS will keep this app’s data' : 'iOS declined for now. Installing the app to the Home Screen and using it regularly helps.');
    await viewSettings();
  } else if (act === 'goal') {
    state.goal = Math.min(7, Math.max(1, state.goal + Number(el.dataset.d)));
    await db.put('meta', state.goal, 'goal');
    app.querySelector('.stepper output').textContent = `${plural(state.goal, 'day')} a week`;
  } else if (act === 'share-video') {
    const a = state.attempts.find((x) => x.id === route.id);
    const blob = app._blob;
    if (!a || !blob) return;
    const name = `${slug(exerciseOf(a.exerciseId)?.name)}_${videoFileName(a)}`;
    try { await shareFiles([new File([blob], name, { type: a.mime })], name); }
    catch (err) { if (err?.name !== 'AbortError') toast(`Couldn't share: ${err?.message || err}`); }
  } else if (act === 'del-att') {
    const a = state.attempts.find((x) => x.id === route.id);
    if (!a || !confirm(`Delete this attempt and its video? ${a.backedUpAt ? 'It is in a backup.' : 'It has not been backed up.'}`)) return;
    await db.deleteAttempts([a.id]);
    state.attempts = state.attempts.filter((x) => x.id !== a.id);
    location.hash = `#/ex/${a.exerciseId}`;
    toast('Attempt deleted');
  }
});

function onChange(e) {
  const input = e.target;
  if (input.matches('[data-pick]') && input.files?.[0]) {
    const file = input.files[0];
    attemptSheet(file, input.dataset.ex || parseRoute().id);
    input.value = '';
  } else if (input.matches('[data-restore]') && input.files?.length) {
    restore(input.files).finally(() => { input.value = ''; });
  }
}
app.addEventListener('change', onChange);
sheet.addEventListener('change', onChange);

/* ---------- routing ---------- */

function parseRoute() {
  const [view, id, sub] = (location.hash.slice(2) || '').split('/');
  return { view: view || 'home', id, sub };
}

let viewCleanup = null;
let reloadPending = false;

async function render() {
  if (reloadPending) { location.reload(); return; }
  viewCleanup?.();
  viewCleanup = null;
  closeSheet();
  pageURLs.forEach(URL.revokeObjectURL);
  pageURLs = [];
  app._blob = null;
  const { view, id, sub } = parseRoute();
  if (view === 'ex' && sub === 'compare') await viewCompare(id);
  else if (view === 'ex' && sub === 'record') await viewRecord(id);
  else if (view === 'ex') await viewExercise(id);
  else if (view === 'a') await viewAttempt(id);
  else if (view === 'settings') await viewSettings();
  else viewHome();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

async function start() {
  try {
    const [exercises, attempts, goal, lastBackupAt] = await Promise.all([
      db.getAll('exercises'), db.getAll('attempts'), db.get('meta', 'goal'), db.get('meta', 'lastBackupAt'),
    ]);
    Object.assign(state, { exercises, attempts, goal: goal ?? 4, lastBackupAt: lastBackupAt ?? null });
  } catch (err) {
    app.innerHTML = `<p class="missing">This browser won't let the app store data (${esc(err?.message || err)}). Private Browsing blocks storage; open the app in a normal Safari tab.</p>`;
    return;
  }
  await render();
}

if ('serviceWorker' in navigator) {
  // Load new versions of the app as soon as they're installed, but never mid-recording.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (sheet.open || document.body.classList.contains('rec-mode')) reloadPending = true;
    else location.reload();
  });
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
start();
