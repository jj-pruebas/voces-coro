import { getSong, publicAudioUrl } from '../songs-repo.js';
import { SongPlayer } from '../audio-engine.js';
import {
  VOICE_TYPE_LABELS,
  KEYS,
  SEMITONE_MIN,
  SEMITONE_MAX,
  semitonesBetween,
} from '../constants.js';
import { escapeHtml } from './song-list.js';

let activeSongPlayer = null;

export async function renderPlayer(container, songId) {
  disposeActive();

  container.innerHTML = `<header class="topbar"><a class="btn-back" href="#/">&larr;</a><h1>Cargando…</h1></header>`;

  let song;
  try {
    song = await getSong(songId);
  } catch (err) {
    container.innerHTML = `<p class="error">No se pudo cargar la canción: ${escapeHtml(err.message)}</p>`;
    return;
  }

  const tracks = song.tracks || [];

  container.innerHTML = `
    <header class="topbar">
      <a class="btn-back" href="#/">&larr;</a>
      <h1>${escapeHtml(song.title)}</h1>
      <a class="btn-icon" href="#/cancion/${song.id}/editar" title="Editar">&#9998;</a>
    </header>
    ${
      song.artist || song.original_key
        ? `<p class="song-meta">${escapeHtml(song.artist || '')}${
            song.original_key ? ' · Tono original: ' + escapeHtml(song.original_key) : ''
          }</p>`
        : ''
    }
    ${
      tracks.length === 0
        ? '<p class="empty">Esta canción todavía no tiene pistas de audio. Edítala para subir alguna.</p>'
        : `
      <div class="master-controls">
        <button id="master-play" class="btn btn-primary btn-large">&#9654; Reproducir todo</button>
        <button id="master-stop" class="btn btn-large" disabled>&#9632; Detener</button>
      </div>
      <div id="tracks" class="tracks"></div>
      <p class="hint">Toca "Reproducir todo" primero para activar el audio (requisito de iPhone). Cada pista se puede subir/bajar de tono de forma independiente, en cualquier tonalidad.</p>
    `
    }
  `;

  if (tracks.length === 0) return;

  const tracksEl = container.querySelector('#tracks');
  tracksEl.innerHTML = tracks.map((track) => trackCardHtml(track)).join('');

  const songPlayer = new SongPlayer();
  activeSongPlayer = songPlayer;

  const masterPlayBtn = container.querySelector('#master-play');
  const masterStopBtn = container.querySelector('#master-stop');

  let loaded = false;
  let unlocked = false;

  async function ensureReady() {
    if (!unlocked) {
      await SongPlayer.unlock();
      unlocked = true;
    }
    if (!loaded) {
      masterPlayBtn.textContent = 'Cargando audio…';
      masterPlayBtn.disabled = true;
      await Promise.all(
        tracks.map((track) =>
          songPlayer.addTrack(track.id, publicAudioUrl(track.storage_path)).catch((err) => {
            throw new Error(`"${track.label}": ${err.message}`);
          })
        )
      );
      loaded = true;
      masterPlayBtn.disabled = false;
      masterStopBtn.disabled = false;
      wireTrackControls(tracksEl, songPlayer, tracks);
    }
  }

  masterPlayBtn.addEventListener('click', async () => {
    try {
      await ensureReady();
      if (songPlayer.isPlaying) {
        songPlayer.pauseAll();
        masterPlayBtn.innerHTML = '&#9654; Reproducir todo';
      } else {
        songPlayer.playAll();
        masterPlayBtn.innerHTML = '&#9208; Pausar';
      }
    } catch (err) {
      alert('No se pudo reproducir: ' + err.message);
      masterPlayBtn.disabled = false;
    }
  });

  masterStopBtn.addEventListener('click', () => {
    songPlayer.stopAll();
    masterPlayBtn.innerHTML = '&#9654; Reproducir todo';
  });
}

