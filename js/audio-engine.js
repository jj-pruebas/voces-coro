import * as Tone from 'https://esm.sh/tone@14.9.17';
import { SEMITONE_MIN, SEMITONE_MAX } from './constants.js';

// Pieza de mayor riesgo técnico del proyecto: pitch-shift en tiempo real en
// Safari iOS. Cada pista usa Player -> PitchShift -> Channel (vol/mute/solo).
// Todas las pistas se sincronizan vía Tone.Transport para que "reproducir
// todo" empiece exactamente igual en las 3 voces.
//
// Si en el iPhone real la calidad de Tone.PitchShift no convence fuera del
// rango cómodo (±6 semitonos), la ruta de escape es sustituir SOLO el nodo
// `pitchShift` por un AudioWorkletNode de SoundTouchJS conectado entre
// `player` y `channel`, sin tocar el resto de esta clase ni la UI.

export class VoiceTrack {
  constructor(url) {
    this.url = url;
    this.pitchShift = new Tone.PitchShift({ pitch: 0, windowSize: 0.06 });
    this.channel = new Tone.Channel({ volume: 0, mute: false }).toDestination();
    this.player = new Tone.Player({ url, loop: false });
    this.player.chain(this.pitchShift, this.channel);
    this._loadPromise = null;
  }

  async load() {
    if (!this._loadPromise) this._loadPromise = this.player.loaded ? Promise.resolve() : Tone.loaded();
    await this._loadPromise;
    return this;
  }

  syncToTransport() {
    this.player.sync().start(0);
  }

  setSemitones(n) {
    const clamped = Math.max(SEMITONE_MIN, Math.min(SEMITONE_MAX, n));
    this.pitchShift.pitch = clamped;
    return clamped;
  }

  setVolumeDb(db) {
    this.channel.volume.value = db;
  }

  setMute(muted) {
    this.channel.mute = muted;
  }

  setSolo(solo) {
    this.channel.solo = solo;
  }

  get duration() {
    return this.player.buffer ? this.player.buffer.duration : 0;
  }

  dispose() {
    this.player.unsync();
    this.player.dispose();
    this.pitchShift.dispose();
    this.channel.dispose();
  }
}

export class SongPlayer {
  constructor() {
    this.tracks = new Map(); // slot -> VoiceTrack
    this._started = false;
  }

  async addTrack(slot, url) {
    const track = new VoiceTrack(url);
    await track.load();
    track.syncToTransport();
    this.tracks.set(slot, track);
    return track;
  }

  getTrack(slot) {
    return this.tracks.get(slot);
  }

  // Debe llamarse de forma síncrona dentro de un gesto de usuario (tap),
  // requisito de iOS Safari para desbloquear el AudioContext.
  static async unlock() {
    await Tone.start();
  }

  playAll() {
    Tone.Transport.start();
  }

  pauseAll() {
    Tone.Transport.pause();
  }

  stopAll() {
    Tone.Transport.stop();
  }

  get isPlaying() {
    return Tone.Transport.state === 'started';
  }

  dispose() {
    this.stopAll();
    for (const track of this.tracks.values()) track.dispose();
    this.tracks.clear();
    Tone.Transport.cancel();
  }
}
