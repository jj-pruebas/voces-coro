import * as Tone from 'https://esm.sh/tone@14.9.17';
import { SoundTouchNode } from 'https://esm.sh/@soundtouchjs/audio-worklet@2.1.0';
import { SEMITONE_MIN, SEMITONE_MAX } from './constants.js';

// Pieza de mayor riesgo técnico del proyecto: pitch-shift en tiempo real en
// Safari iOS. Cada pista usa Player -> SoundTouchNode (AudioWorklet, WSOLA) ->
// Channel -> bus maestro (Limiter) -> salida. Todas las pistas se sincronizan
// vía Tone.Transport para que "reproducir todo" empiece igual en todas.
//
// Se usa SoundTouchNode (paquete @soundtouchjs/audio-worklet) en vez de
// Tone.PitchShift: en pruebas reales en iPhone, Tone.PitchShift sonaba con
// interferencia/saturación notable, sobre todo al desplazar varios semitonos.
// El archivo del procesador de audio (obligatorio para AudioWorklet) está
// copiado en ./vendor/soundtouch-processor.js para que cargue desde el mismo
// origen, sin depender de un CDN externo.
//
// Tone.js envuelve su AudioContext interno, y ese envoltorio (Tone.getContext().
// rawContext) no pasa la comprobación "instanceof BaseAudioContext" que exige
// el constructor nativo de AudioWorkletNode. Por eso se crea aquí el
// AudioContext nativo nosotros mismos y se le pide a Tone.js que lo use — así
// se conserva una referencia directa al objeto nativo real para SoundTouchNode.
const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
const nativeContext = new NativeAudioContext();
Tone.setContext(nativeContext);

const PROCESSOR_URL = new URL('./vendor/soundtouch-processor.js', import.meta.url);

let workletRegistration = null;
function ensureWorkletRegistered() {
  if (!workletRegistration) {
    workletRegistration = SoundTouchNode.register(nativeContext, PROCESSOR_URL);
  }
  return workletRegistration;
}

// Los nodos de Tone.js son composiciones de varios nodos nativos por dentro;
// .output/.input pueden devolver otro objeto envuelto (ej. un Tone.Gain) en
// vez del AudioNode nativo real. Esto "desenvuelve" hasta encontrar el nodo
// nativo de verdad, sin importar cuántas capas tenga, para poder conectarlo
// de forma nativa con un AudioWorkletNode ajeno a Tone.js (SoundTouchNode).
function nativeOutputOf(node) {
  let n = node;
  let guard = 0;
  while (n && !(n instanceof AudioNode) && guard++ < 5) n = n.output;
  return n;
}
function nativeInputOf(node) {
  let n = node;
  let guard = 0;
  while (n && !(n instanceof AudioNode) && guard++ < 5) n = n.input;
  return n;
}

export class VoiceTrack {
  constructor(url, output) {
    this.url = url;
    // -6 dB de margen por pista: si varias pistas suenan a la vez a 0 dB
    // cada una, la suma puede saturar/distorsionar la salida final.
    this.channel = new Tone.Channel({ volume: -6, mute: false });
    this.channel.connect(output);
    this.player = new Tone.Player({ loop: false });
    this.pitchShift = null; // se crea en load(), tras registrar el AudioWorklet
  }

  // Carga explícita (en vez de confiar en Tone.loaded() global) para poder
  // detectar y reportar con claridad cuando un archivo no se puede
  // decodificar como audio (ej. un video sin pista de audio compatible),
  // en vez de quedar en silencio sin ningún aviso.
  async load() {
    await ensureWorkletRegistered();
    console.log('[audio] worklet registrado, contexto:', nativeContext.state, 'sampleRate:', nativeContext.sampleRate);

    this.pitchShift = new SoundTouchNode({ context: nativeContext });
    console.log(
      '[audio] pitchShift channelCount:', this.pitchShift.channelCount,
      'channelCountMode:', this.pitchShift.channelCountMode,
      'numberOfInputs:', this.pitchShift.numberOfInputs,
      'numberOfOutputs:', this.pitchShift.numberOfOutputs
    );
    this.pitchShift.port.onmessage = (e) => console.log('[audio] worklet metrics:', e.data);

    const playerOut = nativeOutputOf(this.player);
    const channelIn = nativeInputOf(this.channel);
    console.log(
      '[audio] nodos nativos resueltos — playerOut es AudioNode:', playerOut instanceof AudioNode,
      'channelIn es AudioNode:', channelIn instanceof AudioNode
    );
    playerOut.connect(this.pitchShift);
    this.pitchShift.connect(channelIn);
    console.log('[audio] pistas conectadas: player -> pitchShift -> channel');

    try {
      await this.player.load(this.url);
    } catch (err) {
      throw new Error(`No se pudo cargar el audio (${err && err.message ? err.message : err}).`);
    }
    console.log('[audio] player cargado, duración:', this.player.buffer && this.player.buffer.duration);
    if (!this.player.loaded || !this.player.buffer || !(this.player.buffer.duration > 0)) {
      throw new Error(
        'El archivo se subió pero no se pudo decodificar como audio. Si es un video, prueba con un archivo de solo audio (mp3, m4a, wav).'
      );
    }
    return this;
  }

  syncToTransport() {
    this.player.sync().start(0);
  }

  setSemitones(n) {
    const clamped = Math.max(SEMITONE_MIN, Math.min(SEMITONE_MAX, n));
    if (this.pitchShift) this.pitchShift.pitchSemitones.value = clamped;
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
    if (this.pitchShift) this.pitchShift.disconnect();
    this.channel.dispose();
  }
}

export class SongPlayer {
  constructor() {
    this.tracks = new Map(); // slot -> VoiceTrack
    this._started = false;
    // Bus maestro compartido: evita que la suma de varias pistas sature la
    // salida (actúa como red de seguridad además del margen de -6 dB por pista).
    this.masterBus = new Tone.Limiter(-1).toDestination();
  }

  async addTrack(slot, url) {
    const track = new VoiceTrack(url, this.masterBus);
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
    console.log('[audio] Tone.start() listo, estado del contexto nativo:', nativeContext.state);
  }

  playAll() {
    Tone.Transport.start();
    console.log('[audio] Transport iniciado, estado:', Tone.Transport.state, 'contexto:', nativeContext.state);
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
    this.masterBus.dispose();
  }
}
