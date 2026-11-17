export const soundOptions = [
  ['click', 'Classic click'],
  ['kick', 'Kick'],
  ['snare', 'Snare'],
  ['rimshot', 'Rimshot'],
  ['hat', 'Closed hi-hat'],
  ['cowbell', 'Cowbell'],
];
export const defaultSounds = ['rimshot', 'hat', 'cowbell'];
export const pulseSoundOptions = [['default', 'Lane default'], ...soundOptions, ['off', 'Off']];

const tau = 2 * Math.PI;
const sine = (frequency, time) => Math.sin(tau * frequency * time);
const decay = (time, tail) => Math.exp(-time / tail);

function renderSound(sampleRate, length, voice) {
  const wave = new Float32Array(Math.round(sampleRate * length));
  const lowAlpha = 1 - Math.exp(-tau * 850 / sampleRate);
  const highAlpha = 1 - Math.exp(-tau * 4800 / sampleRate);
  let seed = 21943;
  let low = 0;
  let high = 0;
  let peak = 0;
  for (let index = 0; index < wave.length; index++) {
    const time = index / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    low += (noise - low) * lowAlpha;
    high += (noise - high) * highAlpha;

    const attack = Math.min(1, time / 0.00045);
    const release = Math.min(1, (wave.length - index - 1) / (sampleRate * 0.004));
    wave[index] = voice(time, high - low, noise - high) * attack * release;
    peak = Math.max(peak, Math.abs(wave[index]));
  }
  for (let index = 0; index < wave.length; index++) wave[index] /= peak;
  return wave;
}

export function makeSoundBank(sampleRate) {
  const render = (length, voice) => renderSound(sampleRate, length, voice);
  return {
    click: [
      [[1370, 2670, 0.0039], [1900, 3160, 0.005]],
      [[770, 2030, 0.0047], [950, 2240, 0.0058]],
      [[1060, 2410, 0.0043], [1510, 2860, 0.0054]],
    ].map((lane) => lane.map(([pitch, edge, tail]) =>
      render(0.024, (time) => (sine(pitch, time) + 0.22 * sine(edge, time)) * decay(time, tail)))),
    kick: render(0.092, (time, band) => {
      const phase = 53 * time + 105 * 0.013 * (1 - decay(time, 0.013));
      const body = Math.sin(tau * phase) * decay(time, 0.027);
      const attack = (0.24 * band + 0.20 * Math.sin(2 * tau * phase)) * decay(time, 0.005);
      return body + attack;
    }),
    snare: render(0.079, (time, band, bright) =>
      (1.4 * band + 0.23 * bright) * decay(time, 0.024) +
      (0.53 * sine(184, time) + 0.21 * sine(336, time)) * decay(time, 0.013)),
    rimshot: render(0.043, (time, band, bright) =>
      (0.8 * sine(1130, time) + 0.43 * sine(1733, time)) * decay(time, 0.010) +
      (band + 0.6 * bright + 0.52 * sine(254, time)) * decay(time, 0.006)),
    hat: render(0.045, (time, band, bright) =>
      (0.25 * band + 1.36 * bright + 0.16 * sine(5680, time) + 0.12 * sine(7430, time)) * decay(time, 0.013)),
    cowbell: render(0.068, (time, band) =>
      (0.64 * sine(555, time) + 0.58 * sine(845, time)) * decay(time, 0.024) +
      (0.22 * sine(1665, time) + 0.2 * sine(2535, time) + 0.18 * band) * decay(time, 0.008)),
  };
}
