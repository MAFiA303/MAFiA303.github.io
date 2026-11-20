export const soundOptions = [
  ['click', 'Classic click'],
  ['woodblock', 'Woodblock'],
  ['clave', 'Clave'],
  ['rimshot', 'Rimshot'],
  ['kick', 'Kick'],
  ['snare', 'Snare'],
  ['hat', 'Closed hi-hat'],
  ['cowbell', 'Cowbell'],
];
export const defaultSounds = ['rimshot', 'hat', 'cowbell'];
export const pulseSoundOptions = [['default', 'Lane default'], ...soundOptions, ['off', 'Off']];

const tau = 2 * Math.PI;
const sine = (frequency, time) => Math.sin(tau * frequency * time);
const decay = (time, tail) => Math.exp(-time / tail);

function renderSound(sampleRate, length, voice, level = 1) {
  const wave = new Float32Array(Math.round(sampleRate * length));
  const lowAlpha = 1 - Math.exp(-tau * 900 / sampleRate);
  const highAlpha = 1 - Math.exp(-tau * 5200 / sampleRate);
  let seed = 21943;
  let low = 0;
  let high = 0;
  let sum = 0;
  for (let index = 0; index < wave.length; index++) {
    const time = index / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    low += (noise - low) * lowAlpha;
    high += (noise - high) * highAlpha;

    const attack = Math.min(1, time / 0.00035);
    const release = Math.min(1, (wave.length - index - 1) / (sampleRate * 0.004));
    const sample = voice(time, high - low, noise - high) * attack * release;
    wave[index] = sample;
    sum += sample;
  }
  const dc = sum / wave.length;
  let peak = 0;
  for (let index = 0; index < wave.length; index++) {
    const release = Math.min(1, (wave.length - index - 1) / (sampleRate * 0.004));
    const attack = Math.min(1, index / (sampleRate * 0.00035));
    const centered = (wave[index] - dc) * attack * release;
    wave[index] = centered;
    peak = Math.max(peak, Math.abs(centered));
  }
  const scale = peak > 0 ? level / peak : 0;
  for (let index = 0; index < wave.length; index++) wave[index] *= scale;
  return wave;
}

export function makeSoundBank(sampleRate) {
  const render = (length, voice, level = 1) => renderSound(sampleRate, length, voice, level);
  const pair = (regularArgs, accentArgs) => [render(...regularArgs), render(...accentArgs)];
  const hatCluster = (time, scale = 1) =>
    sine(3120 * scale, time) + sine(3890 * scale, time) + sine(4630 * scale, time) +
    sine(5410 * scale, time) + sine(6580 * scale, time) + sine(8190 * scale, time);
  return {
    click: [
      [[1380, 2760, 0.0046], [2080, 4160, 0.0062]],
      [[820, 1640, 0.0046], [1180, 2360, 0.0060]],
      [[1080, 2160, 0.0046], [1560, 3120, 0.0060]],
    ].map((lane) => lane.map(([pitch, edge, tail], accented) =>
      render(0.024, (time, band, bright) =>
        (sine(pitch, time) + (accented ? 0.34 : 0.24) * sine(edge, time)) * decay(time, tail) +
        (0.28 * band + (accented ? 0.25 : 0.14) * bright) * decay(time, 0.0016),
      ))),
    woodblock: pair(
      [0.044, (time, band) =>
        (sine(740, time) + 0.36 * sine(1420, time) + 0.14 * sine(2210, time)) * decay(time, 0.011) +
        0.24 * band * decay(time, 0.0018), 0.94],
      [0.052, (time, band, bright) =>
        (sine(1040, time) + 0.42 * sine(1990, time) + 0.18 * sine(3080, time)) * decay(time, 0.014) +
        (0.3 * band + 0.2 * bright) * decay(time, 0.002), 1],
    ),
    clave: pair(
      [0.036, (time, band) =>
        (sine(2350, time) + 0.32 * sine(3680, time)) * decay(time, 0.0085) +
        0.18 * band * decay(time, 0.0014), 0.95],
      [0.044, (time, band, bright) =>
        (sine(2860, time) + 0.38 * sine(4480, time)) * decay(time, 0.011) +
        (0.22 * band + 0.2 * bright) * decay(time, 0.0016), 1],
    ),
    rimshot: pair(
      [0.044, (time, band, bright) =>
        (0.95 * sine(1080, time) + 0.46 * sine(1720, time)) * decay(time, 0.010) +
        (0.55 * sine(260, time) + 0.48 * band + 0.28 * bright) * decay(time, 0.0055), 0.94],
      [0.054, (time, band, bright) =>
        (1.0 * sine(1420, time) + 0.54 * sine(2260, time) + 0.24 * sine(3420, time)) * decay(time, 0.013) +
        (0.62 * sine(310, time) + 0.65 * band + 0.48 * bright) * decay(time, 0.0075), 1],
    ),
    kick: pair(
      [0.090, (time, band) => {
        const phase = 56 * time + 115 * 0.012 * (1 - decay(time, 0.012));
        const body = (Math.sin(tau * phase) + 0.36 * Math.sin(2 * tau * phase)) * decay(time, 0.025);
        const attack = (0.34 * band + 0.25 * sine(165, time)) * decay(time, 0.0045);
        return Math.tanh((body + attack) * 1.15);
      }, 0.86],
      [0.105, (time, band, bright) => {
        const phase = 58 * time + 165 * 0.013 * (1 - decay(time, 0.013));
        const body = (Math.sin(tau * phase) + 0.46 * Math.sin(2 * tau * phase)) * decay(time, 0.030);
        const beater = (0.52 * band + 0.32 * bright + 0.35 * sine(2150, time)) * decay(time, 0.0055);
        return Math.tanh((body + beater) * 1.3);
      }, 0.96],
    ),
    snare: pair(
      [0.078, (time, band, bright) =>
        (1.15 * band + 0.28 * bright) * decay(time, 0.022) +
        (0.62 * sine(192, time) + 0.26 * sine(345, time)) * decay(time, 0.013), 0.92],
      [0.094, (time, band, bright) =>
        (1.35 * band + 0.48 * bright) * decay(time, 0.029) +
        (0.72 * sine(228, time) + 0.34 * sine(410, time) + 0.38 * sine(1240, time)) * decay(time, 0.016), 1],
    ),
    hat: pair(
      [0.044, (time, band, bright) =>
        (0.18 * Math.tanh(hatCluster(time, 1) * 0.55) + 0.92 * bright + 0.14 * band) * decay(time, 0.012), 0.94],
      [0.068, (time, band, bright) =>
        (0.24 * Math.tanh(hatCluster(time, 1.07) * 0.65) + 1.08 * bright + 0.22 * band) * decay(time, 0.022), 1],
    ),
    cowbell: pair(
      [0.066, (time, band) =>
        Math.tanh((0.68 * sine(545, time) + 0.62 * sine(820, time)) * 1.35) * decay(time, 0.021) +
        (0.22 * sine(1640, time) + 0.18 * band) * decay(time, 0.006), 0.86],
      [0.080, (time, band, bright) =>
        Math.tanh((0.72 * sine(660, time) + 0.68 * sine(995, time)) * 1.5) * decay(time, 0.027) +
        (0.32 * sine(1990, time) + 0.24 * band + 0.2 * bright) * decay(time, 0.008), 0.96],
    ),
  };
}
