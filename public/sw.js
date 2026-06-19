// Minimal runtime-cache service worker for Emberwood (network-first, cache fallback).
const CACHE = 'emberwood-v1';

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    e.respondWith(
        fetch(req)
            .then(res => {
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
                return res;
            })
            .catch(() => caches.match(req))
    );
});
