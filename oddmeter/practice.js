import { clampInt, limits, makeLanePulses, normalizeBeatEnabled, normalizeBeatEnd, normalizeBeatEnds, normalizeBeatRepeats, playbackSequence } from './rhythm.js?v=repeat1';
import { soundOptions } from './sounds.js?v=audio1';

// Tempo references are measured in quarter notes, independently of the meter.
export const tempoBeats = [
  [1, 'Quarter note'],
  [0.5, 'Eighth note'],
  [1.5, 'Dotted quarter'],
  [2, 'Half note'],
];

export const standardPresets = [
  { id: 'four-four', label: '4/4', beats: 4, unit: 4, groups: [4] },
  { id: 'three-four', label: '3/4', beats: 3, unit: 4, groups: [3] },
  { id: 'six-eight', label: '6/8', beats: 6, unit: 8, groups: [3, 3] },
  { id: 'five-eight', label: '5/8', beats: 5, unit: 8, groups: [3, 2] },
  { id: 'seven-eight', label: '7/8', beats: 7, unit: 8, groups: [2, 2, 3] },
  { id: 'nine-eight', label: '9/8', beats: 9, unit: 8, groups: [3, 3, 3] },
  { id: 'eleven-eight', label: '11/8', beats: 11, unit: 8, groups: [3, 3, 3, 2] },
];

const presetLane = (count, span = 'beat', enabled = true, offbeatsOnly = false, accents = [0]) =>
  ({ count, span, enabled, offbeatsOnly, accents });

export const rhythmPresets = [
  ...standardPresets.map((preset) => ({
    ...preset,
    lanes: [presetLane(1, 'beat', true, false, groupStarts(preset.groups)), presetLane(1, 'beat', true, true, []), presetLane(1, 'beat', true, true, [])],
  })),
  { id: 'eighths', label: 'Eighths', beats: 4, unit: 4, groups: [4],
    lanes: [presetLane(1), presetLane(2, 'beat', true, true, []), presetLane(1, 'beat', true, true, [])] },
  { id: 'triplets', label: 'Triplets', beats: 4, unit: 4, groups: [4],
    lanes: [presetLane(1), presetLane(3, 'beat', true, true, []), presetLane(1, 'beat', true, true, [])] },
  { id: 'three-four-bar', label: '3:4 per bar', beats: 4, unit: 4, groups: [4],
    lanes: [presetLane(1, 'beat', false), presetLane(3, 'bar'), presetLane(4, 'bar')] },
  { id: 'five-four-bar', label: '5:4 per bar', beats: 4, unit: 4, groups: [4],
    lanes: [presetLane(1, 'beat', false), presetLane(5, 'bar'), presetLane(4, 'bar')] },
  { id: 'seven-four-bar', label: '7:4 per bar', beats: 4, unit: 4, groups: [4],
    lanes: [presetLane(1, 'beat', false), presetLane(7, 'bar'), presetLane(4, 'bar')] },
  { id: 'three-four-beat', label: '3:4 per beat', beats: 4, unit: 4, groups: [4],
    lanes: [presetLane(1, 'beat', false), presetLane(3), presetLane(4)] },
];

export function parseGrouping(text, beats) {
  if (typeof text !== 'string' || !Number.isInteger(beats) || beats < 1) return null;
  if (!/^\s*[1-9]\d*\s*(?:\+\s*[1-9]\d*\s*)*$/.test(text)) return null;
  const groups = text.split('+').map(Number);
  if (groups.some((group) => group > 32)) return null;
  return groups.reduce((sum, group) => sum + group, 0) === beats ? groups : null;
}

// Quick grouping choices for odd and compound meters: every ordering of 2s and
// 3s that fills the bar, plus the whole bar and the current custom grouping.
export function groupingChoices(beats, current = [beats]) {
  const choices = [[beats]];
  const build = (left, prefix) => {
    if (left === 0) { choices.push(prefix); return; }
    for (const part of [2, 3]) if (part <= left) build(left - part, [...prefix, part]);
  };
  if (beats >= 5 && beats <= 13) build(beats, []);
  const key = current.join('+');
  if (!choices.some((choice) => choice.join('+') === key)) choices.push([...current]);
  return choices;
}

export function groupStarts(groups) {
  let index = 0;
  return groups.map((group) => {
    const start = index;
    index += group;
    return start;
  });
}

