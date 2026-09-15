// firebase-messaging-sw.js
//
// ⚠️ এই ফাইলটা অবশ্যই আপনার সাইটের ROOT-এ রাখতে হবে
// (dashboard.html যেখানে আছে, ঠিক সেই লেভেলে — js/ ফোল্ডারের ভেতরে না)।
// এটা মিসিং থাকার কারণেই মোবাইলে ট্যাব বন্ধ/ব্যাকগ্রাউন্ডে থাকলে
// push notification আসছিল না।

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// একই config যেটা firebase-config.js-এ আছে।
// (এই কী/আইডিগুলো ক্লায়েন্ট-সাইড পাবলিক কনফিগ — সার্ভিস ওয়ার্কারে এভাবে রাখা normal ও নিরাপদ।)
firebase.initializeApp({
    apiKey: "AIzaSyB5OB2xoGCCoLP5mTB1OZURg1h3OVl8Z7M",
    authDomain: "crescentplus-97025.firebaseapp.com",
    projectId: "crescentplus-97025",
    storageBucket: "crescentplus-97025.firebasestorage.app",
    messagingSenderId: "866657995650",
    appId: "1:866657995650:web:2a3e4327d83b1d2a98dd9b",
    measurementId: "G-D9D1XJ3DY8"
});

const messaging = firebase.messaging();

// ট্যাব বন্ধ/ব্যাকগ্রাউন্ডে থাকলে এই হ্যান্ডলারই notification দেখাবে
messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Crescent+';
    const options = {
        body: payload.notification?.body || '',
        icon: '/assets/Crescentlogo.png',
        badge: '/assets/Crescentlogo.png',
        data: payload.data || {}
    };
    self.registration.showNotification(title, options);
});

// নোটিফিকেশনে ক্লিক করলে অ্যাপ খুলবে / ফোকাস করবে
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('/dashboard.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/dashboard.html');
            }
        })
    );
});