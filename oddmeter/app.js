import { beatUnits, clampInt, limits, makeLanePulses, measureSeconds, subdivisionName } from './rhythm.js';
import { pulseSoundOptions, soundOptions } from './sounds.js';
import { tempoBeats, rhythmPresets, parseGrouping, groupStarts, editRhythmLane } from './practice.js';
import { readSettings, storageKey, defaultVolume, setupLinkPrefix, makeSetupLink, readSetupLink } from './settings.js';

const byId = (id) => document.getElementById(id);
const ui = {
  console: document.querySelector('.console'),
  rhythmPanel: document.querySelector('.rhythm-panel'),
  preset: byId('preset'), status: byId('status'), statusText: byId('status-text'), position: byId('position'),
  bpm: byId('bpm'), tempoBeat: byId('tempo-beat'), tempoRange: byId('tempo-range'),
  tempoDown: byId('tempo-down'), tempoUp: byId('tempo-up'), tap: byId('tap'),
  beats: byId('meter-beats'), unit: byId('meter-unit'), ruler: byId('ruler'),
  grouping: byId('grouping'), groupingHelp: byId('grouping-help'), groupingError: byId('grouping-error'), applyGrouping: byId('apply-grouping'),
  pulseHint: byId('pulse-hint'), pulseFeedback: byId('pulse-feedback'), editSounds: byId('edit-sounds'),
  more: document.querySelector('.advanced-settings'),
  pulseEditor: byId('pulse-editor'), pulseEditorLabel: byId('pulse-editor-label'), pulseSound: byId('pulse-sound'), closeEditor: byId('close-editor'),
  duration: byId('cycle-length'), play: byId('play'), playLabel: byId('play-label'), countIn: byId('count-in'),
  muteAll: byId('mute-all'), volume: byId('volume'), volumeValue: byId('volume-value'), message: byId('message'),
  share: byId('share'), shareFeedback: byId('share-feedback'), shareDialog: byId('share-dialog'), shareLink: byId('share-link'),
  scrolls: [...document.querySelectorAll('[data-timeline-scroll]')],
};
const laneNames = ['Beat', 'Subdivision 1', 'Subdivision 2'];
const lanes = [...document.querySelectorAll('.lane')].map((element, index) => {
  const options = index === 0 ? null : byId(`subdiv-${index}-options`);
  return {
    element, enabled: element.querySelector('.lane-enabled'), count: element.querySelector('.lane-count'),
    steps: [...element.querySelectorAll('[data-delta]')], span: options?.querySelector('.lane-span'), sound: byId(['sound-a', 'sound-b', 'sound-c'][index]),
    summary: element.querySelector('.lane-summary'), options,
    offbeats: options?.querySelector('.offbeats-only'), beatCounts: element.querySelector('.beat-counts'), reset: options?.querySelector('.reset-counts'),
    guides: element.querySelector('.guides'), buttons: element.querySelector('.pulse-buttons'),
    pulses: [], onsets: [], lit: null,
  };
});
const soundNames = new Map(pulseSoundOptions);
const unitNames = { 2: 'half note', 4: 'quarter note', 8: 'eighth note', 16: 'sixteenth note' };
let saved;
try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { /* Storage is optional. */ }
const setupHash = window.location.hash.startsWith(setupLinkPrefix);
const shared = readSetupLink(window.location.hash);
const settings = shared ?? readSettings(saved);

function save() {
  if (shared) return;
  try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Playback works without storage. */ }
}

let shareFeedbackTimer;
ui.share.addEventListener('click', async () => {
  const link = makeSetupLink(window.location.href, settings);
  try {
    await window.navigator.clipboard.writeText(link);
    ui.share.textContent = 'Copied';
    ui.shareFeedback.textContent = 'Setup link copied.';
    clearTimeout(shareFeedbackTimer);
    shareFeedbackTimer = window.setTimeout(() => {
      ui.share.textContent = 'Share';
      ui.shareFeedback.textContent = '';
    }, 1600);
  } catch {
    ui.shareLink.value = link;
    if (!ui.shareDialog.open) ui.shareDialog.showModal();
    ui.shareLink.focus();
    ui.shareLink.select();
  }
});
window.addEventListener('hashchange', () => {
  if (setupHash || window.location.hash.startsWith(setupLinkPrefix)) window.location.reload();
});

let context;
let processor;
let master;
let loadingAudio;
let starting = false;
let startId = 0;
let playing = false;
let editSounds = false;
let selectedPulse = null;
let previewId = 0;
let clock = null;
let timingId = 0;
let animationFrame = 0;
let taps = [];
let tapFlash;

function showMessage(message = '') {
  ui.message.textContent = message;
  ui.message.hidden = message === '';
}
function status(text, active = false) {
  if (ui.statusText.textContent !== text) ui.statusText.textContent = text;
  ui.status.toggleAttribute('data-active', active);
}
function mixSettings() {
  return {
    sounds: settings.sounds,
    muted: settings.lanes.map(laneMuted),
    accents: settings.lanes.map((lane) => lane.accents),
    pulseSounds: settings.lanes.map((lane) => ({ ...lane.pulseSounds, ...Object.fromEntries(lane.rests.map((index) => [index, 'off'])) })),
  };
}
function laneMuted(lane) { return !lane.enabled || lane.muted === true; }
function timingSettings() {
  const { bpm, tempoBeat, beats, unit } = settings;
  // Beat mute is a mix decision. Keep its events in the clock even when a
  // saved setup starts muted, so Unmute works without rebuilding the clock.
  return { bpm, tempoBeat, beats, unit, lanes: settings.lanes.map(({ count, span, enabled, beatCounts, offbeatsOnly }, index) =>
    ({ count, span, enabled: index === 0 || enabled, beatCounts, offbeatsOnly })) };
}
function sendTiming(countIn = false, restart = false) {
  if (countIn || restart) { clock = null; clearPlayhead(); }
  processor.port.postMessage({ type: 'timing', id: ++timingId, settings: timingSettings(), countIn, restart, mix: mixSettings() });
}

async function prepareAudio(retries = 2) {
  const Audio = window.AudioContext ?? window.webkitAudioContext;
  if (!Audio) throw new Error('Web Audio is unavailable.');
  if (!context || context.state === 'closed') {
    context = new Audio({ latencyHint: 'interactive' });
    processor = null;
    master = null;
    loadingAudio = null;
  }
  const audio = context;
  if (!audio.audioWorklet) throw new Error('AudioWorklet requires localhost or HTTPS.');

  const resumed = audio.resume();
  if (!processor && !loadingAudio) {
    const initializing = connectAudio(audio).finally(() => {
      if (loadingAudio === initializing) loadingAudio = null;
    });
    loadingAudio = initializing;
  }
  try {
    await Promise.all([resumed, loadingAudio]);
  } catch (error) {
    if (retries > 0 && (context !== audio || audio.state === 'closed')) return prepareAudio(retries - 1);
    throw error;
  }
  if (context !== audio || audio.state === 'closed') {
    if (retries > 0) return prepareAudio(retries - 1);
    throw new Error('The audio engine closed while starting.');
  }
}

async function connectAudio(audio) {
  await audio.audioWorklet.addModule(new URL('./click-processor.js', import.meta.url));
  if (context !== audio || audio.state === 'closed') return;
  const node = new AudioWorkletNode(audio, 'oddmeter-click', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const volume = node.parameters.get('volume');
  volume.value = effectiveVolume();
  node.connect(audio.destination);
  processor = node;
  master = volume;
  node.port.onmessage = ({ data }) => {
    if (context === audio && processor === node && playing && data.id === timingId) clock = data;
  };
  const stateChanged = () => {
    if (context === audio && processor === node && playing && audio.state !== 'running') stop();
  };
  audio.addEventListener('statechange', stateChanged);
  node.onprocessorerror = () => {
    audio.removeEventListener('statechange', stateChanged);
    if (context !== audio || processor !== node) {
      node.disconnect();
      return;
    }
    stop();
    node.disconnect();
    processor = null;
    master = null;
    showMessage('The audio engine stopped. Press Start to try again.');
  };
}

async function previewSound(lane, sound, accented) {
  const id = ++previewId;
  const canPreview = () => !playing && !starting && sound !== 'off' && effectiveVolume() > 0 && !laneMuted(settings.lanes[lane]);
  if (!canPreview()) return;
  try {
    await prepareAudio();
    if (id === previewId && canPreview()) processor.port.postMessage({ type: 'preview', lane, sound, accented });
  } catch (error) {
    if (id !== previewId || !canPreview()) return;
    console.error(error);
    showMessage('The sound preview could not start. Press Start to try again.');
  }
}

async function start() {
  if (playing || starting) return;
  const id = ++startId;
  showMessage();
  starting = true;
  ui.playLabel.textContent = 'Cancel';
  status('Starting');
  try {
    await prepareAudio();
    // Module loading can finish after Cancel, pagehide, or a newer Start.
    // Only the request still owned by the transport may begin playback.
    if (id !== startId) return;
    playing = true;
    ui.play.dataset.running = '';
    ui.playLabel.textContent = 'Stop';
    status(settings.countIn ? 'Count-in' : 'Playing', true);
    sendTiming(settings.countIn);
    animationFrame = requestAnimationFrame(paint);
  } catch (error) {
    if (id !== startId) return;
    stop();
    console.error(error);
    showMessage('Audio could not start. Open Oddmeter on localhost or HTTPS in a browser with AudioWorklet support, then try again.');
  } finally {
    if (id === startId) starting = false;
  }
}

function stop() {
  startId++;
  starting = false;
  previewId++;
  playing = false;
  clock = null;
  processor?.port.postMessage({ type: 'stop' });
  cancelAnimationFrame(animationFrame);
  clearPlayhead();
  delete ui.play.dataset.running;
  ui.playLabel.textContent = 'Start';
  status('Ready');
  ui.position.textContent = '';
}

function togglePlayback() {
  if (playing || starting) stop();
  else void start();
}

function heardFrame(now) {
  const timestamp = context.getOutputTimestamp?.();
  if (timestamp?.performanceTime > 0) {
    return Math.min(context.currentTime, timestamp.contextTime + (now - timestamp.performanceTime) / 1000) * context.sampleRate;
  }
  const latency = (context.baseLatency ?? 0) + (context.outputLatency ?? 0);
  return (context.currentTime - latency) * context.sampleRate;
}

function light(lane, pulse) {
  if (pulse === lane.lit) return;
  lane.lit?.removeAttribute('data-lit');
  pulse?.setAttribute('data-lit', '');
  lane.lit = pulse;
}
function clearPlayhead() {
  delete ui.console.dataset.playing;
  for (const lane of lanes) light(lane, null);
}
function paint(now) {
  if (!playing) return;
  animationFrame = requestAnimationFrame(paint);
  if (!clock) return;
  const frame = heardFrame(now);
  if (frame < clock.origin) {
    if (clock.countIn && frame >= clock.countStart) {
      status('Count-in', true);
      ui.position.textContent = `${Math.min(settings.beats, Math.floor((frame - clock.countStart) * settings.beats / clock.duration) + 1)}/${settings.beats}`;
    }
    return;
  }
  const phase = ((frame - clock.origin) % clock.duration) / clock.duration;
  status('Playing', true);
  ui.position.textContent = `${Math.min(settings.beats, Math.floor(phase * settings.beats) + 1)}/${settings.beats}`;
  ui.console.dataset.playing = '';
  ui.console.style.setProperty('--progress', `${phase * 100}%`);
  lanes.forEach((lane, index) => {
    const profile = settings.lanes[index];
    let hit = lane.onsets.findLastIndex((onset) => onset.phase <= phase);
    let wrapped = false;
    if (hit < 0 && lane.onsets.length && frame - clock.origin >= clock.duration) { hit = lane.onsets.length - 1; wrapped = true; }
    if (hit < 0) { light(lane, null); return; }
    const elapsed = (phase - lane.onsets[hit].phase + Number(wrapped)) * clock.duration / context.sampleRate;
    light(lane, elapsed < 0.08 && !laneMuted(profile) && !profile.rests.includes(hit) && effectiveVolume() > 0 ? lane.pulses[hit] : null);
  });
}

function timingChanged({ meter = false, rhythm = false } = {}) {
  if (meter || rhythm) ui.pulseFeedback.textContent = '';
  if (meter) renderMeter();
  if (meter || rhythm) renderRhythms();
  renderSummary();
  save();
  if (playing) sendTiming(false, meter);
}
function mixChanged() {
  renderMix();
  renderPreset();
  save();
  processor?.port.postMessage({ type: 'mix', mix: mixSettings() });
}
function setFill(input) {
  const percent = 100 * (input.valueAsNumber - Number(input.min)) / (Number(input.max) - Number(input.min));
  input.style.setProperty('--fill', `${percent}%`);
}
function displayTempo(bpm) {
  ui.bpm.value = bpm;
  ui.tempoRange.value = bpm;
  ui.tempoDown.disabled = bpm <= limits.bpm[0];
  ui.tempoUp.disabled = bpm >= limits.bpm[1];
  setFill(ui.tempoRange);
}
function setTempo(value, fromTap = false) {
  if (!fromTap) taps = [];
  const bpm = clampInt(value, limits.bpm, settings.bpm);
  displayTempo(bpm);
  if (bpm === settings.bpm) return;
  settings.bpm = bpm;
  timingChanged();
}
function tapTempo() {
  const now = performance.now();
  const interval = now - taps.at(-1);
  if (interval < 140) return;
  if (interval > 60_000 / limits.bpm[0]) taps = [];
  taps = [...taps.slice(-4), now];
  if (taps.length >= 2) setTempo(60_000 * (taps.length - 1) / (now - taps[0]), true);
  ui.tap.dataset.tapped = '';
  clearTimeout(tapFlash);
  tapFlash = setTimeout(() => delete ui.tap.dataset.tapped, 120);
}
function effectiveVolume() { return settings.masterMuted ? 0 : settings.outputVolume / 100; }
function renderVolume() {
  ui.volume.value = settings.outputVolume;
  ui.volumeValue.textContent = `${settings.masterMuted ? 0 : settings.outputVolume}%`;
  const muted = settings.masterMuted || settings.outputVolume === 0;
  ui.muteAll.setAttribute('aria-pressed', muted);
  ui.muteAll.title = muted ? 'Unmute master volume' : 'Mute master volume';
  ui.muteAll.setAttribute('aria-label', ui.muteAll.title);
  setFill(ui.volume);
  if (master) master.setTargetAtTime(effectiveVolume(), context.currentTime, 0.007);
}

function renderMeter() {
  const { beats, unit, grouping } = settings;
  ui.beats.value = beats;
  ui.unit.value = unit;
  ui.grouping.value = grouping.join('+');
  ui.grouping.removeAttribute('aria-invalid');
  ui.groupingError.hidden = true;
  ui.groupingHelp.textContent = `Groups count ${unitNames[unit]}s. For 7/8, try 2+2+3.`;
  ui.ruler.replaceChildren();
  const starts = groupStarts(grouping);
  for (let beat = 0; beat < beats; beat++) {
    const label = document.createElement('span');
    label.style.left = `${100 * beat / beats}%`;
    label.textContent = beat + 1;
    label.toggleAttribute('data-group-start', starts.includes(beat));
    ui.ruler.append(label);
  }
  for (const lane of lanes) {
    if (lane.span) lane.span.options[0].text = `per ${unitNames[unit]}`;
    lane.guides.replaceChildren();
    for (let beat = 0; beat <= beats; beat++) {
      const guide = document.createElement('i');
      guide.className = 'guide';
      guide.style.left = `${100 * beat / beats}%`;
      guide.toggleAttribute('data-group-start', starts.includes(beat));
      lane.guides.append(guide);
    }
  }
}

function renderBeatCounts(lane, index) {
  const profile = settings.lanes[index];
  lane.beatCounts.hidden = index === 0 || profile.span !== 'beat';
  if (index === 0) return;
  lane.offbeats.disabled = profile.span === 'bar';
  lane.offbeats.checked = profile.offbeatsOnly;
  if (lane.beatCounts.children.length !== settings.beats) {
    lane.beatCounts.replaceChildren();
    for (let beat = 0; beat < settings.beats; beat++) {
      const stepper = document.createElement('div');
      stepper.className = 'beat-stepper';
      const select = document.createElement('select');
      select.className = 'beat-count';
      select.dataset.beat = beat;
      select.dataset.focusKey = `lane-${index}-beat-${beat}`;
      select.setAttribute('aria-label', `${laneNames[index]}, beat ${beat + 1} subdivisions`);
      for (let count = 1; count <= 16; count++) select.add(new Option(`×${count}`, count));
      const setCount = (count) => {
        editLaneTiming(index, (value) => {
          value.beatCounts[beat] = count === value.count ? null : count;
          value.enabled = true;
        });
      };
      select.addEventListener('change', () => setCount(Number(select.value)));
      const makeStep = (delta, text, direction) => {
        const step = document.createElement('button');
        step.type = 'button';
        step.className = 'step lane-step';
        step.dataset.delta = delta;
        step.textContent = text;
        step.setAttribute('aria-label', `${direction} ${laneNames[index].toLowerCase()}, beat ${beat + 1} count`);
        step.addEventListener('click', () => {
          const count = Number(select.value) + delta;
          setCount(count);
          if (step.disabled && document.activeElement === step) select.focus({ preventScroll: true });
        });
        return step;
      };
      stepper.append(makeStep(-1, '‹', 'Decrease'), select, makeStep(1, '›', 'Increase'));
      lane.beatCounts.append(stepper);
    }
  }
  [...lane.beatCounts.querySelectorAll('select')].forEach((select, beat) => {
    select.options[0].text = profile.offbeatsOnly ? 'Off' : '×1';
    select.value = profile.beatCounts[beat] ?? profile.count;
    const count = Number(select.value);
    select.previousElementSibling.disabled = count === 1;
    select.nextElementSibling.disabled = count === limits.pulses[1];
    select.title = `${laneNames[index]}, beat ${beat + 1} · ${count === 1 && profile.offbeatsOnly ? 'Off' : subdivisionName(count, settings.unit)}`;
    select.parentElement.toggleAttribute('data-custom', profile.beatCounts[beat] !== null && profile.beatCounts[beat] !== profile.count);
  });
  lane.reset.hidden = !profile.beatCounts.slice(0, settings.beats).some((count) => count !== null && count !== profile.count);
}

function renderRhythms() {
  const focusedKey = document.activeElement?.dataset.focusKey;
  selectedPulse = null;
  renderPulseEditor();
  let minGap = 1;
  lanes.forEach((lane, index) => {
    const profile = settings.lanes[index];
    lane.onsets = makeLanePulses({ ...profile, enabled: true }, settings.beats);
    if (lane.count) {
      const custom = profile.span === 'beat' && profile.beatCounts.slice(0, settings.beats).some((count) => count !== null && count !== profile.count);
      const choices = [new Option('Off', 0)];
      const includeOne = profile.span === 'bar' || !profile.offbeatsOnly || (custom && profile.count === 1);
      for (let count = includeOne ? 1 : 2; count <= 16; count++) {
        const label = profile.span === 'bar' ? `${count}/bar` : count === 1 && profile.offbeatsOnly ? 'Mix' : `×${count}`;
        choices.push(new Option(label, count));
      }
      lane.count.replaceChildren(...choices);
      lane.count.value = profile.enabled && lane.onsets.length ? profile.count : 0;
      lane.count.title = lane.count.value === '0' ? 'Off' : profile.span === 'bar' ? `${profile.count} clicks per bar` :
        custom && profile.count === 1 && profile.offbeatsOnly ? 'Custom counts' : subdivisionName(profile.count, settings.unit);
      lane.steps[0].disabled = lane.count.selectedIndex <= 0;
      lane.steps[1].disabled = lane.count.selectedIndex >= lane.count.options.length - 1;
      lane.span.value = profile.span;
    }
    lane.sound.value = settings.sounds[index];
    renderBeatCounts(lane, index);
    lane.onsets.forEach((onset, hit) => {
      const next = lane.onsets[(hit + 1) % lane.onsets.length];
      minGap = Math.min(minGap, next.phase - onset.phase + Number(hit === lane.onsets.length - 1));
    });
    light(lane, null);
    lane.pulses = lane.onsets.map((onset, hit) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pulse';
      button.style.left = `${100 * onset.phase}%`;
      // Mixed tuplets can pack one beat tightly while the rest are empty.
      // Total marker count cannot determine a safe local hit target.
      const previous = lane.onsets[(hit + lane.onsets.length - 1) % lane.onsets.length];
      const next = lane.onsets[(hit + 1) % lane.onsets.length];
      const gap = Math.min(onset.phase - previous.phase + Number(hit === 0),
        next.phase - onset.phase + Number(hit === lane.onsets.length - 1));
      button.style.setProperty('--hit-span', `${100 * gap}%`);
      button.dataset.index = onset.index;
      button.dataset.beat = onset.beat;
      button.dataset.part = onset.part;
      button.dataset.focusKey = `lane-${index}-pulse-${onset.index}`;
      button.setAttribute('aria-describedby', 'pulse-hint');
      button.addEventListener('click', (event) => editPulse(index, onset.index, event.shiftKey));
      return button;
    });
    lane.buttons.replaceChildren(...lane.pulses);
    lane.buttons.style.setProperty('--pulses', Math.max(lane.pulses.length, 1));
    lane.beatCounts.style.setProperty('--beats', settings.beats);
    const custom = profile.span === 'beat' && profile.beatCounts.slice(0, settings.beats).some((count) => count !== null && count !== profile.count);
    const count = lane.onsets.length;
    lane.summary.textContent = `${profile.enabled ? '' : 'Off · '}${count} ${count === 1 ? 'click' : 'clicks'} / bar${custom ? ' · custom counts' : ''}${profile.span === 'beat' && profile.offbeatsOnly ? ' · offbeats only' : ''}`;
    if (!count) lane.summary.textContent += ' · increase the count to hear offbeats';
  });
  const beatWidth = lanes.some((lane) => !lane.beatCounts.hidden) ? 70 : 48;
  ui.rhythmPanel.style.setProperty('--timeline-grid-width', `${Math.ceil(Math.max(240, settings.beats * beatWidth, 24 / minGap))}px`);
  renderMix();
  if (focusedKey) document.querySelector(`[data-focus-key="${focusedKey}"]`)?.focus({ preventScroll: true });
}

