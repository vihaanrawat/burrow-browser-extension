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