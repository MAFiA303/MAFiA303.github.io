import { clampInt, limits, makeLanePulses, normalizeBeatEnabled, normalizeBeatEnd, normalizeBeatEnds } from './rhythm.js?v=extend1';
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
  if (!Number.isInteger(targetBeat) || targetBeat < 0 || targetBeat >= settings.beats) return false;
  if (!snapshot || !Array.isArray(snapshot.lanes) || snapshot.lanes.length !== settings.lanes.length) return false;
  const prevEnds = normalizeBeatEnds(settings.beatEnds, 32);
  settings.beatEnds = [...prevEnds];
  settings.beatEnds[targetBeat] = normalizeBeatEnd(snapshot.beatEnd);
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  if (includeEnabled) {
    settings.beatEnabled[targetBeat] = snapshot.enabled !== false;
    if (!settings.beatEnabled.slice(0, settings.beats).some(Boolean)) settings.beatEnabled[targetBeat] = true;
  }
  settings.lanes.forEach((lane, index) => {
    const source = snapshot.lanes[index];
    editLaneBeatColumns(lane, index, settings.beats, (columns) => {
      const count = index === 0 ? 1 : clampInt(source?.count, limits.pulses, lane.count);
      columns[targetBeat] = {
        count,
        explicit: index === 0 ? null : count,
        markers: cloneMarkerRecord(source?.markers),
      };
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
  if (settings.beats >= limits.meter[1]) return false;
  if (!Number.isInteger(atIndex) || atIndex < 0 || atIndex > settings.beats) return false;
  const nextBeats = settings.beats + 1;
  settings.beats = nextBeats;
  settings.grouping = [nextBeats];
  const prevEnds = normalizeBeatEnds(settings.beatEnds, 32);
  settings.beatEnds = [...prevEnds];
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  settings.beatEnds.splice(atIndex, 0, snapshot ? normalizeBeatEnd(snapshot.beatEnd) : null);
  settings.beatEnds.length = 32;
  settings.beatEnabled.splice(atIndex, 0, true);
  settings.beatEnabled.length = 32;
  settings.lanes.forEach((lane, index) => {
    const source = snapshot?.lanes?.[index];
    editLaneBeatColumns(lane, index, nextBeats, (columns) => {
      const count = index === 0 ? 1 : source ? clampInt(source.count, limits.pulses, lane.count) : lane.count;
      columns.splice(atIndex, 0, {
        count,
        explicit: index === 0 ? null : source ? count : null,
        markers: source ? cloneMarkerRecord(source.markers) : {},
      });
      columns.length = 32;
    }, prevEnds, settings.beatEnds);
  });
  return true;
}

export function deleteBeat(settings, beat) {
  if (settings.beats <= limits.meter[0]) return false;
  if (!Number.isInteger(beat) || beat < 0 || beat >= settings.beats) return false;
  const prevBeats = settings.beats;
  const nextBeats = prevBeats - 1;
  settings.beats = nextBeats;
  settings.grouping = [nextBeats];
  const prevEnds = normalizeBeatEnds(settings.beatEnds, 32);
  settings.beatEnds = [...prevEnds];
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  settings.beatEnds.splice(beat, 1);
  settings.beatEnds.splice(nextBeats, 0, null);
  settings.beatEnds.length = 32;
  settings.beatEnabled.splice(beat, 1);
  settings.beatEnabled.splice(nextBeats, 0, true);
  settings.beatEnabled.length = 32;
  if (!settings.beatEnabled.slice(0, nextBeats).some(Boolean)) settings.beatEnabled[0] = true;
  settings.lanes.forEach((lane, index) => {
    editLaneBeatColumns(lane, index, nextBeats, (columns) => {
      columns.splice(beat, 1);
      columns.splice(nextBeats, 0, { count: lane.count, explicit: null, markers: {} });
      columns.length = 32;
    }, prevEnds, settings.beatEnds);
  });
  return true;
}
