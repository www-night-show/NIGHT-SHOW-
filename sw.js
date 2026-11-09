const CACHE_NAME = 'nightshow-v3';
const CDN_ASSETS = [
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            // add one by one so a single failed URL does not break the whole install
            Promise.all(CDN_ASSETS.map(u => cache.add(new Request(u, { mode: 'no-cors' })).catch(() => {})))
        )
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Never touch Firebase realtime / auth traffic or other APIs
    if (/firebaseio\.com|googleapis\.com|firebaseapp\.com|identitytoolkit|securetoken/.test(url.hostname)) return;

    // App shell (HTML / navigation): network first, so admin/app updates always arrive; cache only as offline fallback
    if (req.mode === 'navigate' || (url.origin === location.origin && /\.(html|json|js)$|\/$/.test(url.pathname))) {
        e.respondWith(
            fetch(req).then(res => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, clone));
                }
                return res;
            }).catch(() => caches.match(req).then(c => c || caches.match('./')))
        );
        return;
    }

    // Static CDN libs / images: cache first, then network
    e.respondWith(
        caches.match(req).then(cached => cached || fetch(req).then(res => {
            if (res && (res.status === 200 || res.type === 'opaque') && /gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.hostname)) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(req, clone));
            }
            return res;
        }).catch(() => cached))
    );
});