function editLaneTiming(index, change) {
  editRhythmLane(settings.lanes[index], change);
  timingChanged({ rhythm: true });
}

function setLaneCount(index, value) {
  const profile = settings.lanes[index];
  if (value === 0) {
    profile.enabled = false;
    timingChanged({ rhythm: true });
    return;
  }
  const count = clampInt(value, limits.pulses, profile.count);
  if (count === profile.count) {
    if (!profile.enabled) {
      profile.enabled = true;
      timingChanged({ rhythm: true });
    }
    return;
  }
  editLaneTiming(index, (lane) => {
    const changed = lane.count !== count;
    lane.count = count;
    lane.enabled = true;
    if (changed && lane.span === 'beat') lane.beatCounts.fill(null);
  });
}

function pulseName(lane, pulse) {
  if (lane === 0) return `Beat, beat ${pulse + 1}`;
  const onset = lanes[lane].onsets[pulse];
  return settings.lanes[lane].span === 'beat'
    ? `${laneNames[lane]}, beat ${onset.beat + 1}, subdivision ${onset.part + 1}`
    : `${laneNames[lane]}, click ${pulse + 1}`;
}
function editPulse(lane, pulse, accentOnly = false) {
  if (editSounds && !accentOnly) {
    selectedPulse = { lane, pulse };
    renderPulseEditor();
    ui.pulseSound.focus();
    return;
  }
  const profile = settings.lanes[lane];
  const laneSound = settings.sounds[lane];
  if (accentOnly) {
    if (profile.accents.includes(pulse)) profile.accents = profile.accents.filter((hit) => hit !== pulse);
    else profile.accents.push(pulse);
  } else if (profile.rests.includes(pulse)) {
    profile.rests = profile.rests.filter((hit) => hit !== pulse);
    delete profile.pulseSounds[pulse];
  } else if ((profile.pulseSounds[pulse] ?? laneSound) === laneSound) {
    profile.pulseSounds[pulse] = lane === 1 && laneSound !== 'cowbell' ? 'cowbell' : laneSound === 'kick' ? 'hat' : 'kick';
  } else {
    profile.rests.push(pulse);
  }
  const sound = profile.rests.includes(pulse) ? 'off' : profile.pulseSounds[pulse] ?? laneSound;
  const accented = profile.accents.includes(pulse);
  ui.pulseFeedback.textContent = `${pulseName(lane, pulse)} · ${sound === 'off' ? 'Rest' : soundNames.get(sound)}${accented && sound !== 'off' ? ' · Accent' : ''}`;
  mixChanged();
  void previewSound(lane, sound, accented);
}
function renderPulseEditor() {
  ui.pulseEditor.hidden = !selectedPulse || !editSounds;
  if (!selectedPulse) return;
  const { lane, pulse } = selectedPulse;
  ui.pulseEditorLabel.textContent = `${pulseName(lane, pulse)} sound`;
  const profile = settings.lanes[lane];
  ui.pulseSound.value = profile.rests.includes(pulse) ? 'off' : profile.pulseSounds[pulse] ?? 'default';
}
function renderMix() {
  lanes.forEach((lane, index) => {
    const profile = settings.lanes[index];
    lane.element.toggleAttribute('data-muted', laneMuted(profile));
    if (lane.enabled) {
      lane.enabled.disabled = index > 0 && (!profile.enabled || lane.onsets.length === 0);
      const muted = index === 0 ? !profile.enabled : profile.muted === true;
      lane.enabled.setAttribute('aria-pressed', muted);
      const muteLabel = `${muted ? 'Unmute' : 'Mute'} ${laneNames[index].toLowerCase()}`;
      lane.enabled.setAttribute('aria-label', muteLabel);
      lane.enabled.title = lane.enabled.disabled ? 'Choose a subdivision count first' : muteLabel;
    }
    lane.pulses.forEach((pulse, hit) => {
      const sound = profile.pulseSounds[hit];
      const rest = profile.rests.includes(hit);
      const accented = profile.accents.includes(hit);
      const label = `${pulseName(index, hit)} · ${rest ? 'Rest' : soundNames.get(sound ?? settings.sounds[index])}${!rest && accented ? ' · Accent' : ''}`;
      pulse.dataset.sound = rest ? 'off' : sound ?? 'default';
      pulse.toggleAttribute('data-accented', accented);
      pulse.setAttribute('aria-label', label);
      pulse.title = `${label} · ${editSounds ? 'Choose sound' : 'Click to cycle'}`;
    });
  });
}
function presetLanes(preset) {
  return preset.lanes.map((lane) => {
    const result = { count: lane.count, span: lane.span, enabled: lane.enabled, muted: false, offbeatsOnly: lane.offbeatsOnly === true,
      beatCounts: Array(32).fill(null), accents: [], rests: [], pulseSounds: {} };
    result.accents = lane.accents ? [...lane.accents] : result.span === 'beat' && !result.offbeatsOnly
      ? makeLanePulses({ ...result, enabled: true }, preset.beats).filter((hit) => hit.part === 0 && groupStarts(preset.groups).includes(hit.beat)).map((hit) => hit.index) : [0];
    return result;
  });
}
function renderPreset() {
  const match = rhythmPresets.find((preset) => {
    if (preset.beats !== settings.beats || preset.unit !== settings.unit || preset.groups.join('+') !== settings.grouping.join('+')) return false;
    const expected = presetLanes(preset);
    return settings.lanes.every((lane, index) => {
      const target = expected[index];
      const visibleCount = makeLanePulses({ ...lane, enabled: true }, settings.beats).length;
      const accents = lane.accents.filter((hit) => hit < visibleCount);
      return lane.count === target.count && lane.span === target.span && lane.enabled === target.enabled && !lane.muted && lane.offbeatsOnly === target.offbeatsOnly &&
        (lane.span === 'bar' || lane.beatCounts.slice(0, settings.beats).every((count) => count === null || count === lane.count)) &&
        accents.length === target.accents.length && target.accents.every((hit) => accents.includes(hit)) &&
        !lane.rests.some((hit) => hit < visibleCount) && Object.keys(lane.pulseSounds).every((hit) => Number(hit) >= visibleCount);
    });
  });
  ui.preset.value = match?.id ?? '';
}
function renderSummary() {
  ui.duration.textContent = `${measureSeconds(settings).toFixed(2)} s / bar`;
  renderPreset();
}