const validSounds = new Set(soundOptions.map(([id]) => id));
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const validIndex = (key, max) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < max;

function readMarkerState(value) {
  const source = object(value);
  const state = { accented: source.accented === true, rest: source.rest === true };
  if (validSounds.has(source.sound)) state.sound = source.sound;
  return state.accented || state.rest || state.sound ? state : null;
}

// Semantic positions retain edits when a tuplet part is temporarily hidden.
// Unmapped indices preserve dormant settings from older, flat marker arrays.
export function readMarkerMemory(value) {
  const source = object(value);
  const read = (entries, validKey) => Object.fromEntries(Object.entries(object(entries)).flatMap(([key, value]) => {
    const state = readMarkerState(value);
    return validKey(key) && state ? [[key, state]] : [];
  }));
  const beat = read(source.beat, (key) => {
    const parts = key.split(':');
    return parts.length === 2 && validIndex(parts[0], 32) && validIndex(parts[1], 32);
  });
  const bar = read(source.bar, (key) => validIndex(key, 16));
  const unmapped = {
    beat: read(source.unmapped?.beat, (key) => validIndex(key, 1024)),
    bar: read(source.unmapped?.bar, (key) => validIndex(key, 1024)),
  };
  const seen = Object.fromEntries(['beat', 'bar'].map((span) => [span,
    source.seen?.[span] === true || Object.keys(span === 'beat' ? beat : bar).length > 0 || Object.keys(unmapped[span]).length > 0,
  ]));
  return { beat, bar, unmapped, seen };
}

const spanOf = (lane) => lane.span === 'bar' ? 'bar' : 'beat';
const markerKey = (span, pulse) => span === 'bar' ? String(pulse.index) : `${pulse.beat}:${pulse.part}`;

function flatMarkerMap(lane) {
  const flat = new Map();
  const indices = new Set([...lane.accents, ...lane.rests, ...Object.keys(lane.pulseSounds).map(Number)]);
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= 1024) continue;
    const state = readMarkerState({ accented: lane.accents.includes(index), rest: lane.rests.includes(index), sound: lane.pulseSounds[index] });
    if (state) flat.set(index, state);
  }
  return flat;
}

function flushLaneMarkers(lane, beatEnds = null) {
  const memory = readMarkerMemory(lane.markerMemory);
  const previousSpan = spanOf(lane);
  const before = makeLanePulses({ ...lane, enabled: true }, 32, beatEnds);
  const flat = flatMarkerMap(lane);
  const available = new Set(before.map(({ index }) => index));
  for (const pulse of before) {
    const key = markerKey(previousSpan, pulse);
    const state = flat.get(pulse.index);
    if (state) memory[previousSpan][key] = state;
    else delete memory[previousSpan][key];
  }
  memory.unmapped[previousSpan] = Object.fromEntries([...flat].filter(([index]) => !available.has(index)));
  memory.seen[previousSpan] = true;
  return { memory, flat, previousSpan };
}

function rebuildLaneMarkers(lane, memory, flat = null, beatEnds = null) {
  const span = spanOf(lane);
  const after = makeLanePulses({ ...lane, enabled: true }, 32, beatEnds);
  const byIndex = new Map(after.map((pulse) => [pulse.index, pulse]));
  if (flat && !memory.seen[span]) {
    for (const [index, state] of flat) {
      const pulse = byIndex.get(index);
      if (pulse) memory[span][markerKey(span, pulse)] = { ...state };
      else memory.unmapped[span][index] = { ...state };
    }
    memory.seen[span] = true;
  }
  const result = new Map();
  for (const pulse of after) {
    const key = markerKey(span, pulse);
    const unknown = memory.unmapped[span][pulse.index];
    if (unknown) {
      memory[span][key] ??= unknown;
      delete memory.unmapped[span][pulse.index];
    }
    const state = memory[span][key];
    if (state) result.set(pulse.index, state);
  }
  for (const [index, state] of Object.entries(memory.unmapped[span])) result.set(Number(index), state);
  const ordered = [...result].sort(([a], [b]) => a - b);
  lane.accents = ordered.filter(([, state]) => state.accented).map(([index]) => index);
  lane.rests = ordered.filter(([, state]) => state.rest).map(([index]) => index);
  lane.pulseSounds = Object.fromEntries(ordered.filter(([, state]) => state.sound).map(([index, state]) => [index, state.sound]));
  lane.markerMemory = memory;
  return lane;
}

