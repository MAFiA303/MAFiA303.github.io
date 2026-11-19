import { eventFrame, hasBeatTrim, makeCycle, makeRhythmCycle, makeSubdivisionCycle, measureSeconds, normalizeBeatEnds } from './rhythm.js?v=trim2';
import { makeSoundBank } from './sounds.js';

const regularGain = 0.68;
const accentGain = 0.94;
const limiterThreshold = 0.8;
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
    const wave = selected instanceof Float32Array ? selected : this.bank.click[lane][Number(accented)];
    this.voices.push({ frame: Math.max(currentFrame, frame), wave, gain: accented ? accentGain : regularGain });
  }

  postClock(id, countIn, beatEnds) {
    const { origin, duration, countDuration, countStart } = this.clock;
    this.port.postMessage({
      id, origin, duration, countStart, countIn,
      ...(beatEnds ? { beatEnds, countDuration } : {}),
    });
  }

  startClock(frame, { id, settings, countIn, restart = false }) {
    const beatEnds = hasBeatTrim(settings.beatEnds, settings.beats) ? normalizeBeatEnds(settings.beatEnds, settings.beats) : null;
    const fullDuration = measureSeconds({ ...settings, beatEnds: null }) * sampleRate;
    const duration = measureSeconds({ ...settings, beatEnds }) * sampleRate;
    const events = settings.lanes ? makeRhythmCycle(settings.lanes, settings.beats, beatEnds)
      : settings.beatDivisions ? makeSubdivisionCycle(settings.beatDivisions) : makeCycle(settings.pulses);
    const trimKey = beatEnds ? JSON.stringify(beatEnds) : 'full';
    const key = JSON.stringify([settings.beats, settings.unit, trimKey, settings.lanes ?? settings.beatDivisions ?? settings.pulses]);
    const sameMeter = this.clock?.beats === settings.beats && this.clock?.unit === settings.unit;
    const sameTrim = (this.clock?.trimKey ?? 'full') === trimKey;
    // A live edit must keep the remaining count-in, including its current beat.
    // Retiming the count-in from its phase also lets tempo taps work before bar 1.
    if (!restart && !countIn && sameMeter && frame < this.clock.origin) {
      const prevCountDuration = this.clock.countDuration ?? this.clock.duration;
      const progress = (frame - this.clock.countStart) / prevCountDuration;
      const countStart = Math.round(frame - progress * fullDuration);
      const origin = countStart + Math.round(fullDuration);
      Object.assign(this.clock, { key, trimKey, countStart, countDuration: fullDuration, origin, duration, events });
      this.postClock(id, true, beatEnds);
      return;
    }
    if (!restart && !countIn && this.clock && frame >= this.clock.origin) {
      const progress = (frame - this.clock.origin) / this.clock.duration;
      if (this.clock.key === key) {
        const origin = Math.round(frame - progress * duration);
        this.clock.origin = origin;
        this.clock.duration = duration;
        this.clock.countDuration = fullDuration;
        this.postClock(id, false, beatEnds);
        return;
      }
      if (sameMeter && sameTrim) {
        const origin = Math.round(frame - progress * duration);
        const measure = Math.floor(progress);
        const nextEvent = events.findIndex((event) => eventFrame(origin, measure, duration, event.phase) >= frame);
        this.clock = {
          key,
          trimKey,
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
        };
        this.postClock(id, false, beatEnds);
        return;
      }
      if (sameMeter) {
        // Trimming or restoring a beat keeps the current bar's downbeat
        // anchored in real time instead of shifting existing beats.
        const barStart = this.clock.origin + Math.floor(progress) * this.clock.duration;
        const elapsed = frame - barStart;
        const inside = elapsed >= 0 && elapsed < duration;
        const origin = inside ? Math.round(barStart) : frame;
        const nextEvent = inside ? events.findIndex((event) => eventFrame(origin, 0, duration, event.phase) >= frame) : 0;
        this.clock = {
          key,
          trimKey,
          beats: settings.beats,
          unit: settings.unit,
          origin,
          duration,
          countDuration: fullDuration,
          events,
          measure: nextEvent === -1 ? 1 : 0,
          event: nextEvent === -1 ? 0 : nextEvent,
          countStart: this.clock.countStart,
          countBeat: 0,
          countBeats: 0,
        };
        this.postClock(id, false, beatEnds);
        return;
      }
    }

    const origin = frame + (countIn ? Math.round(fullDuration) : 0);
    this.clock = {
      key,
      trimKey,
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
    };
    this.postClock(id, countIn, beatEnds);
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
