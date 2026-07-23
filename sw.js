// Service worker for the Munich->Budapest itinerary PWA
// Bump CACHE_VERSION whenever you change the itinerary HTML so phones pull the new one.
const CACHE_VERSION = 'tour2026-v1';
const APP_SHELL = [
  'bikepacking-itinerary-aug2026.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Precache the app shell on install.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails the whole install if one URL 404s; add individually so a
      // single miss (e.g. a renamed icon) never blocks the rest.
      Promise.all(APP_SHELL.map((url) =>
        cache.add(url).catch((err) => console.warn('skip cache', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

// Drop old caches on activate.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // OpenStreetMap tiles: cache-first, so map squares you've already viewed
  // stay available with no signal. Fresh tiles fill the cache as you pan online.
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open('osm-tiles').then((cache) =>
        cache.match(req).then((hit) =>
          hit || fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => hit)
        )
      )
    );
    return;
  }

  // Everything else (the page, Leaflet, icons): cache-first, fall back to network,
  // and if the network is down serve the cached itinerary page.
  event.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() =>
        caches.match('bikepacking-itinerary-aug2026.html')
      )
    )
  );
});
