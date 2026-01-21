const CACHE_NAME = 'taxi-pro-v2'; // [YANGI] Versiya yangilandi
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/driver.js',
  '/img/logo.png',
  '/img/car.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // [YANGI] Kutib turmasdan darhol yangilash
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
    return self.clients.claim(); // [YANGI] Barcha tablarni nazoratga olish
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/') || e.request.url.includes('socket.io')) return;
  e.respondWith(caches.match(e.request).then((response) => response || fetch(e.request)));
});
