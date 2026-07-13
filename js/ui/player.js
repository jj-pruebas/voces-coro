import { getSong, publicAudioUrl } from '../songs-repo.js';
import { SongPlayer } from '../audio-engine.js';
import {
  SLOTS,
  SLOT_LABELS,
  VOICE_TYPE_LABELS,
  SEMITONE_MIN,
  SEMITONE_MAX,
  SEMITONE_COMFORTABLE,
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

  const bySlot = Object.fromEntries((song.tracks || []).map((t) => [t.slot, t]));
  const availableSlots = SLOTS.filter((s) => bySlot[s]);

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
      availableSlots.length === 0
        ? '<p class="empty">Esta canción todavía no tiene pistas de audio. Edítala para subir alguna.</p>'
        : `
      <div class="master-controls">
        <button id="master-play" class="btn btn-primary btn-large">&#9654; Reproducir todo</button>
        <button id="master-stop" class="btn btn-large" disabled>&#9632; Detener</button>
      </div>
      <div id="tracks" class="tracks"></div>
      <p class="hint">Toca "Reproducir todo" primero para activar el audio (requisito de iPhone). Cada pista se puede subir/bajar de tono de forma independiente.</p>
    `
    }
  `;

  if (availableSlots.length === 0) return;

  const tracksEl = container.querySelector('#tracks');
  tracksEl.innerHTML = availableSlots.map((slot) => trackCardHtml(slot, bySlot[slot])).join('');

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
        availableSlots.map((slot) =>
          songPlayer.addTrack(slot, publicAudioUrl(bySlot[slot].storage_path))
        )
      );
      loaded = true;
      masterPlayBtn.disabled = false;
      masterStopBtn.disabled = false;
      wireTrackControls(tracksEl, songPlayer);
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

function trackCardHtml(slot, track) {
  return `
    <div class="track-player" data-slot="${slot}">
      <div class="track-player-header">
        <span class="track-name">${SLOT_LABELS[slot]}</span>
        ${track.voice_type ? `<span class="chip chip-on">${VOICE_TYPE_LABELS[track.voice_type]}</span>` : ''}
      </div>
      ${track.recorded_key_hint ? `<div class="track-hint">Grabada en: ${escapeHtml(track.recorded_key_hint)}</div>` : ''}
      <div class="track-row">
        <button class="btn-small" data-action="mute">Mute</button>
        <button class="btn-small" data-action="solo">Solo</button>
        <label class="semitone-label">
          Tono: <span data-role="semitone-value">0</span> semitonos
          <input type="range" min="${SEMITONE_MIN}" max="${SEMITONE_MAX}" value="0" step="1" data-field="semitone" />
        </label>
      </div>
    </div>
  `;
}

function wireTrackControls(tracksEl, songPlayer) {
  tracksEl.querySelectorAll('.track-player').forEach((card) => {
    const slot = card.dataset.slot;
    const voiceTrack = songPlayer.getTrack(slot);
    if (!voiceTrack) return;

    const muteBtn = card.querySelector('[data-action="mute"]');
    const soloBtn = card.querySelector('[data-action="solo"]');
    const slider = card.querySelector('[data-field="semitone"]');
    const valueEl = card.querySelector('[data-role="semitone-value"]');

    let muted = false;
    let solo = false;

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

    slider.addEventListener('input', () => {
      const applied = voiceTrack.setSemitones(Number(slider.value));
      valueEl.textContent = applied > 0 ? '+' + applied : String(applied);
      const comfortable = Math.abs(applied) <= SEMITONE_COMFORTABLE;
      card.classList.toggle('out-of-comfort', !comfortable);
    });
  });
}

export function disposeActive() {
  if (activeSongPlayer) {
    activeSongPlayer.dispose();
    activeSongPlayer = null;
  }
}
