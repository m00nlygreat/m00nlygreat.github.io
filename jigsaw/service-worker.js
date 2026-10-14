const CACHE = 'stitchboard-shell-v38';
const SHELL = [
  './', './index.html', './icon.svg', './manifest.webmanifest', './src/styles.css', './src/app.js',
  './src/domain/model.js', './src/domain/geometry.js', './src/domain/commands.js', './src/imaging/decode.js', './src/imaging/thumbnail.js',
  './src/ui/layers.js', './src/ui/selection.js', './src/ui/alignment.js', './src/ui/status.js',
  './src/input/keyboard.js',
  './src/stitching/matcher.js', './src/stitching/worker.js', './src/stitching/service.js', './src/persistence/store.js', './src/persistence/snapshot.js', './src/persistence/view-state.js',
  './src/canvas/renderer.js', './src/canvas/transition.js', './src/export/exporter.js', './src/pwa/update.js',
  './samples/panorama-left.svg', './samples/panorama-right.svg', './samples/standalone.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('stitchboard-shell-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && request.destination !== 'document') {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  })));
});

