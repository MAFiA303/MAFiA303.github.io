import { beatUnits, clampInt, hasBeatSkip, limits, normalizeBeatEnabled, normalizeBeatEnd, normalizeBeatEnds, presets } from './rhythm.js?v=beats1';
import { tempoBeats, parseGrouping, readMarkerMemory } from './practice.js?v=beats1';
import { defaultSounds, soundOptions } from './sounds.js?v=audio1';

export const storageKey = 'oddmeter-settings-v1';
export const defaultVolume = 100;
export const setupLinkPrefix = '#setup=';
const starterSettings = {
  schemaVersion: 3,
  bpm: 70,
  beats: 3,
  unit: 4,
  sounds: ['click', 'hat', 'cowbell'],
  outputVolume: 160,
  lanes: [
    { accents: [0] },
    { count: 3, beatCounts: [null, 2, 2] },
    { count: 4, beatCounts: [null, 5, 5] },
  ],
};
const soundIds = new Set(soundOptions.map(([id]) => id));
const markerCapacity = 32 * 16;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};

function readMeter(value) {
  return {
    beats: clampInt(value?.beats, limits.meter, 4),
    unit: beatUnits.includes(value?.unit) ? value.unit : 4,
  };
}

function readIndices(list, count, fallback = []) {
  if (!Array.isArray(list)) return fallback;
  return [...new Set(list.filter((index) => Number.isInteger(index) && index >= 0 && index < count))];
}

function readMarkers(value, defaultAccents = [0]) {
  const accents = readIndices(value?.accents, markerCapacity, defaultAccents);
  const rests = readIndices(value?.rests, markerCapacity);
  const pulseSounds = Object.fromEntries(
    Object.entries(record(value?.pulseSounds)).filter(([index, sound]) => {
      if (!/^(0|[1-9]\d*)$/.test(index) || Number(index) >= markerCapacity) return false;
      if (sound === 'off') {
        if (!rests.includes(Number(index))) rests.push(Number(index));
        return false;
      }
      return soundIds.has(sound);
    }),
  );
  return { accents, rests, pulseSounds };
}

function readGrouping(value, beats) {
  return Array.isArray(value) && value.every(Number.isInteger)
    ? parseGrouping(value.join('+'), beats) ?? [beats] : [beats];
}

function readBeatCounts(value, range = limits.pulses) {
  return Array.from({ length: 32 }, (_, beat) => clampInt(value?.[beat], range, null));
}

function readLane(value, index, version = 3) {
  const beat = version === 3 && index === 0;
  return {
    count: beat ? 1 : clampInt(value?.count, limits.pulses, version === 3 ? 1 : index === 0 ? 1 : 2),
    span: beat ? 'beat' : value?.span === 'bar' ? 'bar' : 'beat',
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : version === 3 || index === 0,
    muted: index > 0 && value?.muted === true,
    offbeatsOnly: beat ? false : typeof value?.offbeatsOnly === 'boolean' ? value.offbeatsOnly : version === 3,
    beatCounts: beat ? readBeatCounts() : readBeatCounts(value?.beatCounts),
    ...readMarkers(value, version === 3 && index > 0 ? [] : [0]),
    ...(value?.markerMemory === undefined ? {} : { markerMemory: readMarkerMemory(value.markerMemory) }),
  };
}

function copyJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function legacyMarkers(value, lane, defaultAccents = [0]) {
  return readMarkers({ accents: value?.accents?.[lane], rests: value?.rests?.[lane], pulseSounds: value?.pulseSounds?.[lane] }, defaultAccents);
}

