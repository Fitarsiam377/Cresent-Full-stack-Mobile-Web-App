// ============================================
// PROFILE PAGE - WITH FIREBASE STORAGE
// ============================================

let currentUser = null;

// ===== COMPRESS IMAGE TO BLOB (for Storage) =====
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

// ===== GET FALLBACK AVATAR URL =====
function getFallbackAvatar(name) {
    const initial = (name || 'U').charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${initial}&background=2c3e50&color=fff&size=120`;
}

// ===== LOAD PROFILE =====
async function loadProfile() {
    const user = firebase.auth().currentUser;
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;

    const pendingDelete = sessionStorage.getItem('pendingDelete');
    if (pendingDelete === 'true') {
        sessionStorage.removeItem('pendingDelete');
        try {
            const result = await firebase.auth().getRedirectResult();
            if (result.user) {
                await deleteAccountAfterReauth(result.user);
            } else {
                alert('Re-authentication was not completed. Please try again.');
            }
        } catch (error) {
            alert('Re-authentication failed: ' + error.message);
        }
        return;
    }

    try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (doc.exists) {
            populateForm(doc.data());
        } else {
            populateForm({
                name: user.displayName || '',
                email: user.email || '',
                phone: user.phoneNumber || ''
            });
        }

        await checkDoctorStatus(user.uid);
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Failed to load profile data.');
    }
}

// ===== POPULATE FORM (with proper image handling) =====
function populateForm(data) {
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profilePhone').value = data.phone || '';
    document.getElementById('profileEmail').value = data.email || '';
    document.getElementById('profileBloodGroup').value = data.bloodGroup || '';
    document.getElementById('profileAge').value = data.age || '';
    document.getElementById('profileCity').value = data.location?.city || '';
    document.getElementById('profileArea').value = data.location?.area || '';
    document.getElementById('profileLastDonation').value = data.lastDonation || '';

    document.querySelectorAll('input[name="profileDonor"]').forEach(radio => {
        if (radio.value === 'yes' && data.isDonor === true) radio.checked = true;
        else if (radio.value === 'no' && data.isDonor === false) radio.checked = true;
    });

    // ===== Image Handling (FIXED) =====
    const img = document.getElementById('profileImage');
    const profilePic = data.profilePic;
    const fallbackURL = getFallbackAvatar(data.name);

    // ⚠️ IMPORTANT: onerror আগে সেট করুন, তারপর src
    img.onerror = function() {
        console.warn('⚠️ Profile image failed to load, using fallback');
        this.onerror = null;
        this.src = fallbackURL;
    };

    if (profilePic && typeof profilePic === 'string' && profilePic.trim() !== '') {
        if (profilePic.startsWith('http') || profilePic.startsWith('data:image')) {
            console.log('🖼️ Loading profile image:', profilePic.substring(0, 80) + '...');
            img.src = profilePic;
        } else {
            console.warn('⚠️ Unknown profilePic format, using fallback');
            img.src = fallbackURL;
        }
    } else {
        console.log('ℹ️ No profilePic found, using fallback avatar');
        img.src = fallbackURL;
    }
}

// ===== SAVE PROFILE =====
document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentUser) { alert('You must be logged in.'); return; }

    const name = document.getElementById('profileName').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    const bloodGroup = document.getElementById('profileBloodGroup').value;
    const age = document.getElementById('profileAge').value;
    const city = document.getElementById('profileCity').value.trim();
    const area = document.getElementById('profileArea').value.trim();
    const isDonor = document.querySelector('input[name="profileDonor"]:checked')?.value === 'yes';
    const lastDonation = document.getElementById('profileLastDonation').value;

    if (!name || !phone) { alert('Name and Phone are required.'); return; }

    const updateData = {
        name, phone, bloodGroup,
        age: age ? parseInt(age) : null,
        location: { city, area },
        isDonor,
        lastDonation: lastDonation || null
    };

    const fileInput = document.getElementById('profilePicInput');
    const file = fileInput.files[0];

    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('Image too large! Please select under 5MB.');
            return;
        }
        try {
            console.log('📤 Uploading image to Firebase Storage...');
            const blob = await compressImageToBlob(file, 300, 0.7);
            const storageRef = firebase.storage().ref('profile_pics/' + currentUser.uid + '.jpg');
            await storageRef.put(blob);
            updateData.profilePic = await storageRef.getDownloadURL();
            console.log('✅ Image uploaded:', updateData.profilePic);
        } catch (error) {
            console.error('❌ Upload error:', error);
            alert('Failed to upload image: ' + error.message);
            return;
        }
    }

    try {
        await firebase.firestore().collection('users').doc(currentUser.uid).update(updateData);
        alert('Profile updated successfully!');
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('❌ Update error:', error);
        alert('Error updating profile: ' + error.message);
    }
});

// ===== PROFILE PICTURE PREVIEW (FIXED) =====
document.getElementById('profilePicInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        alert('Image too large! Please select under 5MB.');
        this.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = document.getElementById('profileImage');
        // preview-এর জন্য onerror সরিয়ে দিন (Data URI কখনো ফেইল করবে না)
        img.onerror = null;
        img.src = event.target.result;
    };
    reader.onerror = function() {
        alert('Failed to read image. Please try another photo.');
    };
    reader.readAsDataURL(file);
});

// ===== DELETE DOCTOR PROFILE =====
window.deleteDoctorProfile = async function() {
    const user = firebase.auth().currentUser;
    if (!user) { alert('You must be logged in.'); return; }
    if (!confirm('Delete your DOCTOR profile? Your account will remain active.')) return;

    try {
        const snapshot = await firebase.firestore().collection('doctors').where('uid', '==', user.uid).get();
        if (snapshot.empty) { alert('You are not registered as a doctor.'); return; }
        await firebase.firestore().collection('doctors').doc(snapshot.docs[0].id).delete();
        alert('✅ Doctor profile deleted.');
        const section = document.getElementById('doctorDeleteSection');
        if (section) section.style.display = 'none';
        loadProfile();
    } catch (error) {
        console.error('Delete doctor error:', error);
        alert('Failed to delete doctor profile: ' + error.message);
    }
};

async function checkDoctorStatus(uid) {
    try {
        const snapshot = await firebase.firestore().collection('doctors').where('uid', '==', uid).limit(1).get();
        const section = document.getElementById('doctorDeleteSection');
        if (section) {
            section.style.display = snapshot.empty ? 'none' : 'block';
        }
    } catch (error) {
        console.error('Error checking doctor status:', error);
    }
}

// ===== DELETE ACCOUNT =====
window.deleteAccount = async function() {
    const user = firebase.auth().currentUser;
    if (!user) { alert('You are not logged in.'); return; }
    if (!confirm('⚠️ Permanently delete your account? This is IRREVERSIBLE!')) return;

    const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');

    try {
        if (isGoogleUser) {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                await user.reauthenticateWithPopup(provider);
                await deleteAccountAfterReauth(user);
            } catch (popupError) {
                if (popupError.code === 'auth/popup-blocked' ||
                    popupError.code === 'auth/operation-not-supported-in-this-environment') {
                    alert('Popup blocked. Redirecting to Google...');
                    sessionStorage.setItem('pendingDelete', 'true');
                    await user.reauthenticateWithRedirect(new firebase.auth.GoogleAuthProvider());
                } else {
                    throw popupError;
                }
            }
        } else {
            const password = prompt('Enter your password to confirm:');
            if (!password) return;
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
            await user.reauthenticateWithCredential(credential);
            await deleteAccountAfterReauth(user);
        }
    } catch (error) {
        console.error('Delete account error:', error);
        if (error.code === 'auth/wrong-password') alert('Incorrect password.');
        else if (error.code === 'auth/requires-recent-login') alert('Please log out and log in again.');
        else alert('Failed to delete account: ' + error.message);
    }
};

async function deleteAccountAfterReauth(user) {
    try {
        await firebase.firestore().collection('users').doc(user.uid).delete();
        await user.delete();
        alert('Your account has been permanently deleted.');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Delete account error:', error);
        alert('Failed to delete account: ' + error.message);
    }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) window.location.href = 'login.html';
        else loadProfile();
    });
});