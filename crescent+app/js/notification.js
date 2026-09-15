// js/notification.js

// VAPID Public Key (আপনার দেওয়া)
const VAPID_KEY = 'BFW140yS6R0ARKITF_8y0Yu0yVBQTPALexSWhOdFCqsHdMb5crI2neV_2IwTrApsf3a1Dgb_nQAuzYszQWyGF3Y';

let messaging = null;

// =============================================
// LAZY LOAD MESSAGING SDK
// আগে firebase-messaging-compat.js প্রতিটা dashboard লোডে statically আসত
// (এটা বেশ ভারী স্ক্রিপ্ট)। এখন এটা শুধু তখনই লোড হবে যখন আমরা সত্যিই
// notification permission চাইতে যাচ্ছি — যারা কখনো permission দেয় না,
// তাদের জন্য এই ডাউনলোডটাই বেঁচে যাবে।
// =============================================
function loadMessagingSdk() {
    return new Promise((resolve, reject) => {
        if (window.firebase && firebase.messaging) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js';
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
    });
}

// =============================================
// REGISTER THE FCM SERVICE WORKER
// এটাই আগে মিসিং ছিল — এই সার্ভিস ওয়ার্কার ছাড়া ব্রাউজার ট্যাব বন্ধ/ব্যাকগ্রাউন্ডে
// থাকলে push notification ডেলিভার হয় না, যেটাই মোবাইলে notification না
// আসার মূল কারণ।
// =============================================
async function registerMessagingServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.warn('This browser does not support service workers — push notifications will not work.');
        return null;
    }
    try {
        return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (error) {
        console.error('FCM service worker registration failed:', error);
        return null;
    }
}

// =============================================
// নোটিফিকেশন পারমিশন চাওয়া ও টোকেন সংরক্ষণ
// =============================================
async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        await loadMessagingSdk();
        if (!messaging) {
            messaging = firebase.messaging();

            // ফোরগ্রাউন্ডে মেসেজ রিসিভ (অ্যাপ খোলা ও active থাকলে)
            messaging.onMessage((payload) => {
                if (typeof showToast === 'function') {
                    showToast(payload.notification?.title, payload.notification?.body);
                }
                if (typeof loadNotifications === 'function') {
                    loadNotifications();
                }
            });
        }

        const registration = await registerMessagingServiceWorker();

        const token = await messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration || undefined
        });

        await saveTokenToFirestore(token);
        return token;
    } catch (error) {
        console.error('Error getting FCM token:', error);
    }
}

async function saveTokenToFirestore(token) {
    const user = firebase.auth().currentUser;
    if (!user || !token) return;
    const userRef = firebase.firestore().collection('users').doc(user.uid);
    await userRef.set({
        fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
    }, { merge: true });
}

// ড্যাশবোর্ড লোড হলে পারমিশন চাও
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            setTimeout(requestNotificationPermission, 2000);
        }
    });
});