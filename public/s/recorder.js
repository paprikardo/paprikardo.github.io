// In-app recording with getUserMedia + MediaRecorder, so a reference track can play
// while you sing. Phone "call" processing (echo cancellation, noise suppression,
// auto gain) is switched off because it distorts sustained notes.

import { HOP, decimate, detect, smooth, noteName, isNatural } from './pitch.js';

const VIDEO_TYPES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const AUDIO_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
const VOICE = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

export const canRecordInApp = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

function pickType(list) {
  if (!MediaRecorder.isTypeSupported) return '';
  return list.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

function setAudioSession() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch { /* not supported */ }
}

function permissionMessage(err) {
  if (err?.name === 'NotAllowedError') return 'Camera or microphone access is blocked. Allow it when iOS asks, or in Settings → Apps → Safari → Camera and Microphone. Then reopen this screen.';
  if (err?.name === 'NotFoundError') return 'No camera or microphone was found.';
  if (err?.name === 'NotReadableError') return 'The camera or microphone is in use by another app. Close it and reopen this screen.';
  return `Couldn't start the camera: ${err?.message || err}`;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Full-screen video recorder. Returns a cleanup function; call it when leaving the screen.
export function mountRecorder(root, { title, backHref, refURL, refName, refPitch, onRecorded }) {
  document.body.classList.add('rec-mode');
  root.innerHTML = `
    <div class="rec">
      <div class="rec-stage">
        <video class="rec-preview" muted playsinline autoplay></video>
        <div class="rec-top">
          <a class="rec-done" href="${backHref}">Done</a>
          <span class="rec-time" aria-live="off"></span>
          <span class="rec-spacer"></span>
        </div>
        <p class="rec-msg">Starting camera…</p>
        <div class="tuner">
          <canvas class="tuner-trace" aria-hidden="true"></canvas>
          <div class="tuner-read" aria-live="off">
            <span class="tuner-note">–</span>
            <span class="tuner-meter" aria-hidden="true"><i></i></span>
            <span class="tuner-cents"></span>
          </div>
          <button type="button" class="tuner-start">Tap to show your pitch</button>
        </div>
      </div>
      <div class="rec-controls">
        <p class="rec-title">${esc(title)}</p>
        ${refURL ? `
          <div class="rec-ref">
            <audio src="${refURL}" preload="auto" playsinline></audio>
            <button type="button" class="btn small" data-listen>Listen</button>
            <span class="rec-ref-name">${esc(refName || 'Reference track')}</span>
          </div>
          <div class="rec-opts">
            <label class="chk"><input type="checkbox" data-playref checked> Play reference while recording</label>
            <label class="chk"><input type="checkbox" data-loop> Loop</label>
          </div>
          <p class="rec-hint">Use wired headphones so the reference stays out of your recording. Bluetooth headphones make iOS switch to a low-quality microphone.</p>`
        : '<p class="rec-hint">Add a reference track on the exercise page to hear it while you record.</p>'}
        <button type="button" class="rec-btn" aria-label="Start recording" disabled><span></span></button>
      </div>
    </div>`;

  const q = (s) => root.querySelector(s);
  const preview = q('.rec-preview'), msg = q('.rec-msg'), time = q('.rec-time'), btn = q('.rec-btn');
  const ref = q('.rec-ref audio'), listen = q('[data-listen]'), playRef = q('[data-playref]'), loop = q('[data-loop]');
  let stream = null, recorder = null, chunks = [], t0 = 0, timer = null, closed = false, discard = false;
  const tuner = mountTuner(root.querySelector('.tuner'), { ref, refPitch });

  setAudioSession();
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: { ...VOICE },
  }).then((s) => {
    if (closed) { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s;
    preview.srcObject = s;
    preview.play().catch(() => {});
    tuner.attach(s);
    msg.textContent = '';
    btn.disabled = false;
  }).catch((err) => { msg.textContent = permissionMessage(err); });

  const syncListen = () => { if (listen) listen.textContent = ref.paused ? 'Listen' : 'Pause'; };
  ref?.addEventListener('play', syncListen);
  ref?.addEventListener('pause', syncListen);
  ref?.addEventListener('ended', syncListen);
  listen?.addEventListener('click', () => {
    tuner.start();
    if (recorder?.state === 'recording') return;
    if (ref.paused) { ref.loop = loop.checked; ref.play().catch(() => {}); } else ref.pause();
  });

  function start() {
    chunks = [];
    discard = false;
    tuner.start();
    let refOffset = null;
    const type = pickType(VIDEO_TYPES);
    recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 160000, videoBitsPerSecond: 2500000 });
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(timer);
      const seconds = (performance.now() - t0) / 1000;
      setIdle();
      const pitch = tuner.stopTrack();
      if (discard || !chunks.length) return;
      onRecorded(new Blob(chunks, { type: recorder.mimeType || type || 'video/mp4' }), seconds, {
        pitch,
        withRef: refOffset != null,
        refOffset: refOffset ?? 0,
        refLoop: !!ref?.loop,
      });
    };
    // Start the reference in the same tap so iOS allows playback.
    if (ref && playRef.checked) {
      ref.pause();
      ref.currentTime = 0;
      ref.loop = loop.checked;
      ref.addEventListener('playing', () => { refOffset = Math.max(0, (performance.now() - t0) / 1000 - ref.currentTime); }, { once: true });
      ref.play().catch(() => {});
    }
    recorder.start(1000);
    t0 = performance.now();
    tuner.startTrack(t0);
    root.querySelector('.rec').classList.add('is-recording');
    btn.setAttribute('aria-label', 'Stop recording');
    if (listen) listen.disabled = true;
    time.textContent = '0:00';
    timer = setInterval(() => { time.textContent = fmt((performance.now() - t0) / 1000); }, 250);
  }

  function setIdle() {
    root.querySelector('.rec')?.classList.remove('is-recording');
    btn.setAttribute('aria-label', 'Start recording');
    if (listen) listen.disabled = false;
    time.textContent = '';
  }

  function stop() {
    if (recorder?.state === 'recording') recorder.stop();
    if (ref) { ref.pause(); ref.currentTime = 0; }
  }

  btn.addEventListener('click', () => (recorder?.state === 'recording' ? stop() : start()));
  const onHide = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', onHide);

  return function cleanup() {
    closed = true;
    discard = true;
    stop();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onHide);
    stream?.getTracks().forEach((t) => t.stop());
    tuner.close();
    document.body.classList.remove('rec-mode');
  };
}

// Live pitch display: current note, cents meter and a scrolling trace. While the
// reference plays, its pitch line (if analysed) scrolls in from the right.
function mountTuner(el, { ref, refPitch }) {
  const canvas = el.querySelector('canvas');
  const noteEl = el.querySelector('.tuner-note'), centsEl = el.querySelector('.tuner-cents');
  const dot = el.querySelector('.tuner-meter i'), startBtn = el.querySelector('.tuner-start');
  const g = canvas.getContext('2d');
  const PAST = 4, FUTURE = 1.5;
  let stream = null, ctx = null, analyser = null, buf = null, raf = 0, frame = 0;
  let history = [], recent = [], center = null, track = null, trackT0 = 0;

  startBtn.addEventListener('click', () => start());

  function start() {
    if (!stream) return;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const mute = ctx.createGain();
      mute.gain.value = 0;
      src.connect(analyser);
      analyser.connect(mute).connect(ctx.destination);
      buf = new Float32Array(analyser.fftSize);
      raf = requestAnimationFrame(loop);
    }
    ctx.resume?.().catch(() => {});
    el.classList.add('on');
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (ctx.state !== 'running') return;
    frame++;
    if (frame % 2 === 0) {
      analyser.getFloatTimeDomainData(buf);
      const [x, sr] = decimate(buf, ctx.sampleRate);
      const m = detect(x, sr);
      recent.push(m);
      if (recent.length > 3) recent.shift();
      const voiced = recent.filter((v) => v != null);
      const val = m == null ? null : voiced.length === 3 ? voiced.slice().sort((a, b) => a - b)[1] : m;
      history.push({ t: now, m: val });
      while (history.length && now - history[0].t > PAST * 1000 + 200) history.shift();
      if (track && val != null) track[Math.round((now - trackT0) / 1000 / HOP)] = val;
      readout(val);
    }
    draw(now);
  }

  function readout(m) {
    if (m == null) { noteEl.textContent = '–'; centsEl.textContent = ''; dot.style.left = '50%'; el.classList.remove('voiced'); return; }
    const cents = Math.round((m - Math.round(m)) * 100);
    noteEl.textContent = noteName(m);
    centsEl.textContent = `${cents > 0 ? '+' : cents < 0 ? '−' : '±'}${Math.abs(cents)}¢`;
    dot.style.left = `${50 + cents}%`;
    el.classList.add('voiced');
  }

  function refAt(t) {
    if (!refPitch) return null;
    const dur = refPitch.midi.length * refPitch.hop;
    if (ref.loop) t = ((t % dur) + dur) % dur;
    if (t < 0 || t >= dur) return null;
    return refPitch.midi[Math.round(t / refPitch.hop)] ?? null;
  }

  function draw(now) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const nowX = w * 0.72, pps = nowX / PAST;
    const refPlaying = ref && refPitch && !ref.paused;

    // follow your voice, or the reference when you're silent
    const lastVoiced = history.filter((p) => p.m != null && now - p.t < 1500).map((p) => p.m);
    let target = lastVoiced.length ? lastVoiced.sort((a, b) => a - b)[Math.floor(lastVoiced.length / 2)] : null;
    if (target == null && refPlaying) target = refAt(ref.currentTime);
    if (target != null) center = center == null ? target : center + (target - center) * 0.06;
    if (center == null) return;
    const span = 12, rowH = h / span, lo = center - span / 2;
    const y = (m) => h - (m - lo) * rowH;

    g.font = '10px system-ui, sans-serif';
    for (let n = Math.ceil(lo); n <= lo + span; n++) {
      const nat = isNatural(n);
      g.strokeStyle = `rgba(255,255,255,${nat ? 0.16 : 0.07})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, y(n)); g.lineTo(w, y(n)); g.stroke();
      if (nat) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillText(noteName(n), 6, y(n) - 2); }
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.moveTo(nowX, 0); g.lineTo(nowX, h); g.stroke();

    g.lineCap = 'round'; g.lineJoin = 'round';
    if (refPlaying) {
      const rt = ref.currentTime;
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 7;
      g.beginPath();
      let pen = false;
      for (let tau = -PAST; tau <= FUTURE; tau += refPitch.hop) {
        const m = refAt(rt + tau);
        if (m == null) { pen = false; continue; }
        const x = nowX + tau * pps;
        if (pen) g.lineTo(x, y(m)); else { g.moveTo(x, y(m)); pen = true; }
      }
      g.stroke();
    }
    g.strokeStyle = '#ff5f91'; g.lineWidth = 3;
    g.beginPath();
    let prev = null;
    for (const p of history) {
      if (p.m == null) { prev = null; continue; }
      const x = nowX - ((now - p.t) / 1000) * pps;
      if (prev && p.t - prev.t < 150) g.lineTo(x, y(p.m)); else g.moveTo(x, y(p.m));
      prev = p;
    }
    g.stroke();
  }

  return {
    attach(s) { stream = s; el.classList.add('ready'); },
    start,
    startTrack(t) { track = []; trackT0 = t; },
    stopTrack() {
      if (!track) return null;
      const out = Array.from({ length: track.length }, (_, i) => track[i] ?? null);
      track = null;
      return out.some((v) => v != null) ? { hop: HOP, midi: smooth(out) } : null;
    },
    close() { cancelAnimationFrame(raf); ctx?.close().catch(() => {}); },
  };
}

// Small audio-only recorder for making a reference track. Lives inside a sheet.
export function mountAudioRecorder(root, { onRecorded }) {
  root.innerHTML = `
    <div class="mini-rec">
      <button type="button" class="btn primary" data-mini>Start recording</button>
      <span class="mini-time"></span>
    </div>
    <p class="mini-msg"></p>`;
  const btn = root.querySelector('[data-mini]'), time = root.querySelector('.mini-time'), msg = root.querySelector('.mini-msg');
  let stream = null, recorder = null, chunks = [], t0 = 0, timer = null, closed = false;

  async function start() {
    btn.disabled = true;
    setAudioSession();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { ...VOICE } });
    } catch (err) {
      msg.textContent = permissionMessage(err).replace('camera or microphone', 'microphone').replace('Camera or microphone', 'Microphone');
      btn.disabled = false;
      return;
    }
    if (closed) { stream.getTracks().forEach((t) => t.stop()); return; }
    const type = pickType(AUDIO_TYPES);
    chunks = [];
    recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 160000 });
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      btn.textContent = 'Record again';
      time.textContent = '';
      if (!closed && chunks.length) onRecorded(new Blob(chunks, { type: recorder.mimeType || type || 'audio/mp4' }), (performance.now() - t0) / 1000);
    };
    recorder.start(1000);
    t0 = performance.now();
    btn.textContent = 'Stop';
    btn.disabled = false;
    timer = setInterval(() => { time.textContent = fmt((performance.now() - t0) / 1000); }, 250);
  }

  btn.addEventListener('click', () => (recorder?.state === 'recording' ? recorder.stop() : start()));

  return function cleanup() {
    closed = true;
    if (recorder?.state === 'recording') recorder.stop();
    clearInterval(timer);
    stream?.getTracks().forEach((t) => t.stop());
  };
}
