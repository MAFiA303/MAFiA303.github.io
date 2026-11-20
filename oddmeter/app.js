import { beatLayout, beatUnits, clampInt, compareFractions, formatBeatTrim, formatTotalBeats, hasBeatSkip, hasBeatTrim, isPulseActiveInBeat, limits, makeBeatSnapPoints, makeLaneCyclePhases, makeLanePulses, normalizeBeatEnabled, normalizeBeatEnd, normalizeBeatEnds, pulseBeatFraction, subdivisionName } from './rhythm.js?v=beats1';
import { pulseSoundOptions, soundOptions } from './sounds.js?v=audio1';
import { tempoBeats, rhythmPresets, parseGrouping, groupStarts, groupingChoices, editRhythmLane, snapshotBeat, pasteBeat, moveBeat, insertBeat, deleteBeat } from './practice.js?v=beats1';
import { readSettings, storageKey, defaultVolume, setupLinkPrefix, makeSetupLink, readSetupLink } from './settings.js?v=beats1';

const byId = (id) => document.getElementById(id);
const ui = {
  console: document.querySelector('.console'),
  rhythmPanel: document.querySelector('.rhythm-panel'),
  rulerRow: document.querySelector('.ruler-row'),
  rulerScroll: document.querySelector('.ruler-scroll'),
  addBeat: byId('add-beat'), beatClipboard: byId('beat-clipboard'), clipboardLabel: byId('clipboard-label'), clearClipboard: byId('clear-clipboard'),
  pasteSlots: byId('paste-slots'),
  trimBadge: byId('trim-badge'), trimLabel: byId('trim-label'), trimReset: byId('trim-reset'),
  trimRails: byId('trim-rails'), trimHandles: byId('trim-handles'),
  preset: byId('preset'), status: byId('status'), statusText: byId('status-text'), position: byId('position'),
  bpm: byId('bpm'), tempoBeat: byId('tempo-beat'), tempoRange: byId('tempo-range'), tempoUnit: byId('tempo-unit'),
  tempoDown: byId('tempo-down'), tempoUp: byId('tempo-up'), tap: byId('tap'),
  beats: byId('meter-beats'), unit: byId('meter-unit'), ruler: byId('ruler'), groupingChoice: byId('grouping-choice'),
  grouping: byId('grouping'), groupingHelp: byId('grouping-help'), groupingError: byId('grouping-error'), applyGrouping: byId('apply-grouping'),
  pulseHint: byId('pulse-hint'), pulseFeedback: byId('pulse-feedback'), more: document.querySelector('.advanced-settings'), embedMore: byId('embed-more'),
  markerMenu: byId('marker-menu'), markerMenuTitle: byId('marker-menu-title'), markerMenuClose: byId('marker-menu-close'), markerSounds: document.querySelector('.marker-sounds'), markerAccent: byId('marker-accent'), markerTrim: byId('marker-trim'),
  beatMenu: byId('beat-menu'), beatMenuTitle: byId('beat-menu-title'), beatMenuClose: byId('beat-menu-close'),
  beatMenuCopy: byId('beat-menu-copy'), beatMenuInsertCopy: byId('beat-menu-insert-copy'), beatMenuPaste: byId('beat-menu-paste'), beatMenuDuplicate: byId('beat-menu-duplicate'),
  beatMenuToggle: byId('beat-menu-toggle'), beatMenuLeft: byId('beat-menu-left'), beatMenuRight: byId('beat-menu-right'), beatMenuDelete: byId('beat-menu-delete'),
  undoToast: byId('undo-toast'), undoText: byId('undo-text'), undo: byId('undo'), headerUndo: byId('header-undo'),
  play: byId('play'), playLabel: byId('play-label'), countIn: byId('count-in'),
  muteAll: byId('mute-all'), volume: byId('volume'), volumeValue: byId('volume-value'), message: byId('message'),
  reset: byId('reset'), share: byId('share'), keepSetup: byId('keep-setup'), shareFeedback: byId('share-feedback'), shareDialog: byId('share-dialog'), shareLink: byId('share-link'), shareCopy: byId('share-copy'),
  scrolls: [...document.querySelectorAll('[data-timeline-scroll]')],
};
const laneNames = ['Beat', 'Subdivision 1', 'Subdivision 2'];
const lanes = [...document.querySelectorAll('.lane')].map((element, index) => {
  const options = index === 0 ? null : byId(`subdiv-${index}-options`);
  return {
    element, enabled: element.querySelector('.lane-enabled'), count: element.querySelector('.lane-count'),
    steps: [...element.querySelectorAll('.lane-controls [data-delta]')], span: options?.querySelector('.lane-span'),
    sound: byId(['sound-a', 'sound-b', 'sound-c'][index]), rowSound: element.querySelector('.lane-sound'),
    options, offbeats: options?.querySelector('.offbeats-only'), beatCounts: element.querySelector('.beat-counts'),
    guides: element.querySelector('.guides'), trimTails: element.querySelector('.trim-tails'), buttons: element.querySelector('.pulse-buttons'),
    pulses: [], onsets: [], beatFractions: [], activeEvents: [], lit: null,
  };
});
const soundNames = new Map(pulseSoundOptions);
const unitNames = { 2: 'half note', 4: 'quarter note', 8: 'eighth note', 16: 'sixteenth note' };
const tempoSymbols = new Map([[1, '♩'], [0.5, '♪'], [1.5, '♩.'], [2, '𝅗𝅥']]);
let saved;
try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { /* Storage is optional. */ }
const setupHash = window.location.hash.startsWith(setupLinkPrefix);
const shared = readSetupLink(window.location.hash);
const settings = shared ?? readSettings(saved);
// The address bar always carries the setup, so bookmarks and home-screen
// icons hold a link. A link that matches this device's saved setup, or a first
// visit with nothing saved, is the visitor's own setup and keeps saving.
const ownLink = shared && (saved == null || makeSetupLink(window.location.href, readSettings(saved)) === makeSetupLink(window.location.href, shared));
let saveLocally = !shared || window.history.state?.oddmeterLocalSetup === true || ownLink;
let urlUpdateTimer;
let lastUrlEdit = -Infinity;
const isEmbed = new URLSearchParams(window.location.search).get('embed') === '1' && window.parent !== window;
let embedDirty = Boolean(isEmbed && setupHash && shared);

function fullAppUrl() {
  return new URL('./', window.location.href).href;
}

function shareBaseUrl() {
  if (!isEmbed) return window.location.href;
  try { return window.parent.location.href; } catch { return window.location.href; }
}

function syncEmbedState() {
  const fullHref = makeSetupLink(fullAppUrl(), settings);
  if (ui.embedMore) ui.embedMore.href = fullHref;
  if (!isEmbed || !embedDirty) return;
  const shareHref = makeSetupLink(shareBaseUrl(), settings);
  const hash = new URL(shareHref).hash;
  try {
    window.parent.postMessage({ type: 'oddmeter:setup', hash, fullHref }, window.location.origin);
  } catch { /* Cross-origin fallback */ }
}

function updateSetupUrl() {
  if (isEmbed) {
    syncEmbedState();
    return;
  }
  const link = makeSetupLink(window.location.href, settings);
  if (link === window.location.href) return;
  window.history.replaceState({ ...window.history.state, oddmeterLocalSetup: saveLocally }, '', link);
}

function queueSetupUrl() {
  window.clearTimeout(urlUpdateTimer);
  const delay = 400 - (performance.now() - lastUrlEdit);
  const update = () => {
    lastUrlEdit = performance.now();
    updateSetupUrl();
  };
  if (delay <= 0) update();
  else urlUpdateTimer = window.setTimeout(update, delay);
}

function save() {
  if (isEmbed) embedDirty = true;
  if (saveLocally) {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Playback works without storage. */ }
  }
  renderReset();
  queueSetupUrl();
}

let shareFeedbackTimer;
let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) return false;
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  window.getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = window.getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}
function supportsTopLayerExit() {
  return Boolean(window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay());
}
async function closeTopLayer(dialog) {
  if (!dialog?.open || dialog.hasAttribute('data-closing')) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations?.({ subtree: true }) ?? [];
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((animation) => animation.finished)),
        new Promise((resolve) => window.setTimeout(resolve, 400)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }
  dialog.close();
}
if (ui.shareDialog) {
  ui.shareDialog.addEventListener('cancel', (event) => {
    if (supportsTopLayerExit()) return;
    event.preventDefault();
    void closeTopLayer(ui.shareDialog);
  });
  // Fallback for browsers without native closedby="any" light-dismiss support.
  if (!('closedBy' in (window.HTMLDialogElement?.prototype ?? {}))) {
    ui.shareDialog.addEventListener('click', (event) => {
      if (event.target !== ui.shareDialog) return;
      const rect = ui.shareDialog.getBoundingClientRect();
      const inside = rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX && event.clientX <= rect.left + rect.width;
      if (!inside) void closeTopLayer(ui.shareDialog);
    });
  }
}
ui.shareCopy?.addEventListener('click', () => {
  ui.shareLink.focus();
  ui.shareLink.select();
  void window.navigator.clipboard?.writeText(ui.shareLink.value).then(() => {
    ui.shareFeedback.textContent = 'Setup link copied.';
  }).catch(() => {});
});
ui.share?.addEventListener('click', async () => {
  if (isEmbed && !embedDirty) {
    embedDirty = true;
    syncEmbedState();
  }
  const link = makeSetupLink(shareBaseUrl(), settings);
  try {
    await window.navigator.clipboard.writeText(link);
    ui.share.textContent = 'Copied';
    ui.share.dataset.copied = '';
    ui.shareFeedback.textContent = 'Setup link copied.';
    clearTimeout(shareFeedbackTimer);
    shareFeedbackTimer = window.setTimeout(() => {
      ui.share.textContent = 'Share';
      delete ui.share.dataset.copied;
      ui.shareFeedback.textContent = '';
    }, 1600);
  } catch {
    ui.shareLink.value = link;
    ui.shareDialog.removeAttribute('data-closing');
    if (!ui.shareDialog.open) ui.shareDialog.showModal();
    ui.shareLink.focus();
    ui.shareLink.select();
  }
});
ui.keepSetup.hidden = saveLocally;
ui.keepSetup.addEventListener('click', () => {
  saveLocally = true;
  ui.keepSetup.hidden = true;
  window.history.replaceState({ ...window.history.state, oddmeterLocalSetup: true }, '');
  save();
  ui.shareFeedback.textContent = 'Saved as your setup.';
});
window.addEventListener('hashchange', (event) => {
  if (new URL(event.oldURL).hash.startsWith(setupLinkPrefix) || window.location.hash.startsWith(setupLinkPrefix)) {
    window.clearTimeout(urlUpdateTimer);
    window.location.reload();
  }
});

let context;
let processor;
let master;
let loadingAudio;
let starting = false;
let startId = 0;
let playing = false;
let previewId = 0;
let clock = null;
let timingId = 0;
let animationFrame = 0;
let taps = [];
let tapFlash;
let currentBeat = -1;
let wakeLock = null;
let wakeRequest = 0;

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
  const beatEnds = hasBeatTrim(settings.beatEnds, beats) ? normalizeBeatEnds(settings.beatEnds, beats) : null;
  const beatEnabled = hasBeatSkip(settings.beatEnabled, beats) ? normalizeBeatEnabled(settings.beatEnabled, beats) : null;
  return { bpm, tempoBeat, beats, unit, beatEnds, beatEnabled, lanes: settings.lanes.map(({ count, span, enabled, beatCounts, offbeatsOnly }, index) =>
    ({ count, span, enabled: index === 0 || enabled, beatCounts, offbeatsOnly })) };
}
function sendTiming(countIn = false, restart = false) {
  if (countIn || restart) { clock = null; clearPlayhead(); }
  processor.port.postMessage({ type: 'timing', id: ++timingId, settings: timingSettings(), countIn, restart, mix: mixSettings() });
}