for (const [value, label] of tempoBeats) ui.tempoBeat.add(new Option(label, value));
ui.tempoBeat.value = settings.tempoBeat;
for (let beats = 1; beats <= 32; beats++) ui.beats.add(new Option(beats, beats));
for (const unit of beatUnits) ui.unit.add(new Option(unit, unit));
for (const preset of rhythmPresets) ui.preset.add(new Option(preset.label, preset.id));
for (const [id, label] of pulseSoundOptions) ui.pulseSound.add(new Option(id === 'off' ? 'Rest' : id === 'cowbell' ? 'Cowbell (blue)' : label, id));
ui.preset.addEventListener('change', () => {
  const preset = rhythmPresets.find((value) => value.id === ui.preset.value);
  if (!preset) return;
  const meter = settings.beats !== preset.beats || settings.unit !== preset.unit;
  settings.beats = preset.beats;
  settings.unit = preset.unit;
  settings.grouping = [...preset.groups];
  settings.lanes = presetLanes(preset);
  renderMeter();
  timingChanged({ meter, rhythm: true });
});
ui.tempoBeat.addEventListener('change', () => { settings.tempoBeat = Number(ui.tempoBeat.value); taps = []; timingChanged(); });
ui.beats.addEventListener('change', () => { settings.beats = Number(ui.beats.value); settings.grouping = [settings.beats]; timingChanged({ meter: true }); });
ui.unit.addEventListener('change', () => { settings.unit = Number(ui.unit.value); timingChanged({ meter: true }); });
ui.applyGrouping.addEventListener('click', () => {
  const grouping = parseGrouping(ui.grouping.value, settings.beats);
  ui.groupingError.hidden = Boolean(grouping);
  ui.grouping.setAttribute('aria-invalid', !grouping);
  if (!grouping) { ui.groupingError.textContent = `Use groups such as 2+2+3 that total ${settings.beats}.`; return; }
  settings.grouping = grouping;
  const starts = groupStarts(grouping);
  settings.lanes.forEach((profile) => {
    if (profile.span === 'beat' && !profile.offbeatsOnly) profile.accents = makeLanePulses({ ...profile, enabled: true }, settings.beats)
      .filter((hit) => hit.part === 0 && starts.includes(hit.beat)).map((hit) => hit.index);
  });
  renderMeter();
  mixChanged();
  ui.pulseFeedback.textContent = 'Grouping applied to per-note rhythms.';
});
ui.grouping.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); ui.applyGrouping.click(); } });
lanes.forEach((lane, index) => {
  for (const [id, label] of soundOptions) lane.sound.add(new Option(label, id));
  lane.enabled?.addEventListener('click', () => {
    const profile = settings.lanes[index];
    if (index === 0) profile.enabled = !profile.enabled;
    else profile.muted = !profile.muted;
    mixChanged();
  });
  lane.sound.addEventListener('change', () => { settings.sounds[index] = lane.sound.value; mixChanged(); void previewSound(index, lane.sound.value, false); });
  if (!lane.count) return;
  lane.count.addEventListener('change', () => {
    if (lane.count.value !== '') setLaneCount(index, Number(lane.count.value));
    else renderRhythms();
  });
  lane.steps.forEach((button) => button.addEventListener('click', () => {
    // Off suspends a configured pattern; the next step restores that pattern,
    // including per-beat counts, rather than selecting a synthetic ×1 option.
    if (Number(button.dataset.delta) > 0 && lane.count.value === '0' && lane.onsets.length) {
      setLaneCount(index, settings.lanes[index].count);
      return;
    }
    const option = lane.count.options[lane.count.selectedIndex + Number(button.dataset.delta)];
    if (option) setLaneCount(index, Number(option.value));
  }));
  lane.span.addEventListener('change', () => editLaneTiming(index, (profile) => { profile.span = lane.span.value; }));
  lane.offbeats.addEventListener('change', () => editLaneTiming(index, (profile) => { profile.offbeatsOnly = lane.offbeats.checked; }));
  lane.reset.addEventListener('click', () => editLaneTiming(index, (profile) => { profile.beatCounts.fill(null); }));

});
function setEditSounds(enabled) {
  editSounds = enabled;
  selectedPulse = null;
  ui.editSounds.setAttribute('aria-pressed', editSounds);
  ui.editSounds.textContent = editSounds ? 'Select a marker' : 'Edit sounds';
  ui.pulseHint.textContent = editSounds ? 'Click to choose a sound.' : 'Click to cycle sounds and rest. Shift-click to toggle accent.';
  renderPulseEditor();
  renderMix();
}
ui.editSounds.addEventListener('click', () => setEditSounds(!editSounds));
ui.more.addEventListener('toggle', () => {
  if (!ui.more.open && editSounds) setEditSounds(false);
});
ui.pulseSound.addEventListener('change', () => {
  if (!selectedPulse) return;
  const { lane, pulse } = selectedPulse;
  const profile = settings.lanes[lane];
  const sound = ui.pulseSound.value;
  if (sound === 'off') {
    if (!profile.rests.includes(pulse)) profile.rests.push(pulse);
  } else {
    profile.rests = profile.rests.filter((hit) => hit !== pulse);
    if (sound === 'default') delete profile.pulseSounds[pulse];
    else profile.pulseSounds[pulse] = sound;
  }
  mixChanged();
  void previewSound(lane, sound === 'default' ? settings.sounds[lane] : sound, profile.accents.includes(pulse));
});
ui.closeEditor.addEventListener('click', () => {
  const target = selectedPulse && lanes[selectedPulse.lane].pulses[selectedPulse.pulse];
  setEditSounds(false);
  target?.focus();
});
ui.bpm.addEventListener('change', () => setTempo(ui.bpm.valueAsNumber));
ui.bpm.addEventListener('keydown', (event) => { if (event.key === 'Enter') ui.bpm.blur(); });
ui.tempoRange.addEventListener('input', () => setTempo(ui.tempoRange.valueAsNumber));
function bindHoldStep(button, getDelta) {
  let delayTimer;
  let repeatTimer;
  const clear = () => { clearTimeout(delayTimer); clearInterval(repeatTimer); };
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    clear();
    delayTimer = setTimeout(() => { repeatTimer = setInterval(() => setTempo(settings.bpm + getDelta(event)), 65); }, 320);
  });
  for (const event of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(event, clear);
  for (const event of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(event, clear);
}
ui.tempoDown.addEventListener('click', (event) => setTempo(settings.bpm - (event.shiftKey ? 5 : 1)));
ui.tempoUp.addEventListener('click', (event) => setTempo(settings.bpm + (event.shiftKey ? 5 : 1)));
bindHoldStep(ui.tempoDown, (event) => -(event.shiftKey ? 5 : 1));
bindHoldStep(ui.tempoUp, (event) => event.shiftKey ? 5 : 1);
document.querySelector('.tempo-dial').addEventListener('wheel', (event) => { if (event.deltaY) { event.preventDefault(); setTempo(settings.bpm + (event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 5 : 1)); } }, { passive: false });
ui.tap.addEventListener('click', tapTempo);
ui.play.addEventListener('click', togglePlayback);
window.addEventListener('pagehide', stop);
ui.countIn.addEventListener('change', () => { settings.countIn = ui.countIn.checked; save(); });
ui.volume.addEventListener('input', () => { settings.outputVolume = ui.volume.valueAsNumber; settings.masterMuted = false; renderVolume(); save(); });
ui.muteAll.addEventListener('click', () => {
  if (settings.outputVolume === 0) { settings.outputVolume = defaultVolume; settings.masterMuted = false; }
  else settings.masterMuted = !settings.masterMuted;
  renderVolume(); save();
});
ui.scrolls.forEach((scroll) => scroll.addEventListener('scroll', () => { for (const other of ui.scrolls) if (other !== scroll && other.scrollLeft !== scroll.scrollLeft) other.scrollLeft = scroll.scrollLeft; }));
document.addEventListener('keydown', (event) => {
  if (ui.shareDialog.open) return;
  if (event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return;
  if (event.key === 'Escape' && selectedPulse) { ui.closeEditor.click(); event.preventDefault(); return; }
  if (event.target.closest('input:not([type="range"]):not([type="checkbox"]), select, textarea, [contenteditable]')) return;
  if (event.key === '+' || event.key === '=' || event.key === '-') { event.preventDefault(); setTempo(settings.bpm + (event.key === '-' ? -5 : 5)); return; }
  if (event.repeat) return;
  if (event.code === 'Space') { if (event.target.closest('button, input, select, textarea, a, summary, [contenteditable]')) return; event.preventDefault(); togglePlayback(); }
  if (event.key.toLowerCase() === 't') tapTempo();
});

ui.countIn.checked = settings.countIn;
displayTempo(settings.bpm);
renderMeter();
renderRhythms();
renderSummary();
renderVolume();
if (setupHash && !shared) showMessage('This setup link could not be loaded.');
