/* Burrow music engine (runs in a hidden page).
   Mode "generated": original music made on the fly, soft notes in a cavernous reverb over a slow pad.
   Mode "own":       shuffles audio files you added yourself on the Music page. */
const ctx = new AudioContext();
const master = ctx.createGain();
master.gain.value = 0;
master.connect(ctx.destination);

const genBus = ctx.createGain(); genBus.gain.value = 0; genBus.connect(master);
const ownBus = ctx.createGain(); ownBus.gain.value = 0; ownBus.connect(master);

