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