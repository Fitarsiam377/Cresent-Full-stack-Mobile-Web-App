// sw.js - Crescent+ (v7) - CSS + সব ফাইল নিশ্চিত ক্যাশ হবে
const CACHE_NAME = 'crescent-v16';
const OFFLINE_URL = '/index.html';

const FILES = [
  // HTML
  '/', '/index.html', '/login.html', '/account.html',
  '/dashboard.html', '/profile.html', '/request.html',
  '/support.html', '/admin.html', '/admin-support.html',
  '/crescentai.html', '/crescentcare.html', '/chat.html',
  '/chat-window.html', '/doctor-register.html',

  // ✅ সব CSS (নিশ্চিত)
  '/css/style.css',
  '/css/chat.css',
  '/css/admin.css',
  '/css/support.css',
  '/css/admin-support.css',
  '/css/intro.css',

  // JS
  '/js/firebase-config.js', '/js/auth.js', '/js/dashboard.js',
  '/js/ai.js', '/js/chat.js', '/js/chat-window.js',
  '/js/crescentcare.js', '/js/delivery.js',
  '/js/doctor-register.js', '/js/notification.js',
  '/js/profile.js', '/js/request.js', '/js/scale.js',
  '/js/support.js', '/js/admin-support.js', '/js/admin.js',

  // Assets
  '/assets/Crescentlogo.png', '/assets/Crescentlogo.jpeg',
  '/assets/blank.png',

  // PWA
  '/manifest.json'
];

// ===== INSTALL =====
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        const promises = FILES.map(url => {
          return cache.add(url).catch(err => {
            console.warn('⚠️ Could not cache:', url, err);
            return Promise.resolve();
          });
        });
        return Promise.all(promises);
      })
      .then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // বাহ্যিক API → নেটওয়ার্ক
  if (['firebase','googleapis','gstatic','locationiq',
       'nominatim.openstreetmap','unpkg.com','cdnjs.cloudflare.com',
       'api.groq.com'].some(h => url.hostname.includes(h))) {
    e.respondWith(fetch(e.request));
    return;
  }

  // HTML পেজ
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request)
        .then(r => r || fetch(e.request)
          .then(res => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then(c => {
                try { c.put(e.request, res.clone()); } catch (_) {}
              });
            }
            return res;
          })
          .catch(() => caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // CSS/JS/ইমেজ → ক্যাশ থেকে, না পেলে নেটওয়ার্ক
  e.respondWith(
    caches.match(e.request)
      .then(r => r || fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            caches.open(CACHE_NAME).then(c => {
              try { c.put(e.request, res.clone()); } catch (_) {}
            });
          }
          return res;
        })
        .catch(() => {
          if (e.request.destination === 'image') {
            return caches.match('/assets/blank.png');
          }
          // CSS বা JS এর জন্য 503 না দিয়ে খালি রেসপন্স না দিয়ে ডিফল্ট স্ট্রিং
          return new Response('/* Offline */', { 
            status: 200,
            headers: { 'Content-Type': 'text/css' }
          });
        })
      )
  );
});