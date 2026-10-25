/* Burrow music engine (runs in a hidden page).
   Mode "generated": original music made on the fly, soft notes in a cavernous reverb over a slow pad.
   Mode "own":       shuffles audio files you added yourself on the Music page. */
const ctx = new AudioContext();
const master = ctx.createGain();
master.gain.value = 0;
master.connect(ctx.destination);

const genBus = ctx.createGain(); genBus.gain.value = 0; genBus.connect(master);
const ownBus = ctx.createGain(); ownBus.gain.value = 0; ownBus.connect(master);

/* ---------- generated music ---------- */
function makeImpulse(seconds, decay) {
   const n = Math.floor(ctx.sampleRate * seconds);
   const buf = ctx.createBuffer(2, n, ctx.sampleRate);
   for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
         lp += 0.3 * ((Math.random() * 2 - 1) - lp);           // darken the tail
         d[i] = lp * Math.pow(1 - i / n, decay);
      }
   }
   return buf;
}

const dry = ctx.createGain(); dry.gain.value = 0.5; dry.connect(genBus);
const verb = ctx.createConvolver(); verb.buffer = makeImpulse(6, 2.4);
const wet = ctx.createGain(); wet.gain.value = 1; verb.connect(wet); wet.connect(genBus);
const send = ctx.createGain(); send.gain.value = 0.8; send.connect(verb);

// Weather bed: rain and wind under the music, only in generated mode.
const bedBuf = (() => {
   const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = b.getChannelData(0);
   for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
   return b;
})();
const bedSrc = ctx.createBufferSource(); bedSrc.buffer = bedBuf; bedSrc.loop = true;
const bedFilter = ctx.createBiquadFilter();
const bedGain = ctx.createGain(); bedGain.gain.value = 0;
bedSrc.connect(bedFilter); bedFilter.connect(bedGain); bedGain.connect(genBus); bedSrc.start();
const BED = {
   rain: ['bandpass', 3000, 0.07], storm: ['bandpass', 2200, 0.11], snow: ['lowpass', 400, 0.02],
   fog: ['lowpass', 300, 0.02], cloudy: ['lowpass', 450, 0.01], clear: ['lowpass', 500, 0], night: ['lowpass', 300, 0]
};

// Slow string-like pad, always present while generated music plays.
const pad = ctx.createGain(); pad.gain.value = 0;
const padLp = ctx.createBiquadFilter(); padLp.type = 'lowpass'; padLp.frequency.value = 520;
pad.connect(padLp); padLp.connect(dry); padLp.connect(send);
const swell = ctx.createOscillator(); swell.frequency.value = 0.06;
const swellDepth = ctx.createGain(); swellDepth.gain.value = 160;
swell.connect(swellDepth); swellDepth.connect(padLp.frequency); swell.start();
const padVoices = [['sawtooth', -6, 0.5], ['sawtooth', 6, 0.5], ['triangle', 0, 0.8], ['sine', 0, 0.7]].map(([type, detune, level]) => {
   const o = ctx.createOscillator(), g = ctx.createGain();
   o.type = type; o.detune.value = detune; g.gain.value = level;
   o.frequency.value = 110;
   o.connect(g); g.connect(pad); o.start();
   return o;
});

const THEMES = {
   hallownest: { scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], beat: 1.7, density: 0.42, arp: false, bell: false, pad: 0.06, dur: [3.5, 5.5] },
   pharloom: { scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 3, 4], beat: 0.95, density: 0.8, arp: true, bell: true, pad: 0.05, dur: [1.6, 2.6] }
};

const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);
const degSemi = (scale, n) => scale[((n % 7) + 7) % 7] + 12 * Math.floor(n / 7);
const rand = (a, b) => a + Math.random() * (b - a);

function note(freq, t, dur, vel, bell) {
   const env = ctx.createGain();
   const lp = ctx.createBiquadFilter();
   lp.type = 'lowpass'; lp.frequency.value = Math.min(7000, freq * 7);
   env.connect(lp); lp.connect(dry); lp.connect(send);
   env.gain.setValueAtTime(0, t);
   env.gain.linearRampToValueAtTime(vel, t + 0.01);
   env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
   const parts = bell ? [[1, 1, 'triangle'], [2.01, 0.45, 'sine'], [2.76, 0.22, 'sine'], [5.4, 0.08, 'sine']]
      : [[1, 1, 'sine'], [2, 0.35, 'sine'], [3, 0.15, 'sine'], [4, 0.05, 'sine']];
   for (const [ratio, level, type] of parts) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq * ratio; g.gain.value = level;
      o.connect(g); g.connect(env);
      o.start(t); o.stop(t + dur + 0.1);
   }
}

const gen = { on: false, timer: 0, next: 0, chord: 0, theme: 'hallownest', root: 45, pendingRoot: 45, last: 7 };

function playChord(t) {
   const th = THEMES[gen.theme];
   gen.root = gen.pendingRoot;
   const d = th.prog[gen.chord++ % th.prog.length];
   const tones = [d, d + 2, d + 4, d + 7];                              // chord degrees, melody register up an octave
   const midi = n => gen.root + degSemi(th.scale, n);
   const chordLen = th.beat * 4;

   // pad glides to the new chord
   [midi(d) - 12, midi(d) - 12, midi(d + 4) - 12, midi(d + 2)].forEach((m, i) => {
      padVoices[i].frequency.setTargetAtTime(midiToHz(m), t, 1.4);
   });

   pad.gain.setTargetAtTime(th.pad, t, 1.5);

   note(midiToHz(midi(d) - 12), t, chordLen * 0.9, 0.2, false);          // low root

   const slots = 8, step = chordLen / slots;
   for (let s = 0; s < slots; s++) {
      if (th.arp) {
         if (Math.random() < 0.15) continue;
         note(midiToHz(midi(tones[ARP[s % ARP.length]]) + 12), t + s * step, rand(th.dur[0], th.dur[1]), rand(0.1, 0.17), true);
         continue;
      }
      if (Math.random() > (s === 0 ? 0.85 : th.density)) continue;
      let deg;
      if (Math.random() < 0.3) deg = gen.last + (Math.random() < 0.5 ? -1 : 1);   // a step along the scale
      else {                                                                      // or a chord tone near the last note
         const near = tones.map(x => x + 7).sort((a, b) => Math.abs(a - gen.last) - Math.abs(b - gen.last));
         deg = near[Math.floor(Math.random() * 3)] ?? near[0];
      }
      deg = Math.max(d + 2, Math.min(d + 16, deg));
      gen.last = deg;
      note(midiToHz(midi(deg)), t + s * step + rand(0, 0.04), rand(th.dur[0], th.dur[1]), rand(0.12, 0.24), th.bell);
   }
}

function schedule() {
   const th = THEMES[gen.theme];
   while (gen.next < ctx.currentTime + 2.5) {
      playChord(gen.next);
      gen.next += th.beat * 4;
   }
}

function setGen(on, p) {
   if (p.theme && THEMES[p.theme]) gen.theme = p.theme;
   if (p.host) gen.pendingRoot = 45 + (Burrow.hashStr(p.host) % 7);            // each site nudges the key
   const bed = BED[p.mood] || BED.clear;
   bedFilter.type = bed[0];
   bedFilter.frequency.setTargetAtTime(bed[1], ctx.currentTime, 1);
   bedGain.gain.setTargetAtTime(on ? bed[2] : 0, ctx.currentTime, 1.5);
   if (on && !gen.on) {
      gen.on = true; gen.next = ctx.currentTime + 0.4; gen.chord = 0;
      gen.timer = setInterval(schedule, 500);
      schedule();
   } else if (!on && gen.on) {
      gen.on = false; clearInterval(gen.timer);
      pad.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
   }
}

/* ---------- your own tracks ---------- */
const own = { tracks: [], queue: [], audio: null, src: null, url: null, pauseTimer: 0 };

async function loadTracks() { own.tracks = await Burrow.listTracks().catch(() => []); }

function nextTrack() {
   if (!own.tracks.length) return;
   if (!own.queue.length) {
      own.queue = [...own.tracks];
      for (let i = own.queue.length - 1; i > 0; i--) {                         // shuffle
         const j = Math.floor(Math.random() * (i + 1));
         [own.queue[i], own.queue[j]] = [own.queue[j], own.queue[i]];
      }
   }
   const t = own.queue.pop();
   if (own.audio) { own.audio.pause(); own.src.disconnect(); URL.revokeObjectURL(own.url); }
   own.url = URL.createObjectURL(t.blob);
   own.audio = new Audio(own.url);
   own.src = ctx.createMediaElementSource(own.audio);
   own.src.connect(ownBus);
   own.audio.onended = nextTrack;
   own.audio.onerror = nextTrack;
   own.audio.play().catch(() => { });
}

async function setOwn(on) {
   clearTimeout(own.pauseTimer);
   if (on) {
      if (!own.tracks.length) await loadTracks();
      if (own.audio && !own.audio.ended) own.audio.play().catch(() => { });
      else nextTrack();
   } else if (own.audio) {
      own.pauseTimer = setTimeout(() => own.audio.pause(), 1500);              // after the fade-out
   }
}


/* ---------- control ---------- */
let current = { playing: false };

async function apply(p) {
   current = p;
   if (ctx.state === 'suspended') await ctx.resume().catch(() => { });
   const t = ctx.currentTime;
   const wantGen = p.playing && p.mode === 'generated';
   const wantOwn = p.playing && p.mode === 'own';
   master.gain.setTargetAtTime(p.playing ? p.volume : 0, t, 0.8);
   genBus.gain.setTargetAtTime(wantGen ? 1 : 0, t, 0.8);
   ownBus.gain.setTargetAtTime(wantOwn ? 1 : 0, t, 0.8);
   setGen(wantGen, p);
   setOwn(wantOwn);
   if (!p.playing) setTimeout(() => { if (!current.playing) ctx.suspend(); }, 6000);
}

chrome.runtime.onMessage.addListener(m => {
   if (m.target === 'offscreen' && m.type === 'music') apply(m);
   if (m.type === 'tracks-changed') { own.queue = []; loadTracks().then(() => { if (current.playing && current.mode === 'own' && !own.audio) nextTrack(); }); }
});
chrome.runtime.sendMessage({ type: 'offscreen-ready' }).catch(() => { });

