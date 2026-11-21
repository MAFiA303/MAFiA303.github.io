export const limits = { bpm: [20, 300], meter: [1, 32], pulses: [1, 16], subdivision: [1, 8] };
export const beatUnits = [2, 4, 8, 16];

const noteNames = { 4: 'Quarters', 8: 'Eighths', 16: 'Sixteenths', 32: 'Thirty-seconds', 64: 'Sixty-fourths', 128: '128ths', 256: '256ths' };

export function subdivisionName(count, unit = 4) {
  if (count === 1) return 'Beat only';
  const tuplets = { 3: 'Triplets', 5: 'Quintuplets', 6: 'Sextuplets', 7: 'Septuplets' };
  if (tuplets[count]) return tuplets[count];
  if ([2, 4, 8, 16].includes(count)) return noteNames[unit * count] ?? `1/${unit * count} notes`;
  return `${count}-tuplets`;
}

export function subdivisionLabel(division, unit) {
  switch (division) {
    case 1: return '1 · Beat only';
    case 3: return `3 · 1/${unit * 2}T`;
    case 5: return '5 · Quintuplets';
    case 6: return `6 · 1/${unit * 4}T`;
    case 7: return '7 · Septuplets';
    default: return `${division} · 1/${unit * division}`;
  }
}

export const presets = [
  { id: 'three', label: '3:4', beats: 4, unit: 4, pulses: [3, 4], accents: [[0], [0]] },
  { id: 'five', label: '5:4', beats: 4, unit: 4, pulses: [5, 4], accents: [[0], [0]] },
  { id: 'seven', label: '7:4', beats: 4, unit: 4, pulses: [7, 4], accents: [[0], [0]] },
  { id: 'seven-eight', label: '7/8', beats: 7, unit: 8, pulses: [4, 7], accents: [[0], [0, 2, 4]] },
  { id: 'eleven-eight', label: '11/8', beats: 11, unit: 8, pulses: [4, 11], accents: [[0], [0, 3, 6, 9]] },
];