// Mutates a validated lane. The callback edits count, span, beatCounts, or
// offbeatsOnly; visible marker edits must remain in the lane's flat arrays.
export function editRhythmLane(lane, change, beatEnds = null, nextBeatEnds = beatEnds) {
  const { memory, flat } = flushLaneMarkers(lane, beatEnds);
  change(lane);
  return rebuildLaneMarkers(lane, memory, flat, nextBeatEnds);
}

function cloneMarkerRecord(markers) {
  const copy = {};
  for (const [part, state] of Object.entries(object(markers))) {
    if (!validIndex(part, 32)) continue;
    const cleaned = readMarkerState(state);
    if (cleaned) copy[part] = cleaned;
  }
  return copy;
}

function editLaneBeatColumns(lane, laneIndex, nextBeats, transform, prevBeatEnds = null, nextBeatEnds = prevBeatEnds) {
  const { memory } = flushLaneMarkers(lane, prevBeatEnds);
  const columns = Array.from({ length: 32 }, (_, beat) => {
    const markers = {};
    for (let part = 0; part < 32; part++) {
      const state = memory.beat[`${beat}:${part}`];
      if (state) markers[part] = { ...state };
    }
    return {
      count: laneIndex === 0 ? 1 : (lane.beatCounts[beat] ?? lane.count),
      explicit: laneIndex === 0 ? null : lane.beatCounts[beat],
      markers,
    };
  });
  transform(columns);
  if (laneIndex > 0) {
    const visible = columns.slice(0, nextBeats).map((col) => clampInt(col.count, limits.pulses, lane.count));
    if (visible.length > 0 && visible.every((count) => count === visible[0])) {
      lane.count = visible[0];
      for (let beat = 0; beat < nextBeats; beat++) lane.beatCounts[beat] = null;
      for (let beat = nextBeats; beat < 32; beat++) {
        lane.beatCounts[beat] = columns[beat].explicit === lane.count ? null : columns[beat].explicit;
      }
    } else {
      for (let beat = 0; beat < nextBeats; beat++) {
        lane.beatCounts[beat] = visible[beat] === lane.count ? null : visible[beat];
      }
      for (let beat = nextBeats; beat < 32; beat++) lane.beatCounts[beat] = columns[beat].explicit;
    }
  }
  const nextBeatMem = {};
  for (let beat = 0; beat < 32; beat++) {
    for (const [part, state] of Object.entries(columns[beat].markers)) {
      const cleaned = readMarkerState(state);
      if (cleaned) nextBeatMem[`${beat}:${part}`] = cleaned;
    }
  }
  memory.beat = nextBeatMem;
  if (Object.keys(nextBeatMem).length > 0) memory.seen.beat = true;
  if (spanOf(lane) === 'beat') rebuildLaneMarkers(lane, memory, null, nextBeatEnds);
  else lane.markerMemory = memory;
}

export function snapshotBeat(settings, beat) {
  if (!Number.isInteger(beat) || beat < 0 || beat >= 32) return null;
  const ends = normalizeBeatEnds(settings.beatEnds, 32);
  return {
    sourceBeat: beat,
    enabled: settings.beatEnabled?.[beat] !== false,
    beatEnd: normalizeBeatEnd(ends[beat]),
    lanes: settings.lanes.map((lane, index) => {
      const { memory } = flushLaneMarkers(lane, ends);
      const markers = {};
      for (let part = 0; part < 32; part++) {
        const state = memory.beat[`${beat}:${part}`];
        if (state) markers[part] = { ...state };
      }
      return {
        count: index === 0 ? 1 : (lane.beatCounts?.[beat] ?? lane.count),
        markers,
      };
    }),
  };
}

export function pasteBeat(settings, targetBeat, snapshot, { includeEnabled = false } = {}) {
  return pasteBeats(settings, targetBeat, snapshot ? [snapshot] : [], { includeEnabled });
}

export function pasteBeats(settings, startBeat, snapshots, { includeEnabled = false } = {}) {
  if (!Number.isInteger(startBeat) || startBeat < 0 || startBeat >= settings.beats) return false;
  if (!Array.isArray(snapshots) || snapshots.length === 0) return false;
  const usable = snapshots.slice(0, settings.beats - startBeat);
  if (!usable.every((snap) => snap && Array.isArray(snap.lanes) && snap.lanes.length === settings.lanes.length)) return false;
  const prevEnds = normalizeBeatEnds(settings.beatEnds, 32);
  settings.beatEnds = [...prevEnds];
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  usable.forEach((snap, offset) => {
    const target = startBeat + offset;
    settings.beatEnds[target] = normalizeBeatEnd(snap.beatEnd);
    if (includeEnabled) settings.beatEnabled[target] = snap.enabled !== false;
  });
  if (includeEnabled && !settings.beatEnabled.slice(0, settings.beats).some(Boolean)) {
    settings.beatEnabled[startBeat] = true;
  }
  settings.lanes.forEach((lane, index) => {
    editLaneBeatColumns(lane, index, settings.beats, (columns) => {
      usable.forEach((snap, offset) => {
        const source = snap.lanes[index];
        const count = index === 0 ? 1 : clampInt(source?.count, limits.pulses, lane.count);
        columns[startBeat + offset] = {
          count,
          explicit: index === 0 ? null : count,
          markers: cloneMarkerRecord(source?.markers),
        };
      });
    }, prevEnds, settings.beatEnds);
  });
  return true;
}

function moveInRange(list, from, to) {
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

export function moveBeat(settings, fromBeat, toBeat) {
  if (!Number.isInteger(fromBeat) || !Number.isInteger(toBeat)) return false;
  if (fromBeat < 0 || fromBeat >= settings.beats || toBeat < 0 || toBeat >= settings.beats || fromBeat === toBeat) return false;
  const prevEnds = normalizeBeatEnds(settings.beatEnds, 32);
  settings.beatEnds = [...prevEnds];
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  moveInRange(settings.beatEnds, fromBeat, toBeat);
  moveInRange(settings.beatEnabled, fromBeat, toBeat);
  settings.lanes.forEach((lane, index) => {
    editLaneBeatColumns(lane, index, settings.beats, (columns) => {
      moveInRange(columns, fromBeat, toBeat);
    }, prevEnds, settings.beatEnds);
  });
  return true;
}

export function insertBeat(settings, atIndex, snapshot = null) {
  return insertBeats(settings, atIndex, [snapshot]);
}

export function insertBeats(settings, atIndex, snapshots = [null]) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return false;
  if (settings.beats + snapshots.length > limits.meter[1]) return false;
  if (!Number.isInteger(atIndex) || atIndex < 0 || atIndex > settings.beats) return false;
  const countToAdd = snapshots.length;
  const nextBeats = settings.beats + countToAdd;
  settings.beats = nextBeats;
  settings.grouping = [nextBeats];
  const prevEnds = normalizeBeatEnds(settings.beatEnds, 32);
  settings.beatEnds = [...prevEnds];
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  settings.beatEnds.splice(atIndex, 0, ...snapshots.map((snap) => (snap ? normalizeBeatEnd(snap.beatEnd) : null)));
  settings.beatEnds.length = 32;
  settings.beatEnabled.splice(atIndex, 0, ...snapshots.map((snap) => (snap ? snap.enabled !== false : true)));
  settings.beatEnabled.length = 32;
  if (!settings.beatEnabled.slice(0, nextBeats).some(Boolean)) settings.beatEnabled[atIndex] = true;
  if (Array.isArray(settings.beatRepeats)) {
    settings.beatRepeats = normalizeBeatRepeats(settings.beatRepeats.map((rep) => {
      if (atIndex <= rep.start) return { ...rep, start: rep.start + countToAdd, end: rep.end + countToAdd };
      if (atIndex <= rep.end) return { ...rep, end: rep.end + countToAdd };
      return rep;
    }), nextBeats);
  }
  settings.lanes.forEach((lane, index) => {
    editLaneBeatColumns(lane, index, nextBeats, (columns) => {
      const inserted = snapshots.map((snap) => {
        const source = snap?.lanes?.[index];
        const count = index === 0 ? 1 : source ? clampInt(source.count, limits.pulses, lane.count) : lane.count;
        return {
          count,
          explicit: index === 0 ? null : source ? count : null,
          markers: source ? cloneMarkerRecord(source.markers) : {},
        };
      });
      columns.splice(atIndex, 0, ...inserted);
      columns.length = 32;
    }, prevEnds, settings.beatEnds);
  });
  return true;
}

export function deleteBeats(settings, beats) {
  if (!Array.isArray(beats) || beats.length === 0) return false;
  const prevBeats = settings.beats;
  if (!beats.every((beat) => Number.isInteger(beat) && beat >= 0 && beat < prevBeats)) return false;
  const unique = [...new Set(beats)].sort((a, b) => a - b);
  const nextBeats = prevBeats - unique.length;
  if (nextBeats < limits.meter[0]) return false;
  const delSet = new Set(unique);
  settings.beats = nextBeats;
  settings.grouping = [nextBeats];
  const prevEnds = normalizeBeatEnds(settings.beatEnds, 32);
  const prevEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  const nextEnds = [];
  const nextEnabled = [];
  for (let beat = 0; beat < prevBeats; beat++) {
    if (!delSet.has(beat)) {
      nextEnds.push(prevEnds[beat]);
      nextEnabled.push(prevEnabled[beat]);
    }
  }
  while (nextEnds.length < prevBeats) {
    nextEnds.push(null);
    nextEnabled.push(true);
  }
  settings.beatEnds = [...nextEnds, ...prevEnds.slice(prevBeats, 32)].slice(0, 32);
  settings.beatEnabled = [...nextEnabled, ...prevEnabled.slice(prevBeats, 32)].slice(0, 32);
  if (!settings.beatEnabled.slice(0, nextBeats).some(Boolean)) settings.beatEnabled[0] = true;
  if (Array.isArray(settings.beatRepeats)) {
    const remap = new Map();
    let mapped = 0;
    for (let beat = 0; beat < prevBeats; beat++) {
      if (!delSet.has(beat)) remap.set(beat, mapped++);
    }
    settings.beatRepeats = normalizeBeatRepeats(settings.beatRepeats.flatMap((rep) => {
      let start = -1;
      let end = -1;
      const from = Math.max(0, rep.start);
      const to = Math.min(prevBeats - 1, rep.end);
      for (let beat = from; beat <= to; beat++) {
        if (!remap.has(beat)) continue;
        const idx = remap.get(beat);
        if (start < 0) start = idx;
        end = idx;
      }
      return start >= 0 ? [{ ...rep, start, end }] : [];
    }), nextBeats);
  }
  settings.lanes.forEach((lane, index) => {
    editLaneBeatColumns(lane, index, nextBeats, (columns) => {
      const kept = [];
      for (let beat = 0; beat < prevBeats; beat++) {
        if (!delSet.has(beat)) kept.push(columns[beat]);
      }
      while (kept.length < prevBeats) kept.push({ count: lane.count, explicit: null, markers: {} });
      const dormant = columns.slice(prevBeats, 32);
      columns.splice(0, columns.length, ...kept, ...dormant);
      columns.length = 32;
    }, prevEnds, settings.beatEnds);
  });
  return true;
}

export function deleteBeat(settings, beat) {
  return deleteBeats(settings, [beat]);
}

// Quad Cortex Tempo + Looper X (CorOS 3.2+) translation helper.
// Uses exact BigInt rational cycle duration from playbackSequence() so exact
// 0-drift matches are mathematically guaranteed without floating-point error.
export const qcStorageKey = 'oddmeter-qc-v1';
export const QC_LIMITS = {
  bpm: [40, 240],
  bars: [1, 32],
  cycles: [1, 16],
  maxSeconds: 284, // Looper X max recording time: 4m 44s
  barBeats: [4, 3, 2, 5, 6, 7, 1],
};

function gcdBig(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function reduceBig(num, den) {
  if (num === 0n) return [0n, 1n];
  const d = gcdBig(num, den);
  return [num / d, den / d];
}

export function formatLoopDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0.00s';
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const rem = seconds - mins * 60;
    const remText = rem < 10 ? `0${rem.toFixed(1)}` : rem.toFixed(1);
    return `${mins}m ${remText}s`;
  }
  return seconds >= 10 ? `${seconds.toFixed(2)}s` : `${seconds.toFixed(2)}s`;
}

