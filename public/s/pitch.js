// Pitch detection for singing, entirely on the device.
// YIN (de Cheveigné & Kawahara, 2002) on audio decimated to ~16 kHz, which is plenty
// for sung fundamentals (about 70–1100 Hz) and keeps it cheap enough for phones.

export const HOP = 0.04; // seconds per stored pitch value (25 values per second)
const MIN_F = 70, MAX_F = 1100, THRESHOLD = 0.15, MIN_RMS = 0.004;
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const noteName = (midi) => { const n = Math.round(midi); return `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`; };
export const isNatural = (n) => !NAMES[((n % 12) + 12) % 12].includes('♯');

export function decimate(x, sr) {
  const f = Math.max(1, Math.floor(sr / 16000));
  if (f === 1) return [x, sr];
  const n = Math.floor(x.length / f);
  const y = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < f; k++) s += x[j++];
    y[i] = s / f;
  }
  return [y, sr / f];
}

// Returns a MIDI note number (fractional) or null when there is no clear pitch.
export function detect(frame, sr) {
  let rms = 0;
  for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i];
  if (Math.sqrt(rms / frame.length) < MIN_RMS) return null;

  const maxTau = Math.min(Math.floor(sr / MIN_F), Math.floor(frame.length / 2));
  const minTau = Math.max(2, Math.floor(sr / MAX_F));
  const W = frame.length - maxTau;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = frame[i] - frame[i + tau]; s += v * v; }
    d[tau] = s;
  }
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    d[tau] = running ? (d[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < THRESHOLD) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 1) return null;
  const a = d[tau - 1], b = d[tau], c = tau + 1 <= maxTau ? d[tau + 1] : b;
  const denom = a - 2 * b + c;
  const shift = denom ? (a - c) / (2 * denom) : 0;
  const f = sr / (tau + shift);
  return f >= MIN_F && f <= MAX_F ? freqToMidi(f) : null;
}

// Median-of-3 smoothing removes single-frame octave errors. Keeps nulls as gaps.
export function smooth(values) {
  const out = values.slice();
  for (let i = 1; i < values.length - 1; i++) {
    const w = [values[i - 1], values[i], values[i + 1]];
    if (w.some((v) => v == null)) continue;
    w.sort((p, q) => p - q);
    out[i] = w[1];
  }
  return out.map((v) => (v == null ? null : Math.round(v * 100) / 100));
}

// Decode any audio/video Blob the browser can read and return a pitch track.
export async function analyzeBlob(blob, onProgress) {
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(1, 1, 44100);
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  let mono = buf.getChannelData(0);
  if (buf.numberOfChannels > 1) {
    const r = buf.getChannelData(1);
    const m = new Float32Array(mono.length);
    for (let i = 0; i < m.length; i++) m[i] = (mono[i] + r[i]) / 2;
    mono = m;
  }
  const [x, sr] = decimate(mono, buf.sampleRate);
  const win = Math.round(0.043 * sr);
  const hop = Math.round(HOP * sr);
  const values = [];
  const frames = Math.max(0, Math.floor((x.length - win) / hop) + 1);
  for (let i = 0; i < frames; i++) {
    values.push(detect(x.subarray(i * hop, i * hop + win), sr));
    if (i % 150 === 149) { onProgress?.(i / frames); await new Promise((r) => setTimeout(r)); }
  }
  return { hop: HOP, midi: smooth(values) };
}

// Pitch-class distance in semitones (octave-independent), 0..6.
export const pcDistance = (a, b) => Math.abs(((((a - b) % 12) + 18) % 12) - 6);

// Compare an attempt with the reference. offset: seconds into the attempt when the reference began.
export function compare(you, ref, { offset = 0, loop = false } = {}) {
  if (!you?.midi?.length || !ref?.midi?.length) return null;
  const refDur = ref.midi.length * ref.hop;
  let both = 0, close = 0;
  you.midi.forEach((m, i) => {
    if (m == null) return;
    let t = i * you.hop - offset;
    if (t < 0) return;
    if (loop) t %= refDur; else if (t >= refDur) return;
    const r = ref.midi[Math.round(t / ref.hop)];
    if (r == null) return;
    both++;
    if (pcDistance(m, r) <= 0.5) close++;
  });
  return both >= 10 ? { share: close / both, frames: both } : null;
}

export function range(track) {
  const v = (track?.midi || []).filter((m) => m != null).sort((a, b) => a - b);
  if (v.length < 10) return null;
  // ignore the extreme 2% so stray detections don't stretch the range
  const lo = v[Math.floor(v.length * 0.02)], hi = v[Math.floor(v.length * 0.98)];
  return { lo, hi };
}