async function prepareAudio(retries = 2) {
  const Audio = window.AudioContext ?? window.webkitAudioContext;
  if (!Audio) throw new Error('Web Audio is unavailable.');
  // iOS mutes Web Audio with the ring/silent switch unless the page declares
  // playback audio, as a music app would.
  try {
    const session = window.navigator.audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch { /* Older browsers have no audio session control. */ }
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
  await audio.audioWorklet.addModule(new URL('./click-processor.js?v=beats2', import.meta.url));
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

// Keep the screen on while playing so the beat stays visible. A request that
// resolves after Stop or a newer request releases itself.
async function keepAwake() {
  const lock = window.navigator.wakeLock;
  if (!lock || document.visibilityState === 'hidden') return;
  const id = ++wakeRequest;
  try {
    const sentinel = await lock.request('screen');
    if (id !== wakeRequest || !playing) { void sentinel.release().catch(() => {}); return; }
    wakeLock = sentinel;
  } catch { /* The browser may refuse, for example on low battery. */ }
}
function releaseWake() {
  wakeRequest++;
  const sentinel = wakeLock;
  wakeLock = null;
  void sentinel?.release().catch(() => {});
}
document.addEventListener('visibilitychange', () => {
  if (playing && document.visibilityState === 'visible') void keepAwake();
});

async function start() {
  if (playing || starting) return;
  if (isEmbed && !embedDirty) {
    embedDirty = true;
    syncEmbedState();
  }
  const id = ++startId;
  showMessage();
  starting = true;
  ui.play.dataset.starting = '';
  ui.playLabel.textContent = 'Cancel';
  status('Starting');
  try {
    await prepareAudio();
    // Module loading can finish after Cancel, pagehide, or a newer Start.
    // Only the request still owned by the transport may begin playback.
    if (id !== startId) return;
    playing = true;
    delete ui.play.dataset.starting;
    ui.play.dataset.running = '';
    ui.playLabel.textContent = 'Stop';
    status(settings.countIn ? 'Count-in' : 'Playing', true);
    sendTiming(settings.countIn);
    animationFrame = requestAnimationFrame(paint);
    void keepAwake();
  } catch (error) {
    if (id !== startId) return;
    stop();
    console.error(error);
    showMessage('Audio could not start. Open Oddmeter on localhost or HTTPS in a browser with AudioWorklet support, then try again.');
  } finally {
    if (id === startId) {
      starting = false;
      delete ui.play.dataset.starting;
    }
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
  releaseWake();
  delete ui.play.dataset.starting;
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
let programmaticScroll = false;
let manualScrollUntil = 0;

function setTimelineScroll(next, programmatic = true) {
  const scroll = ui.rulerScroll;
  if (!scroll) return;
  const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
  const clamped = Math.max(0, Math.min(max, next));
  if (clamped === scroll.scrollLeft) return;
  if (programmatic) programmaticScroll = true;
  for (const scroller of ui.scrolls) scroller.scrollLeft = clamped;
  if (programmatic) Promise.resolve().then(() => { programmaticScroll = false; });
}

function setCurrentBeat(beat) {
  if (beat === currentBeat) return;
  ui.ruler.children[currentBeat]?.removeAttribute('data-current');
  ui.ruler.children[beat]?.setAttribute('data-current', '');
  currentBeat = beat;
  if (playing && beat >= 0) followBeatDuringPlayback(beat);
}
function clearPlayhead() {
  delete ui.console.dataset.playing;
  setCurrentBeat(-1);
  for (const lane of lanes) light(lane, null);
}
function paint(now) {
  if (!playing) return;
  animationFrame = requestAnimationFrame(paint);
  if (!clock) return;
  const frame = heardFrame(now);
  if (clock.carry && frame < clock.carry.end) {
    const span = Math.max(1, clock.carry.end - clock.carry.start);
    const localRatio = Math.max(0, Math.min(1, (frame - clock.carry.start) / span));
    const visualPhase = (clock.carry.beat + localRatio * clock.carry.len) / settings.beats;
    status('Playing', true);
    ui.position.textContent = `${clock.carry.beat + 1}/${settings.beats}`;
    setCurrentBeat(clock.carry.beat);
    ui.console.dataset.playing = '';
    ui.console.style.setProperty('--progress', `${visualPhase * 100}%`);
    for (const lane of lanes) light(lane, null);
    return;
  }
  if (frame < clock.origin) {
    if (clock.countIn && frame >= clock.countStart) {
      status('Count-in', true);
      const countDuration = clock.countDuration ?? clock.duration;
      const beat = Math.min(settings.beats, Math.floor((frame - clock.countStart) * settings.beats / countDuration) + 1);
      ui.position.textContent = `${beat}/${settings.beats}`;
      setCurrentBeat(beat - 1);
    }
    return;
  }
  const cyclePhase = ((frame - clock.origin) % clock.duration) / clock.duration;
  const layout = beatLayout(settings.beats, clock.beatEnds, clock.beatEnabled);
  let beatIndex = Math.min(settings.beats - 1, Math.floor(cyclePhase * settings.beats));
  let visualPhase = cyclePhase;
  if (layout.shortened) {
    const activeBeatTime = cyclePhase * layout.totalFloat;
    beatIndex = layout.enabled.lastIndexOf(true);
    for (let beat = 0; beat < settings.beats; beat++) {
      if (!layout.enabled[beat]) continue;
      if (activeBeatTime < layout.startsFloat[beat] + layout.lengthsFloat[beat]) {
        beatIndex = beat;
        break;
      }
    }
    const localOffset = Math.max(0, Math.min(layout.lengthsFloat[beatIndex], activeBeatTime - layout.startsFloat[beatIndex]));
    visualPhase = (beatIndex + localOffset) / settings.beats;
  }
  status('Playing', true);
  ui.position.textContent = `${beatIndex + 1}/${settings.beats}`;
  setCurrentBeat(beatIndex);
  ui.console.dataset.playing = '';
  ui.console.style.setProperty('--progress', `${visualPhase * 100}%`);
  lanes.forEach((lane, index) => {
    const profile = settings.lanes[index];
    const events = lane.activeEvents;
    let eventIndex = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].phase <= cyclePhase) { eventIndex = i; break; }
    }
    let wrapped = false;
    if (eventIndex < 0 && events.length && frame - clock.origin >= clock.duration) { eventIndex = events.length - 1; wrapped = true; }
    if (eventIndex < 0) { light(lane, null); return; }
    const hit = events[eventIndex].hit;
    const elapsed = (cyclePhase - events[eventIndex].phase + Number(wrapped)) * clock.duration / context.sampleRate;
    light(lane, elapsed < 0.08 && !laneMuted(profile) && !profile.rests.includes(hit) && effectiveVolume() > 0 ? lane.pulses[hit] : null);
  });
}

// Undo covers every rhythm, sound and meter edit. Tempo and volume stay as
// they are for rhythm undos; Reset restores tempo and volume on Undo too.
const makeCleanSetup = () => ({ ...readSettings({ schemaVersion: 3 }), bpm: 60, sounds: ['click', 'hat', 'cowbell'] });
const resetSetupKey = makeSetupLink('http://oddmeter.local/', makeCleanSetup());
function isResetState() {
  return makeSetupLink('http://oddmeter.local/', settings) === resetSetupKey;
}
function renderReset() {
  if (!ui.reset) return;
  ui.reset.disabled = isResetState();
}
const undoStack = [];
let undoTimer;
function renderUndo() {
  if (!ui.headerUndo) return;
  const top = undoStack.at(-1);
  const label = typeof top === 'object' ? top?.label : '';
  ui.headerUndo.disabled = undoStack.length === 0;
  ui.headerUndo.title = label ? `Undo: ${label} (Ctrl/⌘+Z)` : 'Undo (Ctrl/⌘+Z)';
  ui.headerUndo.setAttribute('aria-label', label ? `Undo ${label}` : 'Undo');
}
function pushUndo(json, { toast = '', label = toast, restoreAll = false } = {}) {
  undoStack.push({ json, restoreAll, label });
  if (undoStack.length > 40) undoStack.shift();
  renderUndo();
  if (toast) showUndo(toast);
}
function undoable(change, toast = '', { restoreAll = false, label = toast } = {}) {
  const before = JSON.stringify(settings);
  change();
  if (JSON.stringify(settings) === before) return;
  pushUndo(before, { toast, label, restoreAll });
}
function showUndo(text) {
  ui.undoText.textContent = text;
  ui.undoToast.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 6000);
}
function hideUndo() {
  clearTimeout(undoTimer);
  ui.undoToast.hidden = true;
}
function undo() {
  const entry = undoStack.pop();
  hideUndo();
  renderUndo();
  if (!entry) return;
  const { json, restoreAll } = typeof entry === 'string' ? { json: entry, restoreAll: false } : entry;
  const previous = JSON.parse(json);
  const meter = previous.beats !== settings.beats || previous.unit !== settings.unit;
  const current = restoreAll ? {} : { bpm: settings.bpm, outputVolume: settings.outputVolume, masterMuted: settings.masterMuted };
  for (const key of Object.keys(settings)) delete settings[key];
  Object.assign(settings, previous, current);
  if (beatClipboard && beatClipboard.sourceBeat != null && beatClipboard.sourceBeat >= settings.beats) beatClipboard.sourceBeat = null;
  closeMarkerMenu();
  closeBeatMenu();
  displayTempo(settings.bpm);
  renderVolume();
  ui.countIn.checked = settings.countIn;
  ui.tempoBeat.value = settings.tempoBeat;
  renderTempoUnit();
  timingChanged({ meter: true, restart: meter });
  if (!playing) processor?.port.postMessage({ type: 'mix', mix: mixSettings() });
  ui.pulseFeedback.textContent = 'Undone.';
}
function resetSetup() {
  if (isResetState()) return;
  undoable(() => {
    const clean = makeCleanSetup();
    const meter = settings.beats !== clean.beats || settings.unit !== clean.unit;
    const preserved = {
      ...(settings.legacyProfiles === undefined ? {} : { legacyProfiles: settings.legacyProfiles }),
      ...(settings.previousSetup === undefined ? {} : { previousSetup: settings.previousSetup }),
    };
    for (const key of Object.keys(settings)) delete settings[key];
    Object.assign(settings, clean, preserved);
    beatClipboard = null;
    taps = [];
    closeMarkerMenu();
    closeBeatMenu();
    displayTempo(settings.bpm);
    renderVolume();
    ui.countIn.checked = settings.countIn;
    ui.tempoBeat.value = settings.tempoBeat;
    renderTempoUnit();
    timingChanged({ meter: true, restart: meter });
    if (!playing) processor?.port.postMessage({ type: 'mix', mix: mixSettings() });
  }, 'Reset to 4/4 · 60 BPM', { restoreAll: true });
  ui.pulseFeedback.textContent = 'Reset to 4/4, 60 BPM, 100% volume.';
}
ui.reset?.addEventListener('click', resetSetup);

