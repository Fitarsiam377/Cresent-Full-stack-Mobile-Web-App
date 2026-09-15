// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyB5OB2xoGCCoLP5mTB1OZURg1h3OVl8Z7M",
    authDomain: "crescentplus-97025.firebaseapp.com",
    projectId: "crescentplus-97025",
    storageBucket: "crescentplus-97025.firebasestorage.app",
    messagingSenderId: "866657995650",
    appId: "1:866657995650:web:2a3e4327d83b1d2a98dd9b",
    measurementId: "G-D9D1XJ3DY8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// =============================================
// 🔥 ENABLE OFFLINE PERSISTENCE (নেট স্লো হলেও ক্যাশ দেখাবে)
// =============================================
firebase.firestore().enablePersistence()
    .then(() => {
        console.log('🔥 Firestore persistence enabled! (Offline data available)');
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            // একাধিক ট্যাব খোলা থাকলে শুধু প্রথম ট্যাবে কাজ করে
            console.warn('Multiple tabs open, persistence enabled in first tab only.');
        } else if (err.code === 'unimplemented') {
            // ব্রাউজার সাপোর্ট করে না
            console.warn('Browser does not support persistence.');
        }
    });

// Services
const auth = firebase.auth();
const db = firebase.firestore();

console.log('Firebase initialized successfully!');