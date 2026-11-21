import { beatLayout, eventFrame, hasBeatRepeats, hasBeatSkip, hasBeatTrim, makeCycle, makeRhythmCycle, makeSubdivisionCycle, measureSeconds, normalizeBeatEnabled, normalizeBeatEnds, normalizeBeatRepeats, playbackSequence } from './rhythm.js?v=repeat1';
import { makeSoundBank } from './sounds.js?v=audio1';

const regularGain = 0.45;
const accentGain = 1.0;
const limiterThreshold = 0.88;
const limiterHeadroom = 1 - limiterThreshold;

class ClickProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'volume', defaultValue: 1, minValue: 0, maxValue: 2 }];
  }

  constructor() {
    super();
    this.bank = makeSoundBank(sampleRate);
    this.voices = [];
    this.clock = null;
    this.pending = null;
    this.preview = null;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'stop') {
        this.clock = null;
        this.pending = null;
        this.preview = null;
        this.voices.length = 0;
      } else if (data.type === 'timing') {
        this.pending = data;
        this.mix = data.mix;
        this.preview = null;
      } else if (data.type === 'mix') {
        this.mix = data.mix;
      } else if (data.type === 'preview' && !this.clock && !this.pending) {
        this.preview = data;
      }
    };
  }

  addVoice(frame, lane, accented, sound = this.mix?.sounds?.[lane]) {
    if (sound === 'off') return;
    const selected = this.bank[sound];
    const wave = selected instanceof Float32Array ? selected
      : Array.isArray(selected) && selected[0] instanceof Float32Array ? selected[Number(accented)]
      : this.bank.click[lane][Number(accented)];
    this.voices.push({ frame: Math.max(currentFrame, frame), wave, gain: accented ? accentGain : regularGain });
  }

  postClock(id, countIn, beatEnds, beatEnabled, beatRepeats) {
    const { origin, duration, countDuration, countStart, carry } = this.clock;
    this.port.postMessage({
      id, origin, duration, countStart, countIn,
      ...(beatEnds ? { beatEnds } : {}),
      ...(beatEnabled ? { beatEnabled } : {}),
      ...(beatRepeats ? { beatRepeats } : {}),
      ...(beatEnds || beatEnabled || beatRepeats ? { countDuration } : {}),
      ...(carry ? { carry } : {}),
    });
  }

  startClock(frame, { id, settings, countIn, restart = false }) {
    const beatEnds = hasBeatTrim(settings.beatEnds, settings.beats) ? normalizeBeatEnds(settings.beatEnds, settings.beats) : null;
    const beatEnabled = hasBeatSkip(settings.beatEnabled, settings.beats) ? normalizeBeatEnabled(settings.beatEnabled, settings.beats) : null;
    const beatRepeats = hasBeatRepeats(settings.beatRepeats, settings.beats) ? normalizeBeatRepeats(settings.beatRepeats, settings.beats) : null;
    const fullDuration = measureSeconds({ ...settings, beatEnds: null, beatEnabled: null, beatRepeats: null }) * sampleRate;
    const duration = measureSeconds({ ...settings, beatEnds, beatEnabled, beatRepeats }) * sampleRate;
    const events = settings.lanes ? makeRhythmCycle(settings.lanes, settings.beats, beatEnds, beatEnabled, beatRepeats)
      : settings.beatDivisions ? makeSubdivisionCycle(settings.beatDivisions) : makeCycle(settings.pulses);
    const trimKey = beatEnds || beatEnabled || beatRepeats ? JSON.stringify([beatEnds, beatEnabled, beatRepeats]) : 'full';
    const key = JSON.stringify([settings.beats, settings.unit, trimKey, settings.lanes ?? settings.beatDivisions ?? settings.pulses]);
    const sameMeter = this.clock?.beats === settings.beats && this.clock?.unit === settings.unit;
    const sameTrim = (this.clock?.trimKey ?? 'full') === trimKey;
    const hasActiveCarry = Boolean(this.clock?.carry && frame < this.clock.carry.end);
    // A live edit must keep the remaining count-in, including its current beat.
    // Retiming the count-in from its phase also lets tempo taps work before bar 1.
    if (!restart && !countIn && sameMeter && this.clock.countBeats > 0 && frame < this.clock.origin) {
      const prevCountDuration = this.clock.countDuration ?? this.clock.duration;
      const progress = (frame - this.clock.countStart) / prevCountDuration;
      const countStart = Math.round(frame - progress * fullDuration);
      const origin = countStart + Math.round(fullDuration);
      Object.assign(this.clock, { key, trimKey, beatEnds, beatEnabled, beatRepeats, countStart, countDuration: fullDuration, origin, duration, events, carry: null });
      this.postClock(id, true, beatEnds, beatEnabled, beatRepeats);
      return;
    }
    if (!restart && !countIn && this.clock && (frame >= this.clock.origin || hasActiveCarry)) {
      if (!hasActiveCarry && this.clock.key === key) {
        const progress = (frame - this.clock.origin) / this.clock.duration;
        const origin = Math.round(frame - progress * duration);
        this.clock.origin = origin;
        this.clock.duration = duration;
        this.clock.countDuration = fullDuration;
        this.clock.carry = null;
        this.postClock(id, false, beatEnds, beatEnabled, beatRepeats);
        return;
      }
      if (!hasActiveCarry && sameMeter && sameTrim) {
        const progress = (frame - this.clock.origin) / this.clock.duration;
        const origin = Math.round(frame - progress * duration);
        const measure = Math.floor(progress);
        const nextEvent = events.findIndex((event) => eventFrame(origin, measure, duration, event.phase) >= frame);
        this.clock = {
          key,
          trimKey,
          beatEnds,
          beatEnabled,
          beatRepeats,
          beats: settings.beats,
          unit: settings.unit,
          origin,
          duration,
          countDuration: fullDuration,
          events,
          measure: nextEvent === -1 ? measure + 1 : measure,
          event: nextEvent === -1 ? 0 : nextEvent,
          countStart: this.clock.countStart,
          countBeat: 0,
          countBeats: 0,
          carry: null,
        };
        this.postClock(id, false, beatEnds, beatEnabled, beatRepeats);
        return;
      }
      if (sameMeter) {
        // Preserve the current beat, pass, and local position in real time:
        // changes behind the playhead take effect on the next cycle, while
        // changes ahead of the playhead take effect as playback reaches them.
        const prevBeatSamples = (this.clock.countDuration ?? this.clock.duration) / this.clock.beats;
        const prevSeq = playbackSequence(this.clock.beats, this.clock.beatEnds, this.clock.beatEnabled, this.clock.beatRepeats);
        let curBeat;
        let curPass = 1;
        let localOffset;
        if (hasActiveCarry) {
          curBeat = this.clock.carry.beat;
          localOffset = Math.max(0, Math.min(this.clock.carry.len, (frame - this.clock.carry.start) / prevBeatSamples));
        } else {
          const progress = (frame - this.clock.origin) / this.clock.duration;
          const barPhase = ((progress % 1) + 1) % 1;
          const prevBeatTime = barPhase * prevSeq.totalFloat;
          let activeStep = prevSeq.steps[prevSeq.steps.length - 1];
          for (const step of prevSeq.steps) {
            if (prevBeatTime < step.startFloat + step.lenFloat) {
              activeStep = step;
              break;
            }
          }
          curBeat = activeStep.beat;
          curPass = activeStep.pass;
          localOffset = Math.max(0, prevBeatTime - activeStep.startFloat);
        }
        const newSeq = playbackSequence(settings.beats, beatEnds, beatEnabled, beatRepeats);
        const newLayout = newSeq.layout;
        const beatSamples = fullDuration / settings.beats;
        let origin;
        let measure;
        let eventIndex;
        let carry = null;
        if (newLayout.enabled[curBeat]) {
          const matching = newSeq.steps.filter((step) => step.beat === curBeat);
          const targetStep = matching[Math.min(curPass - 1, matching.length - 1)] ?? newSeq.steps[0];
          const newLen = targetStep.lenFloat;
          const clampedLocal = Math.min(localOffset, newLen);
          const newBeatTime = targetStep.startFloat + clampedLocal;
          origin = Math.round(frame - newBeatTime * beatSamples);
          if (localOffset >= newLen) {
            const targetPhase = newBeatTime / newSeq.totalFloat;
            const nextEvent = targetPhase >= 1 - 1e-9 ? -1 : events.findIndex((event) => event.phase >= targetPhase - 1e-9);
            measure = nextEvent === -1 ? 1 : 0;
            eventIndex = nextEvent === -1 ? 0 : nextEvent;
          } else {
            const nextEvent = events.findIndex((event) => eventFrame(origin, 0, duration, event.phase) >= frame);
            measure = nextEvent === -1 ? 1 : 0;
            eventIndex = nextEvent === -1 ? 0 : nextEvent;
          }
        } else {
          const prevLen = hasActiveCarry ? this.clock.carry.len : prevSeq.layout.lengthsFloat[curBeat];
          const beatStart = Math.round(frame - localOffset * beatSamples);
          const boundaryFrame = Math.round(beatStart + prevLen * beatSamples);
          carry = { beat: curBeat, start: beatStart, end: boundaryFrame, len: prevLen };
          const nextStep = newSeq.steps.find((step) => step.beat > curBeat);
          if (nextStep) {
            const targetPhase = nextStep.startFloat / newSeq.totalFloat;
            origin = Math.round(boundaryFrame - targetPhase * duration);
            const nextEvent = events.findIndex((event) => event.phase >= targetPhase - 1e-9);
            measure = nextEvent === -1 ? 1 : 0;
            eventIndex = nextEvent === -1 ? 0 : nextEvent;
          } else {
            origin = boundaryFrame;
            measure = 0;
            eventIndex = 0;
          }
        }
        this.clock = {
          key,
          trimKey,
          beatEnds,
          beatEnabled,
          beatRepeats,
          beats: settings.beats,
          unit: settings.unit,
          origin,
          duration,
          countDuration: fullDuration,
          events,
          measure,
          event: eventIndex,
          countStart: this.clock.countStart,
          countBeat: 0,
          countBeats: 0,
          carry,
        };
        this.postClock(id, false, beatEnds, beatEnabled, beatRepeats);
        return;
      }
    }

    const origin = frame + (countIn ? Math.round(fullDuration) : 0);
    this.clock = {
      key,
      trimKey,
      beatEnds,
      beatEnabled,
      beatRepeats,
      beats: settings.beats,
      unit: settings.unit,
      origin,
      duration,
      countDuration: fullDuration,
      events,
      measure: 0,
      event: 0,
      countStart: frame,
      countBeat: 0,
      countBeats: countIn ? settings.beats : 0,
      carry: null,
    };
    this.postClock(id, countIn, beatEnds, beatEnabled, beatRepeats);
  }

  schedule(blockEnd) {
    const clock = this.clock;
    if (!clock) return;

    const countDuration = clock.countDuration ?? clock.duration;
    while (clock.countBeat < clock.countBeats) {
      const frame = eventFrame(clock.countStart, 0, countDuration, clock.countBeat / clock.countBeats);
      if (frame >= blockEnd) return;
      this.addVoice(frame, 0, clock.countBeat === 0);
      clock.countBeat++;
    }

    if (!clock.events.length) return;

    while (true) {
      const event = clock.events[clock.event];
      const frame = eventFrame(clock.origin, clock.measure, clock.duration, event.phase);
      if (frame >= blockEnd) return;

      for (const { lane, index } of event.hits) {
        if (this.mix.muted[lane]) continue;
        this.addVoice(frame, lane, this.mix.accents[lane].includes(index), this.mix.pulseSounds?.[lane]?.[index]);
      }
      clock.event++;
      if (clock.event === clock.events.length) {
        clock.event = 0;
        clock.measure++;
      }
    }
  }

  process(_inputs, [[output]], { volume }) {
    if (!output) return true;
    if (this.pending) {
      this.startClock(currentFrame, this.pending);
      this.pending = null;
    }
    if (this.preview) {
      const { lane, accented, sound } = this.preview;
      this.addVoice(currentFrame, lane, accented, sound);
      this.preview = null;
    }

    const blockEnd = currentFrame + output.length;
    this.schedule(blockEnd);
    output.fill(0);
    let kept = 0;
    for (const voice of this.voices) {
      const end = Math.min(blockEnd, voice.frame + voice.wave.length);
      for (let frame = Math.max(currentFrame, voice.frame); frame < end; frame++) {
        output[frame - currentFrame] += voice.wave[frame - voice.frame] * voice.gain;
      }
      if (voice.frame + voice.wave.length > blockEnd) this.voices[kept++] = voice;
    }
    this.voices.length = kept;
    for (let index = 0; index < output.length; index++) {
      const value = output[index] * volume[volume.length === 1 ? 0 : index];
      const over = Math.abs(value) - limiterThreshold;
      output[index] = over > 0
        ? Math.sign(value) * (limiterThreshold + limiterHeadroom * over / (limiterHeadroom + over))
        : value;
    }
    return true;
  }
}

registerProcessor('oddmeter-click', ClickProcessor);