function timingChanged({ meter = false, rhythm = false, restart = meter } = {}) {
  if (meter || rhythm) ui.pulseFeedback.textContent = '';
  if (meter) renderMeter();
  if (meter || rhythm) renderRhythms();
  renderPreset();
  save();
  if (playing) sendTiming(false, restart);
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
function renderTempoUnit() {
  const note = document.createElement('span');
  note.className = 'tempo-note';
  note.textContent = tempoSymbols.get(settings.tempoBeat) ?? '♩';
  ui.tempoUnit.replaceChildren(note, ' BPM');
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

let beatClipboard = null;
let beatMenuTarget = -1;
let beatMenuAnchor = null;
let beatDrag = null;
let beatDragRaf = 0;

function scrollBeatIntoView(beat, { page = false } = {}) {
  const head = ui.ruler.children[beat];
  const scroll = ui.rulerScroll;
  if (!head || !scroll || scroll.scrollWidth <= scroll.clientWidth) return;
  const stageOffset = ui.ruler.parentElement?.offsetLeft ?? 0;
  const headLeft = stageOffset + head.offsetLeft;
  const headRight = headLeft + head.offsetWidth;
  const viewLeft = scroll.scrollLeft;
  const viewRight = viewLeft + scroll.clientWidth;
  let next = viewLeft;
  if (headLeft < viewLeft + 12) next = Math.max(0, headLeft - 24);
  else if (headRight > viewRight - 12) next = page ? Math.max(0, headLeft - 24) : headRight - scroll.clientWidth + 24;
  if (next !== viewLeft) setTimelineScroll(next, true);
}

function followBeatDuringPlayback(beat) {
  if (beatDrag?.active || trimDragBeat >= 0 || performance.now() < manualScrollUntil) return;
  scrollBeatIntoView(beat, { page: true });
}

function toggleBeatEnabled(beat, enabled) {
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  const activeCount = settings.beatEnabled.slice(0, settings.beats).filter(Boolean).length;
  if (!enabled && settings.beatEnabled[beat] !== false && activeCount <= 1) {
    renderBeatHeaders();
    ui.pulseFeedback.textContent = 'At least one beat must stay on.';
    return;
  }
  if ((settings.beatEnabled[beat] !== false) === enabled) return;
  const label = enabled ? `Beat ${beat + 1} on` : `Beat ${beat + 1} skipped`;
  undoable(() => {
    settings.beatEnabled[beat] = enabled;
    renderBeatHeaders();
    renderTrim();
    renderMix();
    renderPreset();
    save();
    if (playing) sendTiming(false, false);
  }, label);
  ui.pulseFeedback.textContent = `${label}.`;
}

function copyBeat(beat) {
  beatClipboard = snapshotBeat(settings, beat);
  renderBeatHeaders();
  ui.pulseFeedback.textContent = `Beat ${beat + 1} copied. Choose a + slot above the ruler to insert it between beats.`;
}

function toggleCopyBeat(beat) {
  const next = snapshotBeat(settings, beat);
  if (beatClipboard && beatClipboard.sourceBeat === beat && JSON.stringify(beatClipboard) === JSON.stringify(next)) {
    clearBeatClipboard(true);
    return;
  }
  beatClipboard = next;
  renderBeatHeaders();
  ui.pulseFeedback.textContent = `Beat ${beat + 1} copied. Choose a + slot above the ruler to insert it between beats.`;
}

function clearBeatClipboard(announce = false) {
  if (!beatClipboard) return;
  beatClipboard = null;
  renderBeatHeaders();
  if (announce) ui.pulseFeedback.textContent = 'Copied beat cleared.';
}

function pasteOntoBeat(targetBeat, sourceSnapshot = beatClipboard, labelOverride = '') {
  if (!sourceSnapshot || targetBeat < 0 || targetBeat >= settings.beats) return;
  const label = labelOverride || (sourceSnapshot.sourceBeat != null
    ? `Replaced beat ${targetBeat + 1} with beat ${sourceSnapshot.sourceBeat + 1}`
    : `Replaced beat ${targetBeat + 1} with copied beat`);
  undoable(() => {
    if (!pasteBeat(settings, targetBeat, sourceSnapshot)) return;
    timingChanged({ rhythm: true, restart: false });
  }, label);
  ui.pulseFeedback.textContent = `${label}.`;
}

function addBeat() {
  if (settings.beats >= limits.meter[1]) return;
  const at = settings.beats;
  const label = `Added beat ${at + 1}`;
  undoable(() => {
    if (!insertBeat(settings, at, null)) return;
    timingChanged({ meter: true, restart: true });
  }, label);
  scrollBeatIntoView(at);
  ui.pulseFeedback.textContent = `${label}.`;
}

function insertCopiedBeatAt(atIndex, sourceSnapshot = beatClipboard) {
  if (!sourceSnapshot || settings.beats >= limits.meter[1]) return;
  if (!Number.isInteger(atIndex) || atIndex < 0 || atIndex > settings.beats) return;
  const srcText = sourceSnapshot.sourceBeat != null ? `beat ${sourceSnapshot.sourceBeat + 1}` : 'copied beat';
  const whereText = atIndex === 0 ? 'before beat 1'
    : atIndex === settings.beats ? `as beat ${atIndex + 1}`
    : `between beats ${atIndex} and ${atIndex + 1}`;
  const label = `Inserted ${srcText} ${whereText}`;
  undoable(() => {
    if (!insertBeat(settings, atIndex, sourceSnapshot)) return;
    if (beatClipboard && beatClipboard.sourceBeat != null && atIndex <= beatClipboard.sourceBeat) {
      beatClipboard.sourceBeat += 1;
    }
    timingChanged({ meter: true, restart: true });
  }, label);
  scrollBeatIntoView(atIndex);
  ui.pulseFeedback.textContent = `${label}.`;
}

function duplicateBeat(beat) {
  if (settings.beats >= limits.meter[1] || beat < 0 || beat >= settings.beats) return;
  const snap = snapshotBeat(settings, beat);
  const label = `Duplicated beat ${beat + 1}`;
  undoable(() => {
    if (!insertBeat(settings, beat + 1, snap)) return;
    if (beatClipboard?.sourceBeat != null && beatClipboard.sourceBeat > beat) beatClipboard.sourceBeat += 1;
    timingChanged({ meter: true, restart: true });
  }, label);
  scrollBeatIntoView(beat + 1);
  ui.pulseFeedback.textContent = `${label} as beat ${beat + 2}.`;
}

function moveBeatColumn(fromBeat, toBeat, { focusKey = '' } = {}) {
  if (fromBeat === toBeat || fromBeat < 0 || toBeat < 0 || fromBeat >= settings.beats || toBeat >= settings.beats) return;
  const label = `Moved beat ${fromBeat + 1} to beat ${toBeat + 1}`;
  undoable(() => {
    if (!moveBeat(settings, fromBeat, toBeat)) return;
    if (beatClipboard?.sourceBeat != null) {
      const src = beatClipboard.sourceBeat;
      if (src === fromBeat) beatClipboard.sourceBeat = toBeat;
      else if (fromBeat < src && src <= toBeat) beatClipboard.sourceBeat = src - 1;
      else if (toBeat <= src && src < fromBeat) beatClipboard.sourceBeat = src + 1;
    }
    timingChanged({ rhythm: true, restart: false });
  }, label);
  scrollBeatIntoView(toBeat);
  if (focusKey) document.querySelector(`[data-focus-key="${focusKey}"]`)?.focus({ preventScroll: true });
  ui.pulseFeedback.textContent = `${label}.`;
}

function deleteBeatColumn(beat) {
  if (settings.beats <= limits.meter[0] || beat < 0 || beat >= settings.beats) return;
  const label = `Deleted beat ${beat + 1}`;
  undoable(() => {
    if (!deleteBeat(settings, beat)) return;
    if (beatClipboard?.sourceBeat === beat) beatClipboard.sourceBeat = null;
    else if (beatClipboard?.sourceBeat != null && beatClipboard.sourceBeat > beat) beatClipboard.sourceBeat -= 1;
    timingChanged({ meter: true, restart: true });
  }, label);
  ui.pulseFeedback.textContent = `${label}.`;
}

function clearBeatDragIndicators() {
  delete ui.ruler.dataset.drop;
  ui.ruler.style.removeProperty('--drop-x');
  ui.ruler.style.removeProperty('--drop-y');
  ui.ruler.style.removeProperty('--drop-h');
  for (const child of ui.ruler.children) child.removeAttribute('data-copy-target');
}

function updateBeatDragVisual() {
  if (!beatDrag?.active) return;
  const mode = beatDrag.altKey ? 'copy' : 'move';
  beatDrag.mode = mode;
  document.documentElement.dataset.dragMode = mode;
  const scrollDelta = (ui.rulerScroll?.scrollLeft ?? 0) - beatDrag.startScrollLeft;
  beatDrag.head.style.translate = `${Math.round(beatDrag.lastX - beatDrag.startX + scrollDelta)}px 0`;
  clearBeatDragIndicators();
  const rect = ui.ruler.getBoundingClientRect();
  if (rect.width <= 0) return;
  const colW = rect.width / settings.beats;
  if (mode === 'move') {
    let insertBefore = settings.beats;
    for (let i = 0; i < settings.beats; i++) {
      if (beatDrag.lastX < rect.left + (i + 0.5) * colW) {
        insertBefore = i;
        break;
      }
    }
    beatDrag.insertBefore = insertBefore;
    beatDrag.copyTarget = -1;
    beatDrag.appendCopy = false;
    if (insertBefore === beatDrag.fromBeat || insertBefore === beatDrag.fromBeat + 1) {
      beatDrag.toIndex = beatDrag.fromBeat;
      return;
    }
    beatDrag.toIndex = insertBefore > beatDrag.fromBeat ? insertBefore - 1 : insertBefore;
    ui.ruler.dataset.drop = 'move';
    ui.ruler.style.setProperty('--drop-x', `${rect.left + insertBefore * colW}px`);
    ui.ruler.style.setProperty('--drop-y', `${rect.top}px`);
    ui.ruler.style.setProperty('--drop-h', `${rect.height}px`);
  } else {
    beatDrag.toIndex = beatDrag.fromBeat;
    if (beatDrag.lastX > rect.right + 8 && settings.beats < limits.meter[1]) {
      beatDrag.copyTarget = -1;
      beatDrag.appendCopy = true;
      ui.ruler.dataset.drop = 'copy-append';
      ui.ruler.style.setProperty('--drop-x', `${rect.right}px`);
      ui.ruler.style.setProperty('--drop-y', `${rect.top}px`);
      ui.ruler.style.setProperty('--drop-h', `${rect.height}px`);
      return;
    }
    beatDrag.appendCopy = false;
    const target = Math.max(0, Math.min(settings.beats - 1, Math.floor((beatDrag.lastX - rect.left) / colW)));
    if (target === beatDrag.fromBeat) {
      beatDrag.copyTarget = -1;
      return;
    }
    beatDrag.copyTarget = target;
    ui.ruler.dataset.drop = 'copy';
    ui.ruler.children[target]?.setAttribute('data-copy-target', '');
  }
}

function beatDragAutoScroll(now) {
  if (!beatDrag?.active) return;
  beatDragRaf = requestAnimationFrame(beatDragAutoScroll);
  const scroll = ui.rulerScroll;
  if (!scroll || scroll.scrollWidth <= scroll.clientWidth) return;
  const dt = beatDrag.lastTime ? Math.min(64, now - beatDrag.lastTime) : 16;
  beatDrag.lastTime = now;
  const rect = scroll.getBoundingClientRect();
  if (rect.width <= 0) return;
  const colW = Math.max(48, ui.ruler.offsetWidth / Math.max(1, settings.beats));
  const zone = Math.min(colW, rect.width / 3);
  let velocity = 0;
  if (beatDrag.lastX < rect.left + zone) {
    const depth = Math.min(2, (rect.left + zone - beatDrag.lastX) / zone);
    velocity = -depth * 420;
  } else if (beatDrag.lastX > rect.right - zone) {
    const depth = Math.min(2, (beatDrag.lastX - (rect.right - zone)) / zone);
    velocity = depth * 420;
  }
  if (!velocity) return;
  const before = scroll.scrollLeft;
  scroll.scrollLeft = before + velocity * dt / 1000;
  if (scroll.scrollLeft !== before) {
    for (const other of ui.scrolls) if (other !== scroll) other.scrollLeft = scroll.scrollLeft;
    updateBeatDragVisual();
  }
}

function onBeatDragMove(event) {
  if (!beatDrag || event.pointerId !== beatDrag.pointerId) return;
  const dx = event.clientX - beatDrag.startX;
  const dy = event.clientY - beatDrag.startY;
  if (!beatDrag.active) {
    if (Math.hypot(dx, dy) < 5) return;
    clearTimeout(beatDrag.pressTimer);
    beatDrag.pressTimer = 0;
    beatDrag.active = true;
    closeMarkerMenu();
    closeBeatMenu();
    beatDrag.handle.setPointerCapture?.(event.pointerId);
    document.documentElement.classList.add('beat-dragging');
    beatDrag.head.setAttribute('data-dragging', '');
    beatDrag.lastTime = 0;
    beatDragRaf = requestAnimationFrame(beatDragAutoScroll);
  }
  beatDrag.lastX = event.clientX;
  beatDrag.altKey = event.altKey;
  updateBeatDragVisual();
}

function onBeatDragKey(event) {
  if (!beatDrag?.active) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    endBeatDrag(true);
    return;
  }
  if (event.key === 'Alt') {
    beatDrag.altKey = event.type === 'keydown';
    updateBeatDragVisual();
  }
}

function onBeatDragUp(event) {
  if (!beatDrag || (event.pointerId !== undefined && event.pointerId !== beatDrag.pointerId)) return;
  endBeatDrag(event.type === 'pointercancel');
}

function endBeatDrag(cancelled = false) {
  if (!beatDrag) return;
  const drag = beatDrag;
  beatDrag = null;
  clearTimeout(drag.pressTimer);
  cancelAnimationFrame(beatDragRaf);
  beatDragRaf = 0;
  window.removeEventListener('pointermove', onBeatDragMove);
  window.removeEventListener('pointerup', onBeatDragUp);
  window.removeEventListener('pointercancel', onBeatDragUp);
  window.removeEventListener('keydown', onBeatDragKey);
  window.removeEventListener('keyup', onBeatDragKey);
  drag.handle.removeEventListener('lostpointercapture', onBeatDragUp);
  document.documentElement.classList.remove('beat-dragging');
  delete document.documentElement.dataset.dragMode;
  drag.head.removeAttribute('data-dragging');
  drag.head.style.removeProperty('translate');
  clearBeatDragIndicators();
  if (!drag.active) return;
  if (cancelled) {
    ui.pulseFeedback.textContent = 'Beat drag cancelled.';
    return;
  }
  if (drag.mode === 'move' && drag.toIndex >= 0 && drag.toIndex !== drag.fromBeat) {
    moveBeatColumn(drag.fromBeat, drag.toIndex, { focusKey: `beat-drag-${drag.toIndex}` });
  } else if (drag.mode === 'copy' && drag.appendCopy) {
    const snap = snapshotBeat(settings, drag.fromBeat);
    const at = settings.beats;
    const label = `Copied beat ${drag.fromBeat + 1} as beat ${at + 1}`;
    undoable(() => {
      if (!insertBeat(settings, at, snap)) return;
      timingChanged({ meter: true, restart: true });
    }, label);
    scrollBeatIntoView(at);
    ui.pulseFeedback.textContent = `${label}.`;
  } else if (drag.mode === 'copy' && drag.copyTarget >= 0 && drag.copyTarget !== drag.fromBeat) {
    const snap = snapshotBeat(settings, drag.fromBeat);
    pasteOntoBeat(drag.copyTarget, snap, `Copied beat ${drag.fromBeat + 1} onto beat ${drag.copyTarget + 1}`);
  }
}

function bindBeatDrag(handle, head) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || beatDrag) return;
    const fromBeat = Number(head.dataset.beat);
    beatDrag = {
      fromBeat,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      altKey: event.altKey,
      active: false,
      mode: event.altKey ? 'copy' : 'move',
      insertBefore: -1,
      toIndex: fromBeat,
      copyTarget: -1,
      appendCopy: false,
      handle,
      head,
      startScrollLeft: ui.rulerScroll?.scrollLeft ?? 0,
      lastTime: 0,
      pressTimer: 0,
    };
    if (event.pointerType !== 'mouse') {
      beatDrag.pressTimer = setTimeout(() => {
        if (!beatDrag || beatDrag.active) return;
        const beat = beatDrag.fromBeat;
        endBeatDrag(true);
        openBeatMenu(beat, handle);
      }, 450);
    }
    window.addEventListener('pointermove', onBeatDragMove);
    window.addEventListener('pointerup', onBeatDragUp);
    window.addEventListener('pointercancel', onBeatDragUp);
    window.addEventListener('keydown', onBeatDragKey);
    window.addEventListener('keyup', onBeatDragKey);
    handle.addEventListener('lostpointercapture', onBeatDragUp);
  });
  handle.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const beat = Number(head.dataset.beat);
    if (event.key === 'ArrowLeft' && beat > 0) {
      event.preventDefault();
      moveBeatColumn(beat, beat - 1, { focusKey: `beat-drag-${beat - 1}` });
    } else if (event.key === 'ArrowRight' && beat < settings.beats - 1) {
      event.preventDefault();
      moveBeatColumn(beat, beat + 1, { focusKey: `beat-drag-${beat + 1}` });
    }
  });
}

function renderBeatMenu() {
  if (beatMenuTarget < 0 || !ui.beatMenu) return;
  const beat = beatMenuTarget;
  const enabled = settings.beatEnabled?.[beat] !== false;
  const activeCount = normalizeBeatEnabled(settings.beatEnabled, settings.beats).filter(Boolean).length;
  ui.beatMenuTitle.textContent = `Beat ${beat + 1}`;
  ui.beatMenuCopy.textContent = `Copy beat ${beat + 1}`;
  if (ui.beatMenuInsertCopy) {
    ui.beatMenuInsertCopy.disabled = !beatClipboard || settings.beats >= limits.meter[1];
    ui.beatMenuInsertCopy.textContent = beatClipboard?.sourceBeat != null
      ? `Insert B${beatClipboard.sourceBeat + 1} after`
      : 'Insert copy after';
  }
  ui.beatMenuPaste.disabled = !beatClipboard;
  ui.beatMenuPaste.textContent = beatClipboard?.sourceBeat != null
    ? `Replace w/ B${beatClipboard.sourceBeat + 1}`
    : 'Replace with copy';
  ui.beatMenuDuplicate.disabled = settings.beats >= limits.meter[1];
  ui.beatMenuToggle.textContent = enabled ? 'Skip beat' : 'Include beat';
  ui.beatMenuToggle.disabled = enabled && activeCount <= 1;
  ui.beatMenuLeft.disabled = beat <= 0;
  ui.beatMenuRight.disabled = beat >= settings.beats - 1;
  ui.beatMenuDelete.disabled = settings.beats <= limits.meter[0];
}

function positionBeatMenu() {
  if (!ui.beatMenu || !beatMenuAnchor) return;
  const rect = beatMenuAnchor.getBoundingClientRect();
  const menu = ui.beatMenu;
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const viewWidth = document.documentElement.clientWidth || window.innerWidth;
  const bottomGuard = viewWidth <= 680 ? 78 : 8;
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, viewWidth - width - 8));
  const placedAbove = rect.bottom + 8 + height > window.innerHeight - bottomGuard && rect.top - height - 8 > 8;
  const top = placedAbove ? rect.top - height - 8 : rect.bottom + 8;
  menu.dataset.placement = placedAbove ? 'above' : 'below';
  menu.style.setProperty('--menu-origin-x', `${Math.max(16, Math.min(width - 16, Math.round(rect.left + rect.width / 2 - left)))}px`);
  menu.style.left = `${left + window.scrollX}px`;
  menu.style.top = `${top + window.scrollY}px`;
}

function openBeatMenu(beat, anchor = null) {
  if (!ui.beatMenu || beat < 0 || beat >= settings.beats) return;
  closeMarkerMenu();
  beatMenuTarget = beat;
  beatMenuAnchor = anchor ?? ui.ruler.children[beat]?.querySelector('.beat-more') ?? ui.ruler.children[beat];
  renderBeatMenu();
  ui.beatMenu.hidden = false;
  positionBeatMenu();
  renderBeatHeaders();
  ui.beatMenuCopy.focus({ preventScroll: true });
}

function closeBeatMenu(returnFocus = false) {
  if (beatMenuTarget < 0) return;
  const anchor = beatMenuAnchor;
  beatMenuTarget = -1;
  beatMenuAnchor = null;
  if (ui.beatMenu) ui.beatMenu.hidden = true;
  renderBeatHeaders();
  if (returnFocus) anchor?.focus({ preventScroll: true });
}

ui.addBeat?.addEventListener('click', addBeat);
ui.clearClipboard?.addEventListener('click', () => clearBeatClipboard(true));
ui.beatMenuClose?.addEventListener('click', () => closeBeatMenu(true));
ui.beatMenuCopy?.addEventListener('click', () => {
  if (beatMenuTarget < 0) return;
  const beat = beatMenuTarget;
  copyBeat(beat);
  closeBeatMenu(true);
});
ui.beatMenuInsertCopy?.addEventListener('click', () => {
  if (beatMenuTarget < 0 || !beatClipboard) return;
  const beat = beatMenuTarget;
  closeBeatMenu();
  insertCopiedBeatAt(beat + 1);
});
ui.beatMenuPaste?.addEventListener('click', () => {
  if (beatMenuTarget < 0 || !beatClipboard) return;
  const beat = beatMenuTarget;
  closeBeatMenu();
  pasteOntoBeat(beat);
});
ui.beatMenuDuplicate?.addEventListener('click', () => {
  if (beatMenuTarget < 0) return;
  const beat = beatMenuTarget;
  closeBeatMenu();
  duplicateBeat(beat);
});
ui.beatMenuToggle?.addEventListener('click', () => {
  if (beatMenuTarget < 0) return;
  const beat = beatMenuTarget;
  const enabled = settings.beatEnabled?.[beat] !== false;
  toggleBeatEnabled(beat, !enabled);
  closeBeatMenu(true);
});
ui.beatMenuLeft?.addEventListener('click', () => {
  if (beatMenuTarget <= 0) return;
  const beat = beatMenuTarget;
  closeBeatMenu();
  moveBeatColumn(beat, beat - 1, { focusKey: `beat-drag-${beat - 1}` });
});
ui.beatMenuRight?.addEventListener('click', () => {
  if (beatMenuTarget < 0 || beatMenuTarget >= settings.beats - 1) return;
  const beat = beatMenuTarget;
  closeBeatMenu();
  moveBeatColumn(beat, beat + 1, { focusKey: `beat-drag-${beat + 1}` });
});
ui.beatMenuDelete?.addEventListener('click', () => {
  if (beatMenuTarget < 0) return;
  const beat = beatMenuTarget;
  closeBeatMenu();
  deleteBeatColumn(beat);
});

function ensureBeatHeaderDom() {
  ui.ruler.style.setProperty('--beats', settings.beats);
  if (ui.ruler.children.length === settings.beats) return;
  currentBeat = -1;
  ui.ruler.replaceChildren(...Array.from({ length: settings.beats }, (_, beat) => {
    const head = document.createElement('div');
    head.className = 'beat-head';
    head.setAttribute('role', 'listitem');
    head.dataset.beat = beat;

    const checkWrap = document.createElement('label');
    checkWrap.className = 'beat-check-wrap';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'beat-toggle';
    toggle.dataset.beat = beat;
    toggle.dataset.focusKey = `beat-toggle-${beat}`;
    toggle.addEventListener('change', () => toggleBeatEnabled(Number(head.dataset.beat), toggle.checked));
    checkWrap.append(toggle);

    const drag = document.createElement('button');
    drag.type = 'button';
    drag.className = 'beat-drag';
    drag.dataset.beat = beat;
    drag.dataset.focusKey = `beat-drag-${beat}`;
    drag.setAttribute('aria-label', `Beat ${beat + 1} — drag to reorder, Alt-drag to copy`);
    drag.title = `Beat ${beat + 1} · Drag to reorder, Alt/Option-drag to copy, Alt+←/→ with keyboard`;
    const grip = document.createElement('span');
    grip.className = 'beat-grip';
    grip.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    num.className = 'beat-num';
    num.textContent = beat + 1;
    drag.append(grip, num);
    bindBeatDrag(drag, head);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'beat-action beat-copy';
    copyBtn.dataset.beat = beat;
    copyBtn.dataset.focusKey = `beat-copy-${beat}`;
    const copyIcon = document.createElement('span');
    copyIcon.className = 'beat-icon icon-copy';
    copyIcon.setAttribute('aria-hidden', 'true');
    copyBtn.append(copyIcon);
    copyBtn.addEventListener('click', () => toggleCopyBeat(Number(head.dataset.beat)));

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'beat-action beat-more';
    moreBtn.dataset.beat = beat;
    moreBtn.dataset.focusKey = `beat-more-${beat}`;
    moreBtn.setAttribute('aria-label', `Beat ${beat + 1} actions`);
    moreBtn.setAttribute('aria-haspopup', 'menu');
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.title = `Beat ${beat + 1} actions (copy, insert, replace, duplicate, move, delete)`;
    const moreIcon = document.createElement('span');
    moreIcon.className = 'beat-icon icon-more';
    moreIcon.setAttribute('aria-hidden', 'true');
    moreBtn.append(moreIcon);
    moreBtn.addEventListener('click', () => {
      const target = Number(head.dataset.beat);
      if (beatMenuTarget === target) closeBeatMenu(true);
      else openBeatMenu(target, moreBtn);
    });

    head.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openBeatMenu(Number(head.dataset.beat), drag);
    });

    head.append(checkWrap, drag, copyBtn, moreBtn);
    return head;
  }));
}

function renderPasteSlots() {
  if (!ui.pasteSlots) return;
  const active = Boolean(beatClipboard);
  ui.rulerRow?.toggleAttribute('data-pasting', active);
  ui.pasteSlots.hidden = !active;
  if (!active) return;
  const count = settings.beats + 1;
  const atMax = settings.beats >= limits.meter[1];
  if (ui.pasteSlots.children.length !== count) {
    ui.pasteSlots.replaceChildren(...Array.from({ length: count }, (_, slot) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'paste-slot';
      btn.dataset.insert = slot;
      btn.dataset.focusKey = `paste-slot-${slot}`;
      btn.textContent = '+';
      btn.addEventListener('click', () => insertCopiedBeatAt(Number(btn.dataset.insert)));
      return btn;
    }));
  }
  const src = beatClipboard?.sourceBeat != null ? `beat ${beatClipboard.sourceBeat + 1}` : 'copied beat';
  [...ui.pasteSlots.children].forEach((btn, slot) => {
    btn.dataset.insert = slot;
    btn.style.left = `${100 * slot / settings.beats}%`;
    btn.disabled = atMax;
    const where = slot === 0 ? 'before beat 1'
      : slot === settings.beats ? `after beat ${settings.beats}`
      : `between beats ${slot} and ${slot + 1}`;
    const desc = atMax ? `Maximum ${limits.meter[1]} beats` : `Insert ${src} ${where}`;
    btn.setAttribute('aria-label', desc);
    btn.title = desc;
  });
}

function renderBeatHeaders() {
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  if (settings.beats > 0 && !settings.beatEnabled.slice(0, settings.beats).some(Boolean)) settings.beatEnabled[0] = true;
  ensureBeatHeaderDom();
  const starts = groupStarts(settings.grouping);
  const activeCount = settings.beatEnabled.slice(0, settings.beats).filter(Boolean).length;
  const hasClip = Boolean(beatClipboard);
  if (ui.addBeat) {
    ui.addBeat.disabled = settings.beats >= limits.meter[1];
    ui.addBeat.title = ui.addBeat.disabled ? `Maximum ${limits.meter[1]} beats` : 'Add beat to bar';
  }
  if (ui.beatClipboard) {
    ui.beatClipboard.hidden = !hasClip;
    if (ui.clipboardLabel) {
      ui.clipboardLabel.textContent = beatClipboard?.sourceBeat != null ? `B${beatClipboard.sourceBeat + 1} copied` : 'Copied';
      ui.clipboardLabel.title = beatClipboard?.sourceBeat != null
        ? `Beat ${beatClipboard.sourceBeat + 1} copied · Click a + slot above the ruler to insert it between beats`
        : 'Copied beat · Click a + slot above the ruler to insert it between beats';
    }
  }
  ui.ruler.toggleAttribute('data-has-clipboard', hasClip);
  [...ui.ruler.children].forEach((head, beat) => {
    const enabled = settings.beatEnabled[beat] !== false;
    const onlyActive = enabled && activeCount <= 1;
    const isSource = hasClip && beatClipboard.sourceBeat === beat;
    head.dataset.beat = beat;
    head.toggleAttribute('data-group-start', starts.includes(beat));
    head.toggleAttribute('data-skipped', !enabled);
    head.toggleAttribute('data-copied-source', isSource);
    const checkWrap = head.querySelector('.beat-check-wrap');
    const toggle = head.querySelector('.beat-toggle');
    if (toggle) {
      toggle.checked = enabled;
      toggle.disabled = onlyActive;
      toggle.setAttribute('aria-label', enabled ? `Include beat ${beat + 1} in loop` : `Include skipped beat ${beat + 1} in loop`);
      if (checkWrap) {
        checkWrap.title = onlyActive ? 'At least one beat must stay on'
          : enabled ? `Beat ${beat + 1} on · Uncheck to skip` : `Beat ${beat + 1} skipped · Check to include`;
      }
    }
    const copyBtn = head.querySelector('.beat-copy');
    if (copyBtn) {
      copyBtn.toggleAttribute('data-active', isSource);
      copyBtn.setAttribute('aria-label', isSource ? `Beat ${beat + 1} copied — click to cancel` : `Copy beat ${beat + 1}`);
      copyBtn.title = isSource ? `Beat ${beat + 1} copied · Click + above ruler to insert, or click again to cancel` : `Copy beat ${beat + 1}`;
    }
    const moreBtn = head.querySelector('.beat-more');
    if (moreBtn) moreBtn.setAttribute('aria-expanded', String(beatMenuTarget === beat));
  });
  renderPasteSlots();
  if (beatMenuTarget >= settings.beats) closeBeatMenu();
  else renderBeatMenu();
}

function renderMeter() {
  const { beats, unit, grouping } = settings;
  ui.beats.value = beats;
  ui.unit.value = unit;
  ui.grouping.value = grouping.join('+');
  ui.grouping.removeAttribute('aria-invalid');
  ui.groupingError.hidden = true;
  ui.groupingHelp.textContent = `Groups count ${unitNames[unit]}s. For 7/8, try 2+2+3.`;
  const choices = groupingChoices(beats, grouping);
  ui.groupingChoice.replaceChildren(...choices.map((choice) =>
    new Option(choice.length === 1 ? 'No groups' : choice.join('+'), choice.join('+'))), new Option('Custom…', 'custom'));
  ui.groupingChoice.value = grouping.join('+');
  ui.groupingChoice.hidden = beats < 5;
  ui.groupingChoice.toggleAttribute('data-active', grouping.length > 1);
  renderBeatHeaders();
  const starts = groupStarts(grouping);
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

function visibleCounts(profile) {
  return Array.from({ length: settings.beats }, (_, beat) => profile.beatCounts[beat] ?? profile.count);
}
// A per-note row is mixed when any visible beat differs from the row count.
function laneCustom(profile) {
  return profile.span === 'beat' && profile.beatCounts.slice(0, settings.beats).some((count) => count !== null && count !== profile.count);
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
      const setCount = (count) => undoable(() => {
        editLaneTiming(index, (value) => {
          value.beatCounts[beat] = count === value.count ? null : count;
          value.enabled = true;
        });
      });
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
    select.parentElement.toggleAttribute('data-off', count === 1 && profile.offbeatsOnly);
  });
}

function renderRhythms() {
  const focusedKey = document.activeElement?.dataset.focusKey;
  closeMarkerMenu();
  closeBeatMenu();
  let minGap = 1;
  lanes.forEach((lane, index) => {
    const profile = settings.lanes[index];
    lane.onsets = makeLanePulses({ ...profile, enabled: true }, settings.beats);
    lane.beatFractions = lane.onsets.map((onset) => pulseBeatFraction(onset, profile));
    if (lane.count) {
      const custom = laneCustom(profile);
      const choices = [new Option('Off', 0)];
      if (custom) choices.push(new Option('Mix', 'mix'));
      const includeOne = profile.span === 'bar' || !profile.offbeatsOnly;
      for (let count = includeOne ? 1 : 2; count <= 16; count++) {
        choices.push(new Option(profile.span === 'bar' ? `${count}/bar` : `×${count}`, count));
      }
      lane.count.replaceChildren(...choices);
      lane.count.value = profile.enabled && lane.onsets.length ? custom ? 'mix' : profile.count : 0;
      const mix = lane.count.value === 'mix';
      lane.count.title = lane.count.value === '0' ? 'Off' : mix ? 'Different counts per beat' :
        profile.span === 'bar' ? `${profile.count} clicks per bar` : subdivisionName(profile.count, settings.unit);
      lane.steps[0].disabled = lane.count.value === '0';
      lane.steps[1].disabled = mix ? Math.max(...visibleCounts(profile)) >= limits.pulses[1]
        : lane.count.selectedIndex >= lane.count.options.length - 1;
      lane.span.value = profile.span;
    }
    lane.sound.value = settings.sounds[index];
    renderBeatCounts(lane, index);
    lane.element.toggleAttribute('data-empty', index > 0 && lane.onsets.length === 0);
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
      bindMarker(button, index, onset.index);
      return button;
    });
    lane.buttons.replaceChildren(...lane.pulses);
    lane.buttons.style.setProperty('--pulses', Math.max(lane.pulses.length, 1));
    lane.beatCounts.style.setProperty('--beats', settings.beats);
  });
  const beatWidth = settings.beats > 4 ? 260 : 76;
  const minMarkerWidth = Math.ceil(Math.max(240, 24 / minGap));
  ui.rhythmPanel.toggleAttribute('data-extended', settings.beats > 4);
  ui.rhythmPanel.style.setProperty('--beats', settings.beats);
  ui.rhythmPanel.style.setProperty('--min-marker-width', `${minMarkerWidth}px`);
  ui.rhythmPanel.style.setProperty('--timeline-grid-width', `${Math.ceil(Math.max(minMarkerWidth, settings.beats * beatWidth))}px`);
  renderBeatHeaders();
  renderTrim();
  renderMix();
  if (focusedKey) document.querySelector(`[data-focus-key="${focusedKey}"]`)?.focus({ preventScroll: true });
}

let beatSnaps = [];
let trimDragBeat = -1;
let trimPreviewBeat = -1;
let trimDragBefore = '';

function sameBeatEnd(a, b) {
  const first = normalizeBeatEnd(a);
  const second = normalizeBeatEnd(b);
  if (!first && !second) return true;
  return Boolean(first && second && first[0] === second[0] && first[1] === second[1]);
}

function updateTrimPreview() {
  const active = trimDragBeat >= 0 ? trimDragBeat : trimPreviewBeat;
  if (ui.trimRails) {
    [...ui.trimRails.children].forEach((seg, beat) => seg.toggleAttribute('data-preview', beat === active));
  }
  for (const lane of lanes) {
    if (!lane.trimTails) continue;
    [...lane.trimTails.children].forEach((tail, beat) => tail.toggleAttribute('data-preview', beat === active));
  }
}

function formatBeatTrimLabel(beat, end) {
  return end ? `Beat ${beat + 1} ends at ${formatBeatTrim(end)}` : `Beat ${beat + 1} restored`;
}

function applyBeatEnd(beat, next, { saveState = true } = {}) {
  const normalized = normalizeBeatEnd(next);
  if (sameBeatEnd(settings.beatEnds[beat], normalized)) return false;
  settings.beatEnds[beat] = normalized;
  renderTrim();
  renderMix();
  renderPreset();
  if (saveState) save();
  if (playing) sendTiming(false, false);
  return true;
}

function clearAllBeatEnds() {
  if (!hasBeatTrim(settings.beatEnds, settings.beats) && !hasBeatSkip(settings.beatEnabled, settings.beats)) return false;
  settings.beatEnds = Array(32).fill(null);
  settings.beatEnabled = Array(32).fill(true);
  renderBeatHeaders();
  renderTrim();
  renderMix();
  renderPreset();
  save();
  if (playing) sendTiming(false, false);
  return true;
}

function updateDragFromClientX(beat, clientX) {
  const rect = ui.ruler.getBoundingClientRect();
  const points = beatSnaps[beat];
  if (rect.width <= 0 || !points?.length) return;
  const beatWidth = rect.width / settings.beats;
  const beatLeft = rect.left + beat * beatWidth;
  const localRaw = Math.max(0, Math.min(1, (clientX - beatLeft) / beatWidth));
  let best = points[points.length - 1];
  let bestDistance = Infinity;
  for (const point of points) {
    const distance = Math.abs(point.ratio - localRaw);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  applyBeatEnd(beat, best.num === 1 && best.den === 1 ? null : [best.num, best.den], { saveState: false });
}

function onTrimPointerMove(event) {
  if (trimDragBeat < 0) return;
  updateDragFromClientX(trimDragBeat, event.clientX);
}

function finishTrimDrag() {
  if (trimDragBeat < 0) return;
  const beat = trimDragBeat;
  trimDragBeat = -1;
  window.removeEventListener('pointermove', onTrimPointerMove);
  window.removeEventListener('pointerup', finishTrimDrag);
  window.removeEventListener('pointercancel', finishTrimDrag);
  ui.trimHandles?.children[beat]?.classList.remove('dragging');
  delete ui.rhythmPanel.dataset.trimming;
  renderTrim();
  if (JSON.stringify(settings) !== trimDragBefore) {
    const end = normalizeBeatEnd(settings.beatEnds[beat]);
    const total = formatTotalBeats(settings.beatEnds, settings.beats, { beatEnabled: settings.beatEnabled });
    const label = end ? `${formatBeatTrimLabel(beat, end)} (${total})` : formatBeatTrimLabel(beat, null);
    pushUndo(trimDragBefore, { toast: label, label });
    save();
    ui.pulseFeedback.textContent = `${label}.`;
  }
}

function bindBeatTrimHandle(handle, beat) {
  handle.addEventListener('pointerenter', () => {
    trimPreviewBeat = beat;
    updateTrimPreview();
  });
  handle.addEventListener('pointerleave', () => {
    if (trimPreviewBeat === beat) {
      trimPreviewBeat = -1;
      updateTrimPreview();
    }
  });
  handle.addEventListener('focus', () => {
    trimPreviewBeat = beat;
    updateTrimPreview();
  });
  handle.addEventListener('blur', () => {
    if (trimPreviewBeat === beat) {
      trimPreviewBeat = -1;
      updateTrimPreview();
    }
  });
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || handle.disabled) return;
    closeMarkerMenu();
    trimDragBefore = JSON.stringify(settings);
    trimDragBeat = beat;
    handle.classList.add('dragging');
    ui.rhythmPanel.dataset.trimming = '';
    handle.setPointerCapture?.(event.pointerId);
    renderTrim();
    window.addEventListener('pointermove', onTrimPointerMove);
    window.addEventListener('pointerup', finishTrimDrag);
    window.addEventListener('pointercancel', finishTrimDrag);
  });
  handle.addEventListener('lostpointercapture', finishTrimDrag);
  handle.addEventListener('dblclick', () => {
    if (!normalizeBeatEnd(settings.beatEnds[beat])) return;
    const label = formatBeatTrimLabel(beat, null);
    undoable(() => applyBeatEnd(beat, null), label);
    ui.pulseFeedback.textContent = `${label}.`;
  });
  handle.addEventListener('keydown', (event) => {
    const points = beatSnaps[beat];
    if (handle.disabled || !points?.length) return;
    const current = normalizeBeatEnd(settings.beatEnds[beat]) ?? [1, 1];
    let target;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      target = points.findLast((point) => compareFractions([point.num, point.den], current) < 0);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      target = points.find((point) => compareFractions([point.num, point.den], current) > 0);
    } else if (event.key === 'Home') {
      target = points[0];
    } else if (event.key === 'End' || event.key === 'Backspace' || event.key === 'Delete') {
      target = points[points.length - 1];
    } else {
      return;
    }
    event.preventDefault();
    if (!target) return;
    const next = target.num === 1 && target.den === 1 ? null : [target.num, target.den];
    const label = formatBeatTrimLabel(beat, next);
    undoable(() => applyBeatEnd(beat, next));
    ui.pulseFeedback.textContent = `${label}.`;
  });
}

function ensureBeatTrimDom() {
  if (ui.trimRails && ui.trimRails.children.length !== settings.beats) {
    ui.trimRails.replaceChildren(...Array.from({ length: settings.beats }, (_, beat) => {
      const seg = document.createElement('span');
      seg.className = 'trim-rail-seg';
      seg.dataset.beat = beat;
      return seg;
    }));
  }
  if (ui.trimHandles && ui.trimHandles.children.length !== settings.beats) {
    ui.trimHandles.replaceChildren(...Array.from({ length: settings.beats }, (_, beat) => {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'trim-handle';
      handle.dataset.beat = beat;
      handle.dataset.focusKey = `trim-handle-${beat}`;
      handle.title = `Drag left to shorten beat ${beat + 1} (←/→ keys, double-click to reset)`;
      const grip = document.createElement('span');
      grip.className = 'trim-grip';
      grip.setAttribute('aria-hidden', 'true');
      const tip = document.createElement('span');
      tip.className = 'trim-tip';
      tip.setAttribute('aria-hidden', 'true');
      handle.append(grip, tip);
      bindBeatTrimHandle(handle, beat);
      return handle;
    }));
  }
  for (const lane of lanes) {
    if (lane.trimTails && lane.trimTails.children.length !== settings.beats) {
      lane.trimTails.replaceChildren(...Array.from({ length: settings.beats }, (_, beat) => {
        const tail = document.createElement('div');
        tail.className = 'trim-tail';
        tail.dataset.beat = beat;
        return tail;
      }));
    }
  }
}

function renderTrim() {
  settings.beatEnds = normalizeBeatEnds(settings.beatEnds, 32);
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  if (settings.beats > 0 && !settings.beatEnabled.slice(0, settings.beats).some(Boolean)) settings.beatEnabled[0] = true;
  ensureBeatTrimDom();
  const layout = beatLayout(settings.beats, settings.beatEnds, settings.beatEnabled);
  beatSnaps = Array.from({ length: settings.beats }, (_, beat) => makeBeatSnapPoints(settings.lanes, settings.beats, beat));
  ui.rhythmPanel.toggleAttribute('data-trimmed', layout.trimmed);
  ui.rhythmPanel.toggleAttribute('data-skipped', layout.skipped);
  ui.rulerRow?.toggleAttribute('data-trimmed', layout.shortened);
  if (ui.trimBadge && ui.trimLabel) {
    ui.trimBadge.hidden = !layout.shortened;
    const total = formatTotalBeats(settings.beatEnds, settings.beats, { beatEnabled: settings.beatEnabled });
    const activeCount = layout.enabled.filter(Boolean).length;
    ui.trimLabel.textContent = layout.trimmed ? total : layout.skipped ? `${activeCount}/${settings.beats} beats` : '';
    ui.trimBadge.toggleAttribute('data-skipped-only', layout.skipped && !layout.trimmed);
    const parts = [];
    layout.enabled.forEach((on, beat) => {
      if (!on) parts.push(`Beat ${beat + 1}: skipped`);
      else if (layout.ends[beat]) parts.push(`Beat ${beat + 1}: ${formatBeatTrim(layout.ends[beat])}`);
    });
    ui.trimBadge.title = layout.shortened ? `${parts.join(', ')} · Bar total: ${total}` : '';
  }
  for (let beat = 0; beat < settings.beats; beat++) {
    const skipped = !layout.enabled[beat];
    const end = skipped ? null : layout.ends[beat];
    const ratio = skipped ? 0 : layout.lengthsFloat[beat];
    const beatStartPct = 100 * beat / settings.beats;
    const beatWidthPct = 100 / settings.beats;
    const activeWidthPct = 100 * ratio / settings.beats;
    const cutPct = 100 * (beat + ratio) / settings.beats;
    const tailWidthPct = 100 * (1 - ratio) / settings.beats;
    const rail = ui.trimRails?.children[beat];
    if (rail) {
      rail.style.left = `${beatStartPct}%`;
      rail.style.width = `${skipped ? 0 : activeWidthPct}%`;
      rail.toggleAttribute('data-trimmed', Boolean(end));
      rail.toggleAttribute('data-skipped', skipped);
    }
    const handle = ui.trimHandles?.children[beat];
    if (handle) {
      const canTrim = !skipped && (beatSnaps[beat].length > 1 || Boolean(layout.ends[beat]));
      handle.hidden = !canTrim;
      handle.disabled = !canTrim;
      handle.style.left = `${cutPct}%`;
      handle.toggleAttribute('data-trimmed', Boolean(end));
      handle.toggleAttribute('data-flip', cutPct < 10);
      handle.setAttribute('aria-label', end
        ? `Beat ${beat + 1} end handle, trimmed to ${formatBeatTrim(end)}. Drag or use arrow keys to adjust, End to restore.`
        : `Beat ${beat + 1} end handle. Drag left or use arrow keys to shorten beat ${beat + 1}.`);
      const tip = handle.querySelector('.trim-tip');
      if (tip) tip.textContent = end ? formatBeatTrim(end) : 'Full';
    }
    for (const lane of lanes) {
      const tail = lane.trimTails?.children[beat];
      if (tail) {
        tail.style.left = `${skipped ? beatStartPct : cutPct}%`;
        tail.style.width = `${skipped ? beatWidthPct : tailWidthPct}%`;
        tail.toggleAttribute('data-skipped', skipped);
        tail.toggleAttribute('data-trimmed', !skipped && Boolean(end));
      }
    }
  }
  updateTrimPreview();
  lanes.forEach((lane, index) => {
    const profile = settings.lanes[index];
    lane.activeEvents = makeLaneCyclePhases(profile, settings.beats, layout.ends, layout.enabled);
    lane.pulses.forEach((pulse, hit) => {
      const onset = lane.onsets[hit];
      const beatSkipped = profile.span !== 'bar' && !layout.enabled[onset.beat];
      const active = isPulseActiveInBeat(onset, profile, layout.ends, layout.enabled);
      const frac = lane.beatFractions[hit];
      const beatEnd = layout.ends[onset.beat];
      pulse.toggleAttribute('data-skipped', beatSkipped);
      pulse.toggleAttribute('data-trimmed', !beatSkipped && !active);
      pulse.toggleAttribute('data-trim-target', Boolean(!beatSkipped && trimDragBeat === onset.beat && beatEnd && frac && frac[0] === beatEnd[0] && frac[1] === beatEnd[1]));
    });
    if (index > 0 && lane.beatCounts) {
      [...lane.beatCounts.children].forEach((stepper, beat) => {
        stepper.toggleAttribute('data-beat-skipped', !layout.enabled[beat]);
        stepper.toggleAttribute('data-beat-trimmed', layout.enabled[beat] && Boolean(layout.ends[beat]));
      });
    }
  });
}

function editLaneTiming(index, change) {
  editRhythmLane(settings.lanes[index], change);
  timingChanged({ rhythm: true });
}

// Off suspends a configured pattern. Restoring it keeps every count and edit.
function restoreLane(index) {
  const profile = settings.lanes[index];
  if (profile.enabled) return;
  profile.enabled = true;
  timingChanged({ rhythm: true });
}

// Choosing one count sets every beat of the row to it.
function setLaneCount(index, value) {
  const profile = settings.lanes[index];
  if (value === 0) {
    profile.enabled = false;
    timingChanged({ rhythm: true });
    return;
  }
  const count = clampInt(value, limits.pulses, profile.count);
  if (count === profile.count && !laneCustom(profile)) {
    restoreLane(index);
    return;
  }
  editLaneTiming(index, (lane) => {
    lane.count = count;
    lane.enabled = true;
    if (lane.span === 'beat') lane.beatCounts.fill(null);
  });
}

// Arrows on a mixed row move every beat by one, so › then ‹ returns to the
// same pattern. Below the lowest count the row turns Off and keeps its counts.
function shiftLane(index, delta) {
  const profile = settings.lanes[index];
  const counts = visibleCounts(profile);
  if (delta < 0 && Math.min(...counts) <= limits.pulses[0]) {
    profile.enabled = false;
    timingChanged({ rhythm: true });
    return;
  }
  if (delta > 0 && Math.max(...counts) >= limits.pulses[1]) return;
  editLaneTiming(index, (lane) => {
    lane.count = clampInt(lane.count + delta, limits.pulses, lane.count);
    for (let beat = 0; beat < settings.beats; beat++) {
      if (lane.beatCounts[beat] !== null) lane.beatCounts[beat] += delta;
    }
  });
}

function pulseName(lane, pulse) {
  if (lane === 0) return `Beat, beat ${pulse + 1}`;
  const onset = lanes[lane].onsets[pulse];
  return settings.lanes[lane].span === 'beat'
    ? `${laneNames[lane]}, beat ${onset.beat + 1}, subdivision ${onset.part + 1}`
    : `${laneNames[lane]}, click ${pulse + 1}`;
}
function markerSound(lane, pulse) {
  const profile = settings.lanes[lane];
  return profile.rests.includes(pulse) ? 'off' : profile.pulseSounds[pulse] ?? settings.sounds[lane];
}
function announceMarker(lane, pulse) {
  const sound = markerSound(lane, pulse);
  const accented = settings.lanes[lane].accents.includes(pulse);
  ui.pulseFeedback.textContent = `${pulseName(lane, pulse)} · ${sound === 'off' ? 'Rest' : soundNames.get(sound)}${accented && sound !== 'off' ? ' · Accent' : ''}`;
  void previewSound(lane, sound, accented);
}
function editPulse(lane, pulse, accentOnly = false) {
  const profile = settings.lanes[lane];
  const laneSound = settings.sounds[lane];
  undoable(() => {
    if (accentOnly) {
      if (profile.accents.includes(pulse)) profile.accents = profile.accents.filter((hit) => hit !== pulse);
      else profile.accents.push(pulse);
    } else if (lane === 0) {
      if (profile.rests.includes(pulse)) {
        profile.rests = profile.rests.filter((hit) => hit !== pulse);
        delete profile.pulseSounds[pulse];
        profile.accents = profile.accents.filter((hit) => hit !== pulse);
      } else if ((profile.pulseSounds[pulse] ?? laneSound) === laneSound) {
        if (!profile.accents.includes(pulse)) {
          delete profile.pulseSounds[pulse];
          profile.accents.push(pulse);
        } else {
          profile.accents = profile.accents.filter((hit) => hit !== pulse);
          profile.pulseSounds[pulse] = laneSound === 'kick' ? 'hat' : 'kick';
        }
      } else if (!profile.accents.includes(pulse)) {
        profile.accents.push(pulse);
      } else {
        profile.rests.push(pulse);
        profile.accents = profile.accents.filter((hit) => hit !== pulse);
      }
    } else if (profile.rests.includes(pulse)) {
      profile.rests = profile.rests.filter((hit) => hit !== pulse);
      delete profile.pulseSounds[pulse];
    } else if ((profile.pulseSounds[pulse] ?? laneSound) === laneSound) {
      profile.pulseSounds[pulse] = lane === 1 && laneSound !== 'cowbell' ? 'cowbell' : laneSound === 'kick' ? 'hat' : 'kick';
    } else {
      profile.rests.push(pulse);
    }
    mixChanged();
  });
  announceMarker(lane, pulse);
}

// Marker menu: every sound, rest and accent for one marker. Right-click,
// long-press or the keyboard context-menu key opens it.
let menuTarget = null;
let pressTimer = 0;
let pressStart = null;
let suppressClick = false;
const chipNames = { default: 'Row sound', click: 'Click', hat: 'Hi-hat', off: 'Rest' };
for (const [id, label] of pulseSoundOptions) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'sound-chip';
  chip.dataset.sound = id;
  chip.textContent = chipNames[id] ?? label;
  chip.setAttribute('aria-pressed', 'false');
  chip.addEventListener('click', () => setMarkerSound(id));
  ui.markerSounds.append(chip);
}
function clearPress() {
  clearTimeout(pressTimer);
  pressTimer = 0;
  pressStart = null;
}
function bindMarker(button, lane, pulse) {
  button.addEventListener('click', (event) => {
    // A long-press already opened the menu; its release must not also cycle.
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    suppressClick = false;
    editPulse(lane, pulse, event.shiftKey);
  });
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    clearPress();
    openMarkerMenu(lane, pulse);
  });
  button.addEventListener('pointerdown', (event) => {
    suppressClick = false;
    if (event.pointerType === 'mouse') return;
    clearPress();
    pressStart = { x: event.clientX, y: event.clientY };
    pressTimer = setTimeout(() => {
      pressTimer = 0;
      suppressClick = true;
      openMarkerMenu(lane, pulse);
    }, 450);
  });
  button.addEventListener('pointermove', (event) => {
    if (pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) clearPress();
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, clearPress);
}
function renderMarkerMenu() {
  if (!menuTarget) return;
  const { lane, pulse } = menuTarget;
  const profile = settings.lanes[lane];
  const current = profile.rests.includes(pulse) ? 'off' : profile.pulseSounds[pulse] ?? 'default';
  ui.markerMenu.dataset.lane = lane;
  ui.markerMenuTitle.textContent = pulseName(lane, pulse);
  for (const chip of ui.markerSounds.children) chip.setAttribute('aria-pressed', chip.dataset.sound === current);
  ui.markerAccent.setAttribute('aria-pressed', !profile.rests.includes(pulse) && profile.accents.includes(pulse));
  if (ui.markerTrim) {
    const onset = lanes[lane].onsets[pulse];
    const frac = lanes[lane].beatFractions[pulse];
    const valid = Boolean(onset && frac && frac[0] > 0);
    const active = valid && sameBeatEnd(settings.beatEnds[onset.beat], frac);
    ui.markerTrim.disabled = !valid;
    ui.markerTrim.setAttribute('aria-pressed', active);
    ui.markerTrim.textContent = valid
      ? active ? `Restore beat ${onset.beat + 1}` : `End beat ${onset.beat + 1} here`
      : 'End beat here';
    ui.markerTrim.title = !valid ? 'Choose a subdivision tick to shorten its beat'
      : active ? `Restore beat ${onset.beat + 1} to full length`
      : `End beat ${onset.beat + 1} at ${formatBeatTrim(frac)}`;
  }
}
function positionMarkerMenu() {
  const target = lanes[menuTarget.lane].pulses[menuTarget.pulse];
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const menu = ui.markerMenu;
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const viewWidth = document.documentElement.clientWidth || window.innerWidth;
  const bottomGuard = viewWidth <= 680 ? 78 : 8;
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, viewWidth - width - 8));
  const placedAbove = rect.bottom + 8 + height > window.innerHeight - bottomGuard && rect.top - height - 8 > 8;
  const top = placedAbove ? rect.top - height - 8 : rect.bottom + 8;
  menu.dataset.placement = placedAbove ? 'above' : 'below';
  menu.style.setProperty('--menu-origin-x', `${Math.max(16, Math.min(width - 16, Math.round(rect.left + rect.width / 2 - left)))}px`);
  menu.style.left = `${left + window.scrollX}px`;
  menu.style.top = `${top + window.scrollY}px`;
}
function openMarkerMenu(lane, pulse) {
  closeBeatMenu();
  menuTarget = { lane, pulse };
  renderMarkerMenu();
  ui.markerMenu.hidden = false;
  positionMarkerMenu();
  (ui.markerSounds.querySelector('[aria-pressed="true"]') ?? ui.markerSounds.firstElementChild).focus({ preventScroll: true });
}
function closeMarkerMenu(returnFocus = false) {
  if (!menuTarget) return;
  const target = lanes[menuTarget.lane].pulses[menuTarget.pulse];
  menuTarget = null;
  ui.markerMenu.hidden = true;
  if (returnFocus) target?.focus({ preventScroll: true });
}
ui.markerMenuClose?.addEventListener('click', () => closeMarkerMenu(true));
function setMarkerSound(sound) {
  if (!menuTarget) return;
  const { lane, pulse } = menuTarget;
  const profile = settings.lanes[lane];
  undoable(() => {
    if (sound === 'off') {
      if (!profile.rests.includes(pulse)) profile.rests.push(pulse);
    } else {
      profile.rests = profile.rests.filter((hit) => hit !== pulse);
      if (sound === 'default') delete profile.pulseSounds[pulse];
      else profile.pulseSounds[pulse] = sound;
    }
    mixChanged();
  });
  renderMarkerMenu();
  announceMarker(lane, pulse);
}
ui.markerAccent.addEventListener('click', () => {
  if (!menuTarget) return;
  const { lane, pulse } = menuTarget;
  const profile = settings.lanes[lane];
  if (profile.rests.includes(pulse)) {
    undoable(() => {
      profile.rests = profile.rests.filter((hit) => hit !== pulse);
      if (!profile.accents.includes(pulse)) profile.accents.push(pulse);
      mixChanged();
    });
    announceMarker(lane, pulse);
  } else {
    editPulse(lane, pulse, true);
  }
  renderMarkerMenu();
});
ui.markerTrim?.addEventListener('click', () => {
  if (!menuTarget) return;
  const { lane, pulse } = menuTarget;
  const onset = lanes[lane].onsets[pulse];
  const frac = lanes[lane].beatFractions[pulse];
  if (!onset || !frac || frac[0] <= 0) return;
  const next = sameBeatEnd(settings.beatEnds[onset.beat], frac) ? null : frac;
  const label = formatBeatTrimLabel(onset.beat, next);
  undoable(() => applyBeatEnd(onset.beat, next), label);
  ui.pulseFeedback.textContent = `${label}.`;
});
ui.trimReset?.addEventListener('click', () => {
  if (!hasBeatTrim(settings.beatEnds, settings.beats) && !hasBeatSkip(settings.beatEnabled, settings.beats)) return;
  undoable(() => clearAllBeatEnds(), 'Full bar restored');
  ui.pulseFeedback.textContent = 'Full bar restored.';
});
window.addEventListener('resize', () => { closeMarkerMenu(); closeBeatMenu(); });

function renderMix() {
  lanes.forEach((lane, index) => {
    const profile = settings.lanes[index];
    const rowMuted = index > 0 && profile.muted === true;
    lane.sound.value = rowMuted ? 'mute' : settings.sounds[index];
    if (lane.rowSound) {
      lane.rowSound.value = rowMuted ? 'mute' : settings.sounds[index];
      lane.rowSound.dataset.sound = rowMuted ? 'off' : settings.sounds[index];
    }
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
      const skipped = pulse.hasAttribute('data-skipped');
      const trimmed = pulse.hasAttribute('data-trimmed');
      const label = `${pulseName(index, hit)} · ${rest ? 'Rest' : soundNames.get(sound ?? settings.sounds[index])}${!rest && accented ? ' · Accent' : ''}${skipped ? ' · Skipped' : trimmed ? ' · Trimmed' : ''}`;
      pulse.dataset.sound = rest ? 'off' : sound ?? 'default';
      pulse.toggleAttribute('data-accented', accented);
      pulse.setAttribute('aria-label', label);
      pulse.title = index === 0
        ? `${label} · Click to cycle normal, main accent, alt sound, and rest; right-click for all sounds`
        : `${label} · Click to cycle, right-click for more`;
    });
  });
  renderMarkerMenu();
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
  renderReset();
  if (hasBeatTrim(settings.beatEnds, settings.beats) || hasBeatSkip(settings.beatEnabled, settings.beats)) { ui.preset.value = ''; return; }
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

