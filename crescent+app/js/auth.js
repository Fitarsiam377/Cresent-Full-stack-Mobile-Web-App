// ============================================
// CRESCENT+ AUTHENTICATION (FIREBASE)
// UNIVERSAL: Browser + PWA + APK (TWA) + WebView
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    // =============================================
    // 🔥 STEP 0 + 1: SET PERSISTENCE → THEN REDIRECT RESULT
    // (ক্রম গুরুত্বপূর্ণ: আগে persistence, তারপর redirect)
    // =============================================
    let redirectCheckDone = false;
    let redirectCheckPromise = (async function() {
        try {
            // 🔥 প্রথমে persistence সেট করুন
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log('✅ Persistence: LOCAL');

            // 🔥 তারপর redirect result নিন
            const result = await firebase.auth().getRedirectResult();
            console.log('✅ Redirect result received');

            if (result && result.user) {
                console.log('👤 User from redirect:', result.user.email);
                localStorage.removeItem('pendingGoogleLogin');
                await handleUserAfterLogin(result.user);
            } else {
                console.log('ℹ️ No user from redirect');
            }
        } catch (error) {
            localStorage.removeItem('pendingGoogleLogin');
            if (error.code !== 'auth/operation-not-supported-in-this-environment' &&
                error.code !== 'auth/network-request-failed') {
                console.error('❌ Redirect result error:', error);
            }
        } finally {
            redirectCheckDone = true;
        }
    })();

    // =============================================
    // COMPRESS IMAGE → BLOB (For Firebase Storage)
    // =============================================
    function compressImageToBlob(file, maxWidth = 300, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Compression failed'));
                    }, 'image/jpeg', quality);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // =============================================
    // HELPER: Email verification check
    // =============================================
    function needsEmailVerification(user) {
        if (!user) return false;
        const isPasswordAccount = user.providerData.some(p => p.providerId === 'password');
        return isPasswordAccount && !user.emailVerified;
    }

    // =============================================
    // HELPER: Friendly error messages
    // =============================================
    function getAuthErrorMessage(error) {
        switch (error.code) {
            case 'auth/email-already-in-use': return 'This email is already registered. Please log in.';
            case 'auth/invalid-email': return 'Please enter a valid email address.';
            case 'auth/weak-password': return 'Password is too weak. Please use at least 6 characters.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential': return 'Incorrect email or password. Please try again.';
            case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment.';
            case 'auth/network-request-failed': return 'Network error. Please check your internet.';
            default: return 'Error: ' + error.message;
        }
    }

    const PROTECTED_PAGES = [
        'dashboard.html', 'profile.html', 'request.html', 'crescentai.html',
        'chat.html', 'chat-window.html', 'admin.html', 'admin-support.html'
    ];

    // =============================================
    // REGISTER
    // =============================================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const name = document.getElementById('fullName').value.trim();
            const phone = document.getElementById('mobile').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const bloodGroup = document.getElementById('bloodGroup').value;
            const age = document.getElementById('age').value;
            const city = document.getElementById('city').value.trim();
            const area = document.getElementById('area').value.trim();
            const isDonor = document.querySelector('input[name="donor"]:checked')?.value === 'yes';
            const lastDonation = document.getElementById('lastDonation').value;

            if (!name || !phone || !email || !password || !bloodGroup || !age || !city || !area) {
                alert('Please fill all required fields!');
                return;
            }
            if (password.length < 6) {
                alert('Password must be at least 6 characters!');
                return;
            }
            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }

            const phoneRegex = /^01[3-9]\d{8}$/;
            if (!phoneRegex.test(phone)) {
                alert('Please enter a valid Bangladeshi mobile number (e.g., 01712345678).');
                return;
            }

            const ageNum = parseInt(age, 10);
            if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
                alert('Age must be between 18 and 65.');
                return;
            }

            const fileInput = document.getElementById('profilePic');
            const file = fileInput.files[0];
            let compressedBlob = null;

            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('Image is too large! Please select an image smaller than 5MB.');
                    return;
                }
                try {
                    compressedBlob = await compressImageToBlob(file, 300, 0.7);
                } catch (error) {
                    alert('Failed to process image. Please try another photo.');
                    return;
                }
            }

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn?.textContent || '';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating...'; }

            try {
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                await user.updateProfile({ displayName: name });
                await user.sendEmailVerification();

                let profilePicURL = null;
                if (compressedBlob) {
                    try {
                        const storageRef = firebase.storage().ref('profile_pics/' + user.uid + '.jpg');
                        await storageRef.put(compressedBlob);
                        profilePicURL = await storageRef.getDownloadURL();
                    } catch (uploadError) {
                        console.warn('Profile pic upload skipped:', uploadError);
                    }
                }

                const userData = {
                    uid: user.uid,
                    name: name,
                    phone: phone,
                    email: email,
                    bloodGroup: bloodGroup,
                    age: ageNum,
                    location: { city, area },
                    isDonor: isDonor,
                    lastDonation: lastDonation || null,
                    donationCount: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                if (profilePicURL) userData.profilePic = profilePicURL;

                await firebase.firestore().collection('users').doc(user.uid).set(userData);

                await firebase.auth().signOut();

                alert('Account created! Please verify your email, then log in.');
                window.location.href = 'login.html';

            } catch (error) {
                alert(getAuthErrorMessage(error));
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
            }
        });
    }

    // =============================================
    // LOGIN (Email/Password)
    // =============================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginIdentifier').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) { alert('Please fill all fields!'); return; }

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn?.textContent || '';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Logging in...'; }

            try {
                const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                if (needsEmailVerification(user)) {
                    alert('Email not verified. New link sent.');
                    await user.sendEmailVerification();
                    await firebase.auth().signOut();
                    return;
                }

                alert('Welcome back, ' + user.displayName + ' 🩸');
                window.location.href = 'dashboard.html';

            } catch (error) {
                alert(getAuthErrorMessage(error));
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
            }
        });
    }

    // =============================================
    // 🔥 ENVIRONMENT DETECTION
    // =============================================
    function isTWA() {
        if (document.referrer && document.referrer.startsWith('android-app://')) {
            return true;
        }
        if (/Android/i.test(navigator.userAgent) && /crescentplus/i.test(navigator.userAgent)) {
            return true;
        }
        return false;
    }

    function isStandalonePWA() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.matchMedia('(display-mode: fullscreen)').matches ||
               window.matchMedia('(display-mode: minimal-ui)').matches ||
               window.navigator.standalone === true;
    }

    function isWebView() {
        if (/\bwv\b/i.test(navigator.userAgent)) return true;
        if (typeof window.android !== 'undefined' && typeof window.android.postMessage === 'function') return true;
        if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNative) return true;
        return false;
    }

    function isIOSPWA() {
        return window.navigator.standalone === true;
    }

    function shouldUseRedirect() {
        const twa = isTWA();
        const pwa = isStandalonePWA();
        const wv = isWebView();
        const ios = isIOSPWA();

        console.log('🔍 Environment check:', {
            TWA: twa,
            StandalonePWA: pwa,
            WebView: wv,
            iOSPWA: ios,
            Referrer: document.referrer
        });

        return twa || pwa || wv || ios;
    }

    // =============================================
    // 🔥 GOOGLE LOGIN
    // =============================================
    window.googleLogin = async function() {
        if (!firebase.apps.length) {
            alert('Firebase not initialized.');
            return;
        }

        const btn = document.querySelector('.google-btn');
        const originalHTML = btn?.innerHTML || '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        }
        const resetBtn = () => {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
        };

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        // 🔥 Ensure LOCAL persistence before login
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (e) {
            console.warn('Persistence set failed:', e);
        }

        const useRedirect = shouldUseRedirect();
        console.log('🚀 Google Login — useRedirect:', useRedirect);

        try {
            if (useRedirect) {
                // TWA / PWA / WebView — Redirect
                localStorage.setItem('pendingGoogleLogin', 'true');
                console.log('➡️ Using signInWithRedirect');
                await firebase.auth().signInWithRedirect(provider);
                return;
            } else {
                // Normal browser — Popup
                console.log('➡️ Using signInWithPopup');
                const result = await firebase.auth().signInWithPopup(provider);
                localStorage.removeItem('pendingGoogleLogin');
                await handleUserAfterLogin(result.user);
            }
        } catch (error) {
            console.error('❌ Google Login error:', error.code, error.message);

            if (error.code === 'auth/popup-blocked' ||
                error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request' ||
                error.code === 'auth/network-request-failed' ||
                error.code === 'auth/operation-not-supported-in-this-environment') {
                try {
                    console.log('➡️ Popup failed — falling back to Redirect');
                    localStorage.setItem('pendingGoogleLogin', 'true');
                    await firebase.auth().signInWithRedirect(provider);
                    return;
                } catch (redirectError) {
                    localStorage.removeItem('pendingGoogleLogin');
                    console.error('❌ Redirect also failed:', redirectError);
                    alert('Google Login failed.\nError: ' + redirectError.message);
                    resetBtn();
                }
            } else {
                localStorage.removeItem('pendingGoogleLogin');
                alert('Google Login error: ' + error.message);
                resetBtn();
            }
        }
    };

    // =============================================
    // HANDLE USER AFTER LOGIN
    // =============================================
    async function handleUserAfterLogin(user) {
        try {
            const userRef = firebase.firestore().collection('users').doc(user.uid);
            const doc = await userRef.get();
            if (!doc.exists) {
                await userRef.set({
                    uid: user.uid,
                    name: user.displayName || 'User',
                    email: user.email,
                    phone: user.phoneNumber || '',
                    bloodGroup: '',
                    age: null,
                    location: { city: '', area: '' },
                    isDonor: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            alert('✅ Google login successful! Welcome, ' + (user.displayName || 'User'));
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error('❌ Error handling user:', error);
            alert('Error saving user data: ' + error.message);
        }
    }

    // =============================================
    // RESEND VERIFICATION
    // =============================================
    window.resendVerification = async function() {
        const user = firebase.auth().currentUser;
        if (!user) { alert('Please login first.'); return; }
        if (user.emailVerified) { alert('Already verified!'); return; }
        try {
            await user.sendEmailVerification();
            alert('Verification email resent!');
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    // =============================================
    // FORGOT PASSWORD
    // =============================================
    window.resetPassword = async function() {
        const email = prompt('Enter your email address:');
        if (!email) return;
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            alert('Password reset link sent to your email!');
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    // =============================================
    // LOGOUT
    // =============================================
    window.logout = async function() {
        try {
            localStorage.removeItem('pendingGoogleLogin');
            await firebase.auth().signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // =============================================
    // AUTH STATE LISTENER
    // =============================================
    firebase.auth().onAuthStateChanged(async function(user) {
        await redirectCheckPromise;

        const currentPage = window.location.pathname;
        const isProtectedPage = PROTECTED_PAGES.some(p => currentPage.includes(p));
        const isPendingGoogleLogin = localStorage.getItem('pendingGoogleLogin') === 'true';

        // 🔥 Redirect থেকে ফিরে এসেছে এবং user পাওয়া গেছে
        if (user && isPendingGoogleLogin) {
            console.log('✅ Google Login marker found, user:', user.email);
            localStorage.removeItem('pendingGoogleLogin');

            if (currentPage.includes('login.html') || currentPage.includes('account.html') ||
                currentPage === '/' || currentPage.includes('index.html')) {
                await handleUserAfterLogin(user);
                return;
            }
        }

        if (!user) {
            if (isProtectedPage) window.location.href = 'login.html';
            return;
        }

        if (needsEmailVerification(user)) {
            if (isProtectedPage) {
                await firebase.auth().signOut();
                alert('Please verify your email before continuing.');
                window.location.href = 'login.html';
            }
            return;
        }

        // Login page-এ user থাকলে dashboard-এ পাঠান
        if (currentPage.includes('login.html') || currentPage.includes('account.html')) {
            window.location.href = 'dashboard.html';
            return;
        }

        if (currentPage.includes('dashboard.html')) {
            try {
                const doc = await firebase.firestore().collection('users').doc(user.uid).get();
                if (doc.exists) {
                    const data = doc.data();
                    const nameEl = document.getElementById('userName');
                    if (nameEl) nameEl.textContent = data.name || user.displayName || 'User';
                    const profileIcon = document.getElementById('profileIconImg');
                    if (profileIcon) {
                        if (data.profilePic) profileIcon.src = data.profilePic;
                        else {
                            const initial = (data.name || 'U').charAt(0).toUpperCase();
                            profileIcon.src = `https://ui-avatars.com/api/?name=${initial}&background=2c3e50&color=fff&size=100`;
                        }
                    }
                }
            } catch (e) {
                console.error('Error loading user data:', e);
            }
        }
    });

    // =============================================
    // GOOGLE BUTTON CLICK HANDLER
    // =============================================
    const googleBtn = document.querySelector('.google-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.googleLogin();
        });
    }

    // =============================================
    // ফ্যালব্যাক: ২ সেকেন্ড পর আবার চেক
    // =============================================
    setTimeout(async () => {
        if (!redirectCheckDone) {
            try {
                const result = await firebase.auth().getRedirectResult();
                if (result && result.user) {
                    localStorage.removeItem('pendingGoogleLogin');
                    await handleUserAfterLogin(result.user);
                }
            } catch (e) {
                // ignore
            }
        }
    }, 2000);
});

// =============================================
// FALLBACK
// =============================================
if (typeof window.googleLogin === 'undefined') {
    window.googleLogin = async function() {
        alert('Please wait for the page to load completely, then try again.');
    };
}