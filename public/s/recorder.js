// In-app recording with getUserMedia + MediaRecorder, so a reference track can play
// while you sing. Phone "call" processing (echo cancellation, noise suppression,
// auto gain) is switched off because it distorts sustained notes.

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
export function mountRecorder(root, { title, backHref, refURL, refName, onRecorded }) {
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

  setAudioSession();
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: { ...VOICE },
  }).then((s) => {
    if (closed) { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s;
    preview.srcObject = s;
    preview.play().catch(() => {});
    msg.textContent = '';
    btn.disabled = false;
  }).catch((err) => { msg.textContent = permissionMessage(err); });

  const syncListen = () => { if (listen) listen.textContent = ref.paused ? 'Listen' : 'Pause'; };
  ref?.addEventListener('play', syncListen);
  ref?.addEventListener('pause', syncListen);
  ref?.addEventListener('ended', syncListen);
  listen?.addEventListener('click', () => {
    if (recorder?.state === 'recording') return;
    if (ref.paused) { ref.loop = loop.checked; ref.play().catch(() => {}); } else ref.pause();
  });

  function start() {
    chunks = [];
    discard = false;
    const type = pickType(VIDEO_TYPES);
    recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 160000, videoBitsPerSecond: 2500000 });
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(timer);
      const seconds = (performance.now() - t0) / 1000;
      setIdle();
      if (discard || !chunks.length) return;
      onRecorded(new Blob(chunks, { type: recorder.mimeType || type || 'video/mp4' }), seconds);
    };
    // Start the reference in the same tap so iOS allows playback.
    if (ref && playRef.checked) {
      ref.pause();
      ref.currentTime = 0;
      ref.loop = loop.checked;
      ref.play().catch(() => {});
    }
    recorder.start(1000);
    t0 = performance.now();
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
    document.body.classList.remove('rec-mode');
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
