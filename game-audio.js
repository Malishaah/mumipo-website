window.createChickGameAudio = function createChickGameAudio() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return null;

  const effects = {
    jump: [[0, 330, .17, .08, 480]],
    bump: [[0, 125, .105, .10, 76], [.012, 245, .075, .025, 140]],
    crumble: [[0, 160, .12, .07, 85]],
    splash: [[0, 310, .12, .07, 165], [.035, 470, .11, .042, 245]],
    bounce: [[0, 260, .12, .07, 385], [.06, 440, .15, .055, 510]],
    win: [[.16, 392, .28, .075], [.32, 494, .28, .07], [.48, 587, .42, .064], [.69, 784, .5, .043]],
    loss: [[.16, 294, .27, .06], [.34, 247, .38, .056], [.54, 196, .47, .049]],
  };
  const textures = {
    bump: [[0, 440, .15]],
    crumble: [[0, 900, .13], [.036, 670, .11], [.071, 480, .075]],
  };
  // A small, unhurried 4/4 tune, with rests and a quiet alternating bass.
  const melody = [
    60, null, 64, 67, null, 69, 67, null,
    64, null, 62, 64, null, 67, 64, null,
    65, null, 69, null, 67, 64, null, 62,
    64, null, 62, null, 60, null, null, null,
  ];
  const bass = [48, 48, 45, 45, 41, 41, 43, 48];
  const beat = 60 / 86;
  let context, master, music, timer, noise, gulpBuffer, gulpSource, gulpRequest;
  let nextBeat = 0;
  let beatIndex = 0;
  let enabled = true;

  function unlock() {
    if (!enabled) return;
    try {
      if (!context) {
        context = new AudioEngine();
        master = context.createGain();
        master.gain.value = .32;
        master.connect(context.destination);
        music = context.createGain();
        music.gain.value = 0;
        music.connect(master);
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * .065), context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      loadGulp();
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {
      // Audio is optional. The game still runs if the browser blocks it.
    }
  }

  function tone(destination, time, frequency, duration, volume, end = frequency) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(end, time + duration);
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + .025);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope).connect(destination);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  function schedule() {
    if (context.state !== 'running') return;
    const now = context.currentTime;
    if (nextBeat < now) nextBeat = now + .04;
    while (nextBeat < now + .16) {
      const note = melody[beatIndex % melody.length];
      if (note !== null) tone(music, nextBeat, 440 * 2 ** ((note - 69) / 12), .46, .032);
      if (beatIndex % 4 === 0) {
        const low = bass[Math.floor(beatIndex / 4) % bass.length];
        tone(music, nextBeat, 440 * 2 ** ((low - 69) / 12), .86, .026);
      }
      nextBeat += beat / 2;
      beatIndex++;
    }
  }

  function playMusic() {
    if (!enabled || !music || timer !== undefined) return;
    nextBeat = context.currentTime + .04;
    music.gain.setTargetAtTime(1, context.currentTime, .035);
    schedule();
    timer = setInterval(schedule, 95);
  }

  function stopMusic() {
    clearInterval(timer);
    timer = undefined;
    if (music) music.gain.setTargetAtTime(0, context.currentTime, .025);
  }

  function loadGulp() {
    if (gulpRequest) return;
    // Recorded gulp by OwlStorm (CC0): https://freesound.org/people/OwlStorm/sounds/151234/
    gulpRequest = fetch('audio/fruit-gulp.wav?v=soft')
      .then(response => {
        if (!response.ok) throw new Error('Fruit sound unavailable');
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes))
      .then(buffer => { gulpBuffer = buffer; })
      .catch(() => { gulpRequest = undefined; });
  }

  function stopChewing() {
    if (gulpSource) gulpSource.stop();
    gulpSource = undefined;
  }

  function playGulp(time) {
    if (!gulpBuffer) return;
    stopChewing();
    const source = context.createBufferSource();
    source.buffer = gulpBuffer;
    const level = context.createGain();
    level.gain.value = .22;
    source.connect(level).connect(master);
    gulpSource = source;
    source.onended = () => {
      if (gulpSource === source) gulpSource = undefined;
    };
    source.start(time);
  }

  function playTexture(time, cutoff, volume) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + .005);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + .062);
    source.connect(filter).connect(envelope).connect(master);
    source.start(time);
  }

  return {
    unlock, playMusic, stopMusic, stopChewing,
    reset() { beatIndex = 0; stopChewing(); },
    setEnabled(value) {
      enabled = value;
      if (!enabled) {
        stopMusic();
        stopChewing();
      }
      if (master) master.gain.setTargetAtTime(enabled ? .32 : 0, context.currentTime, .012);
    },
    play(name) {
      if (!enabled || context?.state !== 'running') return;
      const time = context.currentTime + .008;
      if (name === 'munch') return playGulp(time);
      for (const [offset, cutoff, volume] of textures[name] ?? []) {
        playTexture(time + offset, cutoff, volume);
      }
      for (const [offset, frequency, duration, volume, end] of effects[name]) {
        tone(master, time + offset, frequency, duration, volume, end);
      }
    },
  };
};
