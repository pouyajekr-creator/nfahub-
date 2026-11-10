// Tiny synthesized sound effects (no audio files needed).
let ctx = null;
let muted = false;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.12, delay = 0, slide = 0 } = {}) {
  if (muted) return;
  const a = ac();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.08, freq = 3000, q = 0.8 } = {}) {
  if (muted) return;
  const a = ac();
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  unlock: () => { try { ac(); } catch { /* audio unavailable */ } },
  toggle: () => (muted = !muted),
  pick: () => tone(520, 0.08, { type: 'triangle' }),
  grind: () => noise(1.5, { freq: 900, q: 0.5, vol: 0.1 }),
  brew: () => noise(2.6, { freq: 5200, q: 1.5, vol: 0.05 }),
  steam: () => noise(1.2, { freq: 7000, q: 0.7, vol: 0.06 }),
  pour: () => noise(0.7, { freq: 1800, q: 2, vol: 0.06 }),
  sizzle: () => noise(1.6, { freq: 6000, q: 0.4, vol: 0.05 }),
  ready: () => { tone(880, 0.12); tone(1320, 0.18, { delay: 0.1 }); },
  bell: () => { tone(1568, 0.5, { vol: 0.09 }); tone(2093, 0.6, { vol: 0.05, delay: 0.02 }); },
  coin: () => { tone(988, 0.08, { type: 'square', vol: 0.06 }); tone(1319, 0.25, { type: 'square', vol: 0.06, delay: 0.08 }); },
  bad: () => tone(180, 0.3, { type: 'sawtooth', vol: 0.08, slide: 0.6 }),
  trash: () => noise(0.25, { freq: 400, q: 1, vol: 0.12 }),
};