function migrateLegacy(saved) {
  const poly = record(saved.polyrhythm ?? saved);
  const standard = record(saved.standard ?? (saved.mode === 'standard' ? saved : undefined));
  const polyrhythm = saved.mode === 'polyrhythm' || (!saved.mode && Array.isArray(saved.pulses));
  const value = polyrhythm ? poly : standard;
  const meter = readMeter(value);
  const lanes = [0, 1].map((lane) => polyrhythm ? {
    count: clampInt(value.pulses?.[lane], limits.pulses, presets[0].pulses[lane]),
    span: 'bar', enabled: value.muted?.[lane] !== true, offbeatsOnly: false,
    beatCounts: readBeatCounts(), ...legacyMarkers(value, lane),
  } : {
    count: lane === 0 ? 1 : clampInt(value.subdivision, limits.subdivision, 1),
    span: 'beat', enabled: value.muted?.[lane] !== true, offbeatsOnly: lane === 1,
    beatCounts: lane === 0 ? readBeatCounts() : readBeatCounts(value.beatSubdivisions, limits.subdivision),
    ...legacyMarkers(value, lane, lane === 0 ? [0] : []),
  });
  const legacyProfiles = copyJson(record(saved.legacyProfiles)) ?? {};
  for (const key of ['standard', 'polyrhythm']) {
    if (saved[key] !== undefined) legacyProfiles[key] = copyJson(saved[key]);
  }
  if (Array.isArray(saved.pulses) && saved.polyrhythm === undefined) {
    legacyProfiles.polyrhythm = copyJson({
      beats: saved.beats, unit: saved.unit, pulses: saved.pulses,
      accents: saved.accents, rests: saved.rests, pulseSounds: saved.pulseSounds, muted: saved.muted,
    });
  }
  return {
    ...meter, grouping: readGrouping(value.grouping, meter.beats), legacyProfiles,
    lanes: polyrhythm ? [{ ...readLane(undefined, 0), enabled: false }, ...lanes] : [...lanes, readLane(undefined, 2)],
    soundOrder: polyrhythm ? [0, 0, 1] : [0, 1, 2],
  };
}

function migrateTwoLanes(saved) {
  const meter = readMeter(saved);
  const lanes = [0, 1].map((index) => readLane(saved.lanes?.[index], index, 2));
  const first = lanes[0];
  const hasBeat = first.count === 1 && first.span === 'beat' && !first.offbeatsOnly &&
    first.beatCounts.every((count) => count === null || count === 1);
  return {
    ...meter, grouping: readGrouping(saved.grouping, meter.beats),
    lanes: hasBeat ? [readLane(first, 0), lanes[1], readLane(undefined, 2)] :
      [{ ...readLane(undefined, 0), enabled: false }, ...lanes],
    soundOrder: hasBeat ? [0, 1, 2] : [0, 0, 1],
    previousSetup: copyJson(saved),
    ...(saved.legacyProfiles === undefined ? {} : { legacyProfiles: copyJson(record(saved.legacyProfiles)) }),
  };
}

function readBeatEnds(value, legacyBarEnd, beats) {
  const result = normalizeBeatEnds(value, 32);
  if (!Array.isArray(value)) {
    const legacy = normalizeBeatEnd(legacyBarEnd);
    if (legacy && legacy[0] * beats > (beats - 1) * legacy[1]) {
      result[beats - 1] = normalizeBeatEnd([legacy[0] * beats - (beats - 1) * legacy[1], legacy[1]]);
    }
  }
  return result;
}

function readBeatEnabled(value, beats) {
  const result = normalizeBeatEnabled(value, 32);
  if (beats > 0 && !result.slice(0, beats).some(Boolean)) result[0] = true;
  return result;
}