export function clampInt(value, [min, max], fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function gcdBig(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function addBigFrac([aN, aD], [bN, bD]) {
  const num = aN * bD + bN * aD;
  if (num === 0n) return [0n, 1n];
  const den = aD * bD;
  const d = gcdBig(num, den);
  return [num / d, den / d];
}

function divBigFrac([aN, aD], [bN, bD]) {
  if (aN === 0n) return [0n, 1n];
  const num = aN * bD;
  const den = aD * bN;
  const d = gcdBig(num, den);
  return [num / d, den / d];
}

// Per-beat length override is stored as a reduced fraction [numerator, denominator]
// of one beat (0 < n/d <= 2, n != d), or null when the full beat plays.
export function normalizeBeatEnd(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [numerator, denominator] = value;
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) return null;
  if (numerator <= 0 || denominator < 1 || numerator === denominator || numerator > denominator * 2 || denominator > 512) return null;
  const divisor = gcd(numerator, denominator);
  return [numerator / divisor, denominator / divisor];
}

export function normalizeBeatEnds(value, beats = 32) {
  return Array.from({ length: beats }, (_, beat) => normalizeBeatEnd(value?.[beat]));
}

export function normalizeBeatEnabled(value, beats = 32) {
  return Array.from({ length: beats }, (_, beat) => value?.[beat] !== false);
}

export function hasBeatTrim(beatEnds, beats) {
  return Array.isArray(beatEnds) && beatEnds.slice(0, beats).some((end) => normalizeBeatEnd(end) !== null);
}

export function hasBeatSkip(beatEnabled, beats) {
  return Array.isArray(beatEnabled) && beatEnabled.slice(0, beats).some((on) => on === false);
}

export function compareFractions([aNum, aDen], [bNum, bDen]) {
  return aNum * bDen - bNum * aDen;
}

export function beatLayout(beats, beatEnds = null, beatEnabled = null) {
  const ends = Array.from({ length: beats }, (_, beat) => normalizeBeatEnd(beatEnds?.[beat]));
  const enabled = Array.from({ length: beats }, (_, beat) => beatEnabled?.[beat] !== false);
  if (beats > 0 && !enabled.some(Boolean)) enabled[0] = true;
  const skipped = enabled.some((on) => !on);
  const trimmed = ends.some((end, beat) => enabled[beat] && end !== null && end[0] < end[1]);
  const extended = ends.some((end, beat) => enabled[beat] && end !== null && end[0] > end[1]);
  const visualExtended = ends.some((end) => end !== null && end[0] > end[1]);
  const altered = trimmed || extended;
  const shortened = skipped || altered;
  const starts = [];
  const lengths = [];
  const startsFloat = [];
  const lengthsFloat = [];
  const visualStarts = [];
  const visualWidths = [];
  let cursor = [0n, 1n];
  let visualCursor = 0;
  for (let beat = 0; beat < beats; beat++) {
    const end = ends[beat];
    const len = !enabled[beat] ? [0n, 1n] : end ? [BigInt(end[0]), BigInt(end[1])] : [1n, 1n];
    const lenFloat = !enabled[beat] ? 0 : end ? end[0] / end[1] : 1;
    const visWidth = end && end[0] > end[1] ? end[0] / end[1] : 1;
    starts.push(cursor);
    lengths.push(len);
    startsFloat.push(Number(cursor[0]) / Number(cursor[1]));
    lengthsFloat.push(lenFloat);
    visualStarts.push(visualCursor);
    visualWidths.push(visWidth);
    cursor = addBigFrac(cursor, len);
    visualCursor += visWidth;
  }
  return {
    ends,
    enabled,
    skipped,
    trimmed,
    extended,
    visualExtended,
    altered,
    shortened,
    starts,
    lengths,
    startsFloat,
    lengthsFloat,
    visualStarts,
    visualWidths,
    visualTotal: visualCursor,
    total: cursor,
    totalFloat: Number(cursor[0]) / Number(cursor[1]),
  };
}

export function formatBeatTrim(end) {
  const normalized = normalizeBeatEnd(end);
  return normalized ? `${normalized[0]}/${normalized[1]}` : '';
}

export function formatTotalBeats(beatEnds, beats, { verbose = true, beatEnabled = null } = {}) {
  const layout = beatLayout(beats, beatEnds, beatEnabled);
  if (!layout.shortened) return '';
  const [num, den] = layout.total;
  const whole = num / den;
  const rem = num % den;
  if (rem === 0n) return `${whole} ${whole === 1n ? 'beat' : 'beats'}`;
  const part = `${rem}/${den}`;
  if (whole === 0n) return verbose ? `${part} beat` : part;
  return verbose ? `${whole}+${part} beats` : `${whole}+${part}`;
}

// tempoBeat is the tempo reference in quarter-note lengths (1 = quarter,
// 1.5 = dotted quarter). Meter and tempo reference remain independent.
export function measureSeconds({ bpm, beats, unit, tempoBeat = 1, beatEnds = null, beatEnabled = null }) {
  const layout = beatLayout(beats, beatEnds, beatEnabled);
  if (!layout.shortened) return (60 / bpm) * (4 * beats / unit) / tempoBeat;
  return (60 / bpm) * (4 / unit) / tempoBeat * layout.totalFloat;
}

export function makeCycle([aCount, bCount]) {
  const events = new Map();
  for (const [lane, count] of [aCount, bCount].entries()) {
    for (let index = 0; index < count; index++) {
      const phase = index / count;
      if (!events.has(phase)) events.set(phase, { phase, hits: [] });
      events.get(phase).hits.push({ lane, index });
    }
  }
  return [...events.values()].sort((a, b) => a.phase - b.phase);
}

export function makeSubdivisionCycle(divisions) {
  let subdivision = 0;
  return divisions.flatMap((count, beat) => Array.from({ length: count }, (_, part) => ({
    phase: (beat * count + part) / (divisions.length * count),
    hits: [part === 0 ? { lane: 0, index: beat } : { lane: 1, index: subdivision++ }],
  })));
}

// Each lane can divide the whole bar, or repeat a count within each meter beat.
// Marker indices stay chronological across the lane, including mixed tuplets
// and beats extended past 1/1.
export function makeLanePulses(lane, beats, beatEnds = null) {
  if (lane.enabled === false) return [];
  if (lane.span === 'bar') {
    return Array.from({ length: lane.count }, (_, index) => ({
      phase: index / lane.count,
      index,
      beat: Math.floor(index * beats / lane.count),
      part: index,
    }));
  }
  const layout = beatEnds ? beatLayout(beats, beatEnds) : null;
  let index = 0;
  return Array.from({ length: beats }, (_, beat) => {
    const count = lane.beatCounts?.[beat] ?? lane.count;
    const end = layout?.ends[beat] ?? null;
    const partCount = count > 1 && end && end[0] > end[1]
      ? Math.floor((end[0] * count - 1) / end[1]) + 1
      : count;
    const start = lane.offbeatsOnly ? 1 : 0;
    return Array.from({ length: Math.max(0, partCount - start) }, (_, offset) => {
      const part = offset + start;
      const phase = layout?.visualExtended
        ? (layout.visualStarts[beat] + part / count) / layout.visualTotal
        : (beat * count + part) / (beats * count);
      return {
        phase,
        index: index++,
        beat,
        part,
      };
    });
  }).flat();
}

export function pulseBeatFraction(pulse, lane) {
  if (lane.span === 'bar') return null;
  const count = lane.beatCounts?.[pulse.beat] ?? lane.count;
  if (pulse.part === 0) return [0, 1];
  const divisor = gcd(pulse.part, count);
  return [pulse.part / divisor, count / divisor];
}

export function isPulseActiveInBeat(pulse, lane, beatEnds, beatEnabled = null) {
  if (lane.span === 'bar') return true;
  if (beatEnabled && beatEnabled[pulse.beat] === false) return false;
  const end = normalizeBeatEnd(beatEnds?.[pulse.beat]);
  if (!end) return true;
  const count = lane.beatCounts?.[pulse.beat] ?? lane.count;
  return pulse.part * end[1] < end[0] * count;
}

export function makeBeatSnapPoints(lanes, beats, beat, { maxBeats = 2 } = {}) {
  const seen = new Map();
  lanes.forEach((lane, index) => {
    if (index === 0 || lane.enabled === false || lane.span === 'bar') return;
    const count = lane.beatCounts?.[beat] ?? lane.count;
    if (count <= 1) return;
    const maxPart = count * maxBeats;
    for (let part = 1; part <= maxPart; part++) {
      const divisor = gcd(part, count);
      const num = part / divisor;
      const den = count / divisor;
      const key = `${num}/${den}`;
      if (!seen.has(key)) seen.set(key, { num, den, ratio: num / den });
    }
  });
  seen.set('1/1', { num: 1, den: 1, ratio: 1 });
  return [...seen.values()].sort((a, b) => compareFractions([a.num, a.den], [b.num, b.den]));
}

export function makeLaneCyclePhases(lane, beats, beatEnds = null, beatEnabled = null) {
  const layout = beatLayout(beats, beatEnds, beatEnabled);
  const active = [];
  for (const pulse of makeLanePulses({ ...lane, enabled: true }, beats, layout.ends)) {
    if (lane.span === 'bar') {
      active.push({ hit: pulse.index, phase: pulse.phase });
      continue;
    }
    if (!isPulseActiveInBeat(pulse, lane, layout.ends, layout.enabled)) continue;
    if (!layout.shortened) {
      active.push({ hit: pulse.index, phase: pulse.phase });
      continue;
    }
    const count = lane.beatCounts?.[pulse.beat] ?? lane.count;
    const timeInBeats = addBigFrac(layout.starts[pulse.beat], [BigInt(pulse.part), BigInt(count)]);
    const cycleFrac = divBigFrac(timeInBeats, layout.total);
    active.push({ hit: pulse.index, phase: Number(cycleFrac[0]) / Number(cycleFrac[1]) });
  }
  return active;
}

export function makeRhythmCycle(lanes, beats, beatEnds = null, beatEnabled = null) {
  const layout = beatLayout(beats, beatEnds, beatEnabled);
  const events = new Map();
  lanes.forEach((lane, laneIndex) => {
    for (const pulse of makeLanePulses(lane, beats, layout.ends)) {
      let key;
      let phase;
      if (lane.span === 'bar') {
        const divisor = gcd(pulse.index, lane.count);
        key = `${pulse.index / divisor}/${lane.count / divisor}`;
        phase = pulse.phase;
      } else {
        if (!isPulseActiveInBeat(pulse, lane, layout.ends, layout.enabled)) continue;
        const count = lane.beatCounts?.[pulse.beat] ?? lane.count;
        if (!layout.shortened) {
          const numerator = pulse.beat * count + pulse.part;
          const denominator = beats * count;
          const divisor = gcd(numerator, denominator);
          // Reduced fractions make coincident hits one event even across different
          // spans and tuplet counts; no floating-point tolerance merges nearby hits.
          key = `${numerator / divisor}/${denominator / divisor}`;
          phase = pulse.phase;
        } else {
          const timeInBeats = addBigFrac(layout.starts[pulse.beat], [BigInt(pulse.part), BigInt(count)]);
          const cycleFrac = divBigFrac(timeInBeats, layout.total);
          key = `${cycleFrac[0]}/${cycleFrac[1]}`;
          phase = Number(cycleFrac[0]) / Number(cycleFrac[1]);
        }
      }
      if (!events.has(key)) events.set(key, { phase, hits: [] });
      events.get(key).hits.push({ lane: laneIndex, index: pulse.index });
    }
  });
  return [...events.values()].sort((a, b) => a.phase - b.phase);
}

export function eventFrame(origin, measure, duration, phase) {
  return origin + Math.round((measure + phase) * duration);
}