function scoreQcOption(opt, ctx) {
  const meterPenalty = { 4: 0, 3: 4, 2: 8, 5: 14, 6: 16, 7: 18, 1: 58 }[opt.beatsPerBar] ?? 30;
  let score = meterPenalty + opt.bars * 2.5;
  const matchesQuarter = Math.abs(opt.bpm - ctx.oddQuarterBpm) < 1e-9;
  const matchesDisplay = opt.bpm === ctx.displayBpm;
  const matchesUnit = ctx.unit === 8 && Math.abs(opt.bpm - ctx.oddUnitBpm) < 1e-9;

  if (ctx.tempoBeat !== 1 && matchesDisplay) {
    score -= 125;
  } else if (matchesQuarter) {
    score -= 120;
  } else if (matchesUnit) {
    score -= 108;
  } else if (matchesDisplay) {
    score -= 100;
  } else if (
    Math.abs(opt.bpm - ctx.oddQuarterBpm * 2) < 1e-9 ||
    Math.abs(opt.bpm * 2 - ctx.oddQuarterBpm) < 1e-9
  ) {
    score -= 48;
  } else {
    const refBpm = ctx.tempoBeat !== 1 ? ctx.displayBpm : ctx.oddQuarterBpm;
    score += Math.abs(Math.log2(opt.bpm / Math.max(1, refBpm))) * 26;
    if (opt.bpm < 55 || opt.bpm > 195) score += 16;
  }

  // Reward keeping the user's native bar feel (e.g. 3/4 -> 3/4, 7/8 -> 7/4 at 2x BPM).
  if (ctx.preferredMeter && opt.beatsPerBar === ctx.preferredMeter && (matchesQuarter || matchesUnit || matchesDisplay)) {
    score -= 54;
  }
  // Gently prefer clean divisors on re-scaled tempos to minimize hardware rounding.
  if (60 % opt.bpm === 0 || opt.bpm % 10 === 0) score -= 1.2;
  else if (opt.bpm % 5 === 0 || opt.bpm % 4 === 0) score -= 0.6;
  return score;
}

function searchQcOptions({ qNum, qDen, bNum, bDen, cycles, targetSeconds, ctx }) {
  const mBig = BigInt(cycles);
  const den = mBig * qNum * bDen;
  const exact = [];
  let bestApprox = null;
  let bestApproxScore = Infinity;

  for (const beatsPerBar of QC_LIMITS.barBeats) {
    for (let bars = QC_LIMITS.bars[0]; bars <= QC_LIMITS.bars[1]; bars++) {
      const totalBeats = beatsPerBar * bars;
      const num = BigInt(totalBeats) * bNum * qDen;
      if (num % den === 0n) {
        const bpm = Number(num / den);
        if (bpm >= QC_LIMITS.bpm[0] && bpm <= QC_LIMITS.bpm[1]) {
          const opt = {
            key: `${bpm}:${beatsPerBar}:${bars}`,
            bpm,
            beatsPerBar,
            timeSig: `${beatsPerBar}/4`,
            bars,
            quantize: beatsPerBar,
            totalBeats,
            seconds: (totalBeats * 60) / bpm,
            driftMs: 0,
            exact: true,
          };
          opt.score = scoreQcOption(opt, ctx);
          exact.push(opt);
          continue;
        }
      }
      if (exact.length > 0) continue;
      const ideal = Number(num) / Number(den);
      const candidates = new Set([
        clampInt(Math.floor(ideal), QC_LIMITS.bpm, QC_LIMITS.bpm[0]),
        clampInt(Math.ceil(ideal), QC_LIMITS.bpm, QC_LIMITS.bpm[0]),
      ]);
      for (const bpm of candidates) {
        const seconds = (totalBeats * 60) / bpm;
        const driftMs = (seconds - targetSeconds) * 1000;
        const absDrift = Math.abs(driftMs);
        const opt = {
          key: `${bpm}:${beatsPerBar}:${bars}`,
          bpm,
          beatsPerBar,
          timeSig: `${beatsPerBar}/4`,
          bars,
          quantize: beatsPerBar,
          totalBeats,
          seconds,
          driftMs,
          exact: false,
        };
        // Prioritize minimal drift first, then musical simplicity on close ties (< 1 ms).
        const approxScore = absDrift * 100 + scoreQcOption(opt, ctx) * 0.08;
        if (approxScore < bestApproxScore) {
          bestApproxScore = approxScore;
          bestApprox = opt;
        }
      }
    }
  }

  exact.sort((a, b) => a.score - b.score || a.bars - b.bars || a.bpm - b.bpm);
  return { exact, bestApprox };
}

