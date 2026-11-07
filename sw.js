self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('diwali-v2').then(cache => cache.addAll([
    './', './index.html', './style.css', './script.js', './audio-manager.js'
  ])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== 'diwali-v2').map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});