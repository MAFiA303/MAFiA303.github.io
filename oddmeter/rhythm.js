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

// tempoBeat is the tempo reference in quarter-note lengths (1 = quarter,
// 1.5 = dotted quarter). Meter and tempo reference remain independent.
export function measureSeconds({ bpm, beats, unit, tempoBeat = 1 }) {
  return (60 / bpm) * (4 * beats / unit) / tempoBeat;
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
// Marker indices stay chronological across the lane, including mixed tuplets.
export function makeLanePulses(lane, beats) {
  if (lane.enabled === false) return [];
  if (lane.span === 'bar') {
    return Array.from({ length: lane.count }, (_, index) => ({
      phase: index / lane.count,
      index,
      beat: Math.floor(index * beats / lane.count),
      part: index,
    }));
  }
  let index = 0;
  return Array.from({ length: beats }, (_, beat) => {
    const count = lane.beatCounts?.[beat] ?? lane.count;
    const start = lane.offbeatsOnly ? 1 : 0;
    return Array.from({ length: count - start }, (_, offset) => {
      const part = offset + start;
      return {
        phase: (beat * count + part) / (beats * count),
        index: index++,
        beat,
        part,
      };
    });
  }).flat();
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function makeRhythmCycle(lanes, beats) {
  const events = new Map();
  lanes.forEach((lane, laneIndex) => {
    for (const pulse of makeLanePulses(lane, beats)) {
      const count = lane.beatCounts?.[pulse.beat] ?? lane.count;
      const numerator = lane.span === 'bar' ? pulse.index : pulse.beat * count + pulse.part;
      const denominator = lane.span === 'bar' ? lane.count : beats * count;
      const divisor = gcd(numerator, denominator);
      // Reduced fractions make coincident hits one event even across different
      // spans and tuplet counts; no floating-point tolerance merges nearby hits.
      const key = `${numerator / divisor}/${denominator / divisor}`;
      if (!events.has(key)) events.set(key, { phase: pulse.phase, hits: [] });
      events.get(key).hits.push({ lane: laneIndex, index: pulse.index });
    }
  });
  return [...events.values()].sort((a, b) => a.phase - b.phase);
}

export function eventFrame(origin, measure, duration, phase) {
  return origin + Math.round((measure + phase) * duration);
}