function pickAlternatives(exactList, best) {
  if (!best || exactList.length <= 1) return [];
  const alts = [];
  const seenSig = new Set([best.timeSig]);
  const seenBpm = new Set([best.bpm]);
  for (const item of exactList) {
    if (item.key === best.key) continue;
    // Skip trivial 1/4 alternatives when cleaner meters already work, unless nothing else exists.
    if (item.beatsPerBar === 1 && best.beatsPerBar !== 1) continue;
    // Prefer meaningfully distinct alternatives (different meter or distinct tempo feel).
    if (!seenSig.has(item.timeSig) || (!seenBpm.has(item.bpm) && item.bars <= 16)) {
      alts.push(item);
      seenSig.add(item.timeSig);
      seenBpm.add(item.bpm);
      if (alts.length >= 2) break;
    }
  }
  return alts;
}

export function computeQuadCortexPlan(settings, { cycles = 1 } = {}) {
  const safeCycles = clampInt(cycles, QC_LIMITS.cycles, 1);
  const bpm = clampInt(settings?.bpm, limits.bpm, 70);
  const beats = clampInt(settings?.beats, limits.meter, 4);
  const unit = [2, 4, 8, 16].includes(settings?.unit) ? settings.unit : 4;
  const tempoBeat = [0.5, 1, 1.5, 2].includes(settings?.tempoBeat) ? settings.tempoBeat : 1;

  const seq = playbackSequence(beats, settings?.beatEnds ?? null, settings?.beatEnabled ?? null, settings?.beatRepeats ?? null);
  const [qNum, qDen] = reduceBig(seq.total[0] * 4n, seq.total[1] * BigInt(unit));
  const [tbNum, tbDen] = reduceBig(BigInt(Math.round(tempoBeat * 2)), 2n);
  const [bNum, bDen] = reduceBig(BigInt(bpm) * tbNum, tbDen);

  const oddQuarterBpm = Number(bNum) / Number(bDen);
  const oddUnitBpm = oddQuarterBpm * (unit / 4);
  const cycleSeconds = (60 * Number(qNum) * Number(bDen)) / (Number(qDen) * Number(bNum));
  const targetSeconds = cycleSeconds * safeCycles;
  const overMax = targetSeconds > QC_LIMITS.maxSeconds;
  const plainUnshortened = !seq.hasRepeats && !seq.layout.shortened;
  const preferredMeter = plainUnshortened && beats <= 7 ? beats : 0;

  const ctx = { oddQuarterBpm, oddUnitBpm, displayBpm: bpm, unit, tempoBeat, preferredMeter };
  const { exact, bestApprox } = searchQcOptions({ qNum, qDen, bNum, bDen, cycles: safeCycles, targetSeconds, ctx });

  const best = exact[0] ?? bestApprox;
  const alternatives = exact.length > 1 ? pickAlternatives(exact, best) : [];

  let exactCyclesOption = null;
  let exactBpmNudge = null;
  if (!best?.exact) {
    for (const altCycles of [2, 3, 4]) {
      if (altCycles === safeCycles || cycleSeconds * altCycles > QC_LIMITS.maxSeconds) continue;
      const alt = searchQcOptions({ qNum, qDen, bNum, bDen, cycles: altCycles, targetSeconds: cycleSeconds * altCycles, ctx });
      if (alt.exact.length > 0) {
        exactCyclesOption = { cycles: altCycles, option: alt.exact[0] };
        break;
      }
    }
    for (const delta of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
      const nudgedBpm = bpm + delta;
      if (nudgedBpm < limits.bpm[0] || nudgedBpm > limits.bpm[1]) continue;
      const [nbNum, nbDen] = reduceBig(BigInt(nudgedBpm) * tbNum, tbDen);
      const nQuarterBpm = Number(nbNum) / Number(nbDen);
      const nTarget = (60 * Number(qNum) * Number(nbDen) * safeCycles) / (Number(qDen) * Number(nbNum));
      if (nTarget > QC_LIMITS.maxSeconds) continue;
      const alt = searchQcOptions({
        qNum,
        qDen,
        bNum: nbNum,
        bDen: nbDen,
        cycles: safeCycles,
        targetSeconds: nTarget,
        ctx: { ...ctx, oddQuarterBpm: nQuarterBpm, oddUnitBpm: nQuarterBpm * (unit / 4), displayBpm: nudgedBpm },
      });
      if (alt.exact.length > 0) {
        exactBpmNudge = { oddBpm: nudgedBpm, delta, option: alt.exact[0] };
        break;
      }
    }
  }

  return {
    cycles: safeCycles,
    cycleSeconds,
    targetSeconds,
    overMax,
    exact: Boolean(best?.exact),
    best,
    alternatives,
    exactCyclesOption,
    exactBpmNudge,
  };
}
