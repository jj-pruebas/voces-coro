import { listSongs } from '../songs-repo.js';
import { SLOTS, SLOT_LABELS } from '../constants.js';

export async function renderSongList(container) {
  container.innerHTML = `
    <header class="topbar">
      <h1>Voces Coro</h1>
      <a class="btn btn-primary" href="#/nueva">+ Canción</a>
    </header>
    <div id="song-list" class="list">Cargando…</div>
  `;

  const listEl = container.querySelector('#song-list');
  try {
    const songs = await listSongs();
    if (songs.length === 0) {
      listEl.innerHTML = `<p class="empty">Aún no hay canciones. Toca "+ Canción" para subir la primera.</p>`;
      return;
    }
    listEl.innerHTML = songs.map(songCardHtml).join('');
  } catch (err) {
    listEl.innerHTML = `<p class="error">No se pudo cargar la lista: ${escapeHtml(err.message)}</p>`;
  }
}

function songCardHtml(song) {
  const bySlot = Object.fromEntries((song.tracks || []).map((t) => [t.slot, t]));
  const chips = SLOTS.map((slot) => {
    const has = !!bySlot[slot];
    return `<span class="chip ${has ? 'chip-on' : 'chip-off'}">${SLOT_LABELS[slot]}</span>`;
  }).join('');

  return `
    <a class="song-card" href="#/cancion/${song.id}">
      <div class="song-title">${escapeHtml(song.title)}</div>
      <div class="song-meta">${escapeHtml(song.artist || '')}${song.original_key ? ' · Tono original: ' + escapeHtml(song.original_key) : ''}</div>
      <div class="chips">${chips}</div>
    </a>
  `;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