// Keep the existing key: the next save upgrades it in place to schema version 3.
export function readSettings(value) {
  const input = record(value);
  const saved = Object.keys(input).length ? input : starterSettings;
  const canonical = saved.schemaVersion === 3 || (saved.schemaVersion !== 2 && Array.isArray(saved.lanes) && saved.lanes.length === 3);
  const twoLanes = !canonical && (saved.schemaVersion === 2 || Array.isArray(saved.lanes));
  const legacy = !canonical && !twoLanes && (saved.mode === 'standard' || saved.mode === 'polyrhythm' ||
    saved.standard !== undefined || saved.polyrhythm !== undefined || Array.isArray(saved.pulses));
  const meter = readMeter(saved);
  const prepared = twoLanes ? migrateTwoLanes(saved) : legacy ? migrateLegacy(saved) : {
    ...meter,
    grouping: readGrouping(saved.grouping, meter.beats),
    lanes: [0, 1, 2].map((lane) => readLane(saved.lanes?.[lane], lane)),
    ...(saved.legacyProfiles === undefined ? {} : { legacyProfiles: copyJson(record(saved.legacyProfiles)) }),
    ...(saved.previousSetup === undefined ? {} : { previousSetup: copyJson(saved.previousSetup) }),
  };
  const { soundOrder = [0, 1, 2], ...rhythm } = prepared;
  const legacyVolume = Number.isFinite(saved.volume)
    ? clampInt(saved.volume, [0, 100], 100) * 1.6 : defaultVolume;
  return {
    schemaVersion: 3,
    bpm: clampInt(saved.bpm, limits.bpm, 120),
    tempoBeat: tempoBeats.some(([value]) => value === saved.tempoBeat) ? saved.tempoBeat : 1,
    ...rhythm,
    // Additive to schema 3: old saves retain their Off selections; temporary
    // subdivision mute is separate and defaults to false on every load path.
    lanes: rhythm.lanes.map((lane, index) => ({ ...lane, muted: index > 0 && lane.muted === true })),
    sounds: soundOrder.map((source, lane) => source === null ? defaultSounds[lane] :
      soundIds.has(saved.sounds?.[source]) ? saved.sounds[source] : defaultSounds[source]),
    outputVolume: clampInt(saved.outputVolume, [0, 200], legacyVolume),
    masterMuted: saved.masterMuted === true,
    countIn: saved.countIn === true,
    beatEnds: readBeatEnds(saved.beatEnds, saved.barEnd, rhythm.beats),
    beatEnabled: readBeatEnabled(saved.beatEnabled, rhythm.beats),
  };
}

export function makeSetupLink(base, settings) {
  const { schemaVersion, bpm, tempoBeat, beats, unit, grouping, sounds, outputVolume, masterMuted, countIn } = settings;
  const beatEnds = normalizeBeatEnds(settings.beatEnds, 32);
  const lastTrim = beatEnds.slice(0, beats).findLastIndex((value) => value !== null);
  const beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  const lastSkip = hasBeatSkip(beatEnabled, beats) ? beatEnabled.slice(0, beats).findLastIndex((value) => value === false) : -1;
  const snapshot = {
    schemaVersion, bpm, tempoBeat, beats, unit, grouping, sounds, outputVolume, masterMuted, countIn,
    ...(lastTrim >= 0 ? { beatEnds: beatEnds.slice(0, lastTrim + 1) } : {}),
    ...(lastSkip >= 0 ? { beatEnabled: beatEnabled.slice(0, lastSkip + 1) } : {}),
    lanes: settings.lanes.map(({ count, span, enabled, muted, offbeatsOnly, beatCounts, accents, rests, pulseSounds }) => ({
      count, span, enabled, muted, offbeatsOnly, accents, rests, pulseSounds,
      beatCounts: beatCounts.slice(0, beatCounts.findLastIndex((value) => value !== null) + 1),
    })),
  };
  const encoded = btoa(JSON.stringify(snapshot)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const url = new URL(base);
  url.search = '';
  url.hash = setupLinkPrefix + encoded;
  return url.href;
}

export function readSetupLink(hash) {
  if (!hash.startsWith(setupLinkPrefix) || hash.length > 65536) return null;
  const encoded = hash.slice(setupLinkPrefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const snapshot = JSON.parse(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')));
    if (snapshot?.schemaVersion !== 3 || !Array.isArray(snapshot.lanes) || snapshot.lanes.length !== 3 ||
        !snapshot.lanes.every((lane) => lane && record(lane) === lane)) return null;
    return readSettings(snapshot);
  } catch {
    return null;
  }
}
