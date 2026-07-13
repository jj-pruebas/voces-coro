// Cachea el "app shell" (HTML/CSS/JS/iconos) solo como respaldo offline.
// Mientras hay red, siempre se pide la versión más nueva primero
// ("network-first"): así los cambios llegan de inmediato en vez de quedar
// atrapados detrás de una copia vieja en caché. El audio (servido desde
// Supabase, otro origen) se deja fuera del cache.
const CACHE_NAME = 'voces-coro-shell-v3';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/debug.js',
  './js/constants.js',
  './js/supabase-config.js',
  './js/supabase-init.js',
  './js/songs-repo.js',
  './js/upload.js',
  './js/audio-engine.js',
  './js/ui/song-list.js',
  './js/ui/song-editor.js',
  './js/ui/player.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