function trackCardHtml(track) {
  const recordedKey = track.recorded_key || 'C';
  const keyOptions = KEYS.map(
    (k) => `<option value="${k}" ${k === recordedKey ? 'selected' : ''}>${k}</option>`
  ).join('');

  return `
    <div class="track-player" data-track-id="${track.id}" data-recorded-key="${recordedKey}">
      <div class="track-player-header">
        <span class="track-name">${escapeHtml(track.label)}</span>
        ${track.voice_type ? `<span class="chip chip-on">${VOICE_TYPE_LABELS[track.voice_type]}</span>` : ''}
      </div>
      <div class="track-row">
        <button class="btn-small" data-action="mute">Mute</button>
        <button class="btn-small" data-action="solo">Solo</button>
      </div>
      <div class="key-row">
        <label class="key-select-label">Tonalidad objetivo
          <select data-field="target-key">${keyOptions}</select>
        </label>
        <div class="octave-stepper">
          <button type="button" class="btn-small" data-action="octave-down">−1 octava</button>
          <span data-role="octave-value">0</span>
          <button type="button" class="btn-small" data-action="octave-up">+1 octava</button>
        </div>
      </div>
      <div class="key-readout" data-role="key-readout">
        ${
          track.recorded_key
            ? `Grabada en ${track.recorded_key}`
            : 'Tonalidad grabada sin especificar (se asume C)'
        }
      </div>
    </div>
  `;
}

function wireTrackControls(tracksEl, songPlayer, tracks) {
  tracksEl.querySelectorAll('.track-player').forEach((card) => {
    const trackId = card.dataset.trackId;
    const recordedKey = card.dataset.recordedKey;
    const track = tracks.find((t) => t.id === trackId);
    const voiceTrack = songPlayer.getTrack(trackId);
    if (!voiceTrack) return;

    const muteBtn = card.querySelector('[data-action="mute"]');
    const soloBtn = card.querySelector('[data-action="solo"]');
    const keySelect = card.querySelector('[data-field="target-key"]');
    const octaveValueEl = card.querySelector('[data-role="octave-value"]');
    const readoutEl = card.querySelector('[data-role="key-readout"]');
    const octaveDownBtn = card.querySelector('[data-action="octave-down"]');
    const octaveUpBtn = card.querySelector('[data-action="octave-up"]');

    let muted = false;
    let solo = false;
    let octave = 0;

    function applyPitch() {
      const targetKey = keySelect.value;
      const baseShift = semitonesBetween(recordedKey, targetKey);
      const desired = baseShift + octave * 12;
      const applied = voiceTrack.setSemitones(desired);
      octaveValueEl.textContent = octave > 0 ? '+' + octave : String(octave);
      const recordedLabel = track.recorded_key ? track.recorded_key : `${recordedKey} (asumido)`;
      readoutEl.textContent = `Grabada en ${recordedLabel} · sonando en ${targetKey} (${
        applied > 0 ? '+' + applied : applied
      } semitonos)`;
      card.classList.toggle('out-of-comfort', Math.abs(applied) > 6);
    }

    muteBtn.addEventListener('click', () => {
      muted = !muted;
      voiceTrack.setMute(muted);
      muteBtn.classList.toggle('active', muted);
    });

    soloBtn.addEventListener('click', () => {
      solo = !solo;
      voiceTrack.setSolo(solo);
      soloBtn.classList.toggle('active', solo);
    });

    keySelect.addEventListener('change', applyPitch);

    octaveDownBtn.addEventListener('click', () => {
      if (octave <= -1) return;
      octave -= 1;
      applyPitch();
    });

    octaveUpBtn.addEventListener('click', () => {
      if (octave >= 1) return;
      octave += 1;
      applyPitch();
    });

    applyPitch();
  });
}

export function disposeActive() {
  if (activeSongPlayer) {
    activeSongPlayer.dispose();
    activeSongPlayer = null;
  }
}