function applyGrouping(grouping) {
  undoable(() => {
    settings.grouping = grouping;
    const starts = groupStarts(grouping);
    settings.lanes.forEach((profile) => {
      if (profile.span === 'beat' && !profile.offbeatsOnly) profile.accents = makeLanePulses({ ...profile, enabled: true }, settings.beats)
        .filter((hit) => hit.part === 0 && starts.includes(hit.beat)).map((hit) => hit.index);
    });
    renderMeter();
    mixChanged();
  }, grouping.length === 1 ? 'Grouping cleared' : `Grouping ${grouping.join('+')} applied`);
  renderMeter();
  ui.pulseFeedback.textContent = 'Grouping applied to per-note rhythms.';
}

for (const [value, label] of tempoBeats) ui.tempoBeat.add(new Option(label, value));
ui.tempoBeat.value = settings.tempoBeat;
for (let beats = 1; beats <= 32; beats++) ui.beats.add(new Option(beats, beats));
for (const unit of beatUnits) ui.unit.add(new Option(unit, unit));
for (const preset of rhythmPresets) ui.preset.add(new Option(preset.label, preset.id));
ui.preset.addEventListener('change', () => {
  const preset = rhythmPresets.find((value) => value.id === ui.preset.value);
  if (!preset) return;
  undoable(() => {
    const meter = settings.beats !== preset.beats || settings.unit !== preset.unit;
    settings.beats = preset.beats;
    settings.unit = preset.unit;
    settings.grouping = [...preset.groups];
    settings.beatEnds = Array(32).fill(null);
    settings.beatEnabled = Array(32).fill(true);
    settings.lanes = presetLanes(preset);
    if (beatClipboard?.sourceBeat != null && beatClipboard.sourceBeat >= settings.beats) beatClipboard.sourceBeat = null;
    renderMeter();
    timingChanged({ meter, rhythm: true });
  }, `Loaded ${preset.label}`);
});
ui.tempoBeat.addEventListener('change', () => undoable(() => {
  settings.tempoBeat = Number(ui.tempoBeat.value);
  taps = [];
  renderTempoUnit();
  timingChanged();
}));
ui.beats.addEventListener('change', () => undoable(() => {
  settings.beats = Number(ui.beats.value);
  settings.grouping = [settings.beats];
  settings.beatEnds = Array(32).fill(null);
  settings.beatEnabled = normalizeBeatEnabled(settings.beatEnabled, 32);
  if (!settings.beatEnabled.slice(0, settings.beats).some(Boolean)) settings.beatEnabled[0] = true;
  if (beatClipboard?.sourceBeat != null && beatClipboard.sourceBeat >= settings.beats) beatClipboard.sourceBeat = null;
  timingChanged({ meter: true });
}));
ui.unit.addEventListener('change', () => undoable(() => { settings.unit = Number(ui.unit.value); settings.beatEnds = Array(32).fill(null); timingChanged({ meter: true }); }));
ui.groupingChoice.addEventListener('change', () => {
  if (ui.groupingChoice.value === 'custom') {
    ui.groupingChoice.value = settings.grouping.join('+');
    ui.more.open = true;
    ui.grouping.focus();
    ui.grouping.select();
    return;
  }
  applyGrouping(ui.groupingChoice.value.split('+').map(Number));
});
ui.applyGrouping.addEventListener('click', () => {
  const grouping = parseGrouping(ui.grouping.value, settings.beats);
  ui.groupingError.hidden = Boolean(grouping);
  ui.grouping.setAttribute('aria-invalid', !grouping);
  if (!grouping) { ui.groupingError.textContent = `Use groups such as 2+2+3 that total ${settings.beats}.`; return; }
  applyGrouping(grouping);
});
ui.grouping.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); ui.applyGrouping.click(); } });
lanes.forEach((lane, index) => {
  for (const [id, label] of soundOptions) {
    lane.sound.add(new Option(label, id));
    lane.rowSound?.add(new Option(chipNames[id] ?? label, id));
  }
  if (index > 0) {
    lane.sound.add(new Option('Mute', 'mute'));
    lane.rowSound?.add(new Option('Mute', 'mute'));
  }
  const setRowSound = (sound) => {
    if (index > 0 && sound === 'mute') {
      undoable(() => { settings.lanes[index].muted = true; mixChanged(); });
      return;
    }
    undoable(() => {
      settings.sounds[index] = sound;
      if (index > 0 && settings.lanes[index].muted) settings.lanes[index].muted = false;
      mixChanged();
    });
    void previewSound(index, sound, index === 0 && settings.lanes[0].accents.includes(0));
  };
  lane.enabled?.addEventListener('click', () => undoable(() => {
    const profile = settings.lanes[index];
    if (index === 0) profile.enabled = !profile.enabled;
    else profile.muted = !profile.muted;
    mixChanged();
  }));
  lane.sound.addEventListener('change', () => setRowSound(lane.sound.value));
  lane.rowSound?.addEventListener('change', () => setRowSound(lane.rowSound.value));
  if (!lane.count) return;
  lane.count.addEventListener('change', () => {
    const value = lane.count.value;
    if (value === '') { renderRhythms(); return; }
    if (value === 'mix') { undoable(() => restoreLane(index)); return; }
    const count = Number(value);
    const custom = laneCustom(settings.lanes[index]);
    undoable(() => setLaneCount(index, count), custom && count > 0 ? `${laneNames[index]} set to ×${count} on every beat` : '');
  });
  lane.steps.forEach((button) => button.addEventListener('click', () => undoable(() => {
    const delta = Number(button.dataset.delta);
    if (delta > 0 && lane.count.value === '0' && lane.onsets.length) { restoreLane(index); return; }
    if (lane.count.value === 'mix') { shiftLane(index, delta); return; }
    let target = lane.count.selectedIndex + delta;
    if (lane.count.options[target]?.value === 'mix') target += delta;
    const option = lane.count.options[target];
    if (option) setLaneCount(index, Number(option.value));
  })));
  lane.span.addEventListener('change', () => undoable(() => editLaneTiming(index, (profile) => { profile.span = lane.span.value; })));
  lane.offbeats.addEventListener('change', () => undoable(() => editLaneTiming(index, (profile) => { profile.offbeatsOnly = lane.offbeats.checked; })));
});
ui.undo.addEventListener('click', undo);
ui.headerUndo?.addEventListener('click', undo);
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

// A trackpad sends many small wheel deltas per swipe. Count distance, not
// events, and let a page scroll that passes over the dial keep scrolling.
let wheelDistance = 0;
let lastWheel = -Infinity;
let lastPageScroll = -Infinity;
window.addEventListener('scroll', () => { lastPageScroll = performance.now(); }, { passive: true });
document.querySelector('.tempo-dial').addEventListener('wheel', (event) => {
  if (!event.deltaY) return;
  const now = performance.now();
  if (now - lastPageScroll < 400) return;
  if (now - lastWheel > 250) wheelDistance = 0;
  lastWheel = now;
  event.preventDefault();
  let steps;
  if (event.deltaMode !== 0 || Math.abs(event.deltaY) >= 50) {
    steps = Math.sign(event.deltaY);
    wheelDistance = 0;
  } else {
    wheelDistance += event.deltaY;
    steps = Math.trunc(wheelDistance / 50);
    wheelDistance -= steps * 50;
  }
  if (steps) setTempo(settings.bpm - steps * (event.shiftKey ? 5 : 1));
}, { passive: false });
ui.tap.addEventListener('click', tapTempo);
ui.play.addEventListener('click', togglePlayback);
window.addEventListener('pagehide', stop);
ui.countIn.addEventListener('change', () => undoable(() => { settings.countIn = ui.countIn.checked; save(); }));
ui.volume.addEventListener('input', () => { settings.outputVolume = ui.volume.valueAsNumber; settings.masterMuted = false; renderVolume(); save(); });
ui.muteAll.addEventListener('click', () => {
  if (settings.outputVolume === 0) { settings.outputVolume = defaultVolume; settings.masterMuted = false; }
  else settings.masterMuted = !settings.masterMuted;
  renderVolume(); save();
});
ui.scrolls.forEach((scroll) => scroll.addEventListener('scroll', () => {
  closeMarkerMenu();
  closeBeatMenu();
  if (!programmaticScroll) manualScrollUntil = performance.now() + 2000;
  for (const other of ui.scrolls) if (other !== scroll && other.scrollLeft !== scroll.scrollLeft) other.scrollLeft = scroll.scrollLeft;
}));
ui.rhythmPanel.addEventListener('wheel', (event) => {
  const scroll = ui.rulerScroll;
  if (!scroll || scroll.scrollWidth <= scroll.clientWidth) return;
  if (event.ctrlKey || event.metaKey || !event.deltaY) return;
  const pageCanScrollY = document.documentElement.scrollHeight > window.innerHeight + 2;
  const wantsHorizontal = event.shiftKey || (!pageCanScrollY && Math.abs(event.deltaY) > Math.abs(event.deltaX));
  if (!wantsHorizontal) return;
  event.preventDefault();
  manualScrollUntil = performance.now() + 2000;
  setTimelineScroll(scroll.scrollLeft + event.deltaY, false);
}, { passive: false });

// After a mouse or touch press, Space belongs to Start/Stop rather than
// repeating the button, checkbox or slider the press happened to focus.
// Keyboard focus (Tab) keeps native Space on every control.
let pointerFocus = false;
document.addEventListener('pointerdown', (event) => {
  pointerFocus = true;
  if (menuTarget && !ui.markerMenu.contains(event.target)) closeMarkerMenu();
  if (beatMenuTarget >= 0 && !ui.beatMenu.contains(event.target) && !event.target.closest('.beat-more')) closeBeatMenu();
}, true);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') pointerFocus = false;
  if (ui.shareDialog?.open) return;
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
      !event.target.closest('input:not([type="range"]):not([type="checkbox"]), textarea, [contenteditable]')) {
    const key = event.key.toLowerCase();
    if (key === 'z') {
      if (undoStack.length) { event.preventDefault(); undo(); }
      return;
    }
    const beatHead = event.target.closest?.('.beat-head');
    if (beatHead && (key === 'c' || key === 'v')) {
      const beat = Number(beatHead.dataset.beat);
      if (key === 'c') {
        event.preventDefault();
        copyBeat(beat);
        return;
      }
      if (key === 'v' && beatClipboard) {
        event.preventDefault();
        pasteOntoBeat(beat);
        return;
      }
    }
  }
  if (event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return;
  if (event.key === 'Escape') {
    if (menuTarget) { closeMarkerMenu(true); event.preventDefault(); return; }
    if (beatMenuTarget >= 0) { closeBeatMenu(true); event.preventDefault(); return; }
    if (beatClipboard) { clearBeatClipboard(true); event.preventDefault(); return; }
  }
  if (event.target.closest('input:not([type="range"]):not([type="checkbox"]), select, textarea, [contenteditable]')) return;
  if (event.key === '+' || event.key === '=' || event.key === '-') { event.preventDefault(); setTempo(settings.bpm + (event.key === '-' ? -5 : 5)); return; }
  if (event.code === 'Space') {
    const control = event.target.closest('button, input, select, textarea, a, summary, [contenteditable]');
    const pressed = pointerFocus && control?.matches('button, summary, input[type="checkbox"], input[type="range"]');
    if (control && !pressed) return;
    event.preventDefault();
    if (!event.repeat) togglePlayback();
    return;
  }
  if (event.repeat) return;
  if (event.key.toLowerCase() === 't') tapTempo();
});

ui.countIn.checked = settings.countIn;
displayTempo(settings.bpm);
renderTempoUnit();
renderMeter();
renderRhythms();
renderPreset();
renderUndo();
renderVolume();
if (isEmbed) {
  if (ui.embedMore) ui.embedMore.hidden = false;
  const postEmbedHeight = () => {
    const h = Math.ceil(document.documentElement.scrollHeight);
    try { window.parent.postMessage({ type: 'oddmeter:resize', height: h }, window.location.origin); } catch { /* Ignore */ }
  };
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(postEmbedHeight).observe(document.body);
  }
  window.addEventListener('load', postEmbedHeight);
  postEmbedHeight();
}
if (setupHash && !shared) showMessage('This setup link could not be loaded.');
else updateSetupUrl();
