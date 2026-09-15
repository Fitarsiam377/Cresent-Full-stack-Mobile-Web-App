// ============================================
// DOCTOR REGISTRATION - FIXED & ROBUST
// ============================================

document.addEventListener('DOMContentLoaded', function() {


    // ===== IMAGE COMPRESSION =====
    function compressImage(file, maxWidth = 300, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ===== PROFILE PICTURE PREVIEW =====
    const picInput = document.getElementById('doctorPicInput');
    const preview = document.getElementById('doctorPicPreview');
    if (picInput && preview) {
        picInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                alert('Image too large! Please select under 5MB.');
                this.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(ev) {
                preview.innerHTML = `<img src="${ev.target.result}" alt="Profile" />`;
            };
            reader.readAsDataURL(file);
        });
    }

    // ===== TOGGLE BMDC FIELD =====
    const docType = document.getElementById('docType');
    const bmdcGroup = document.getElementById('bmdcGroup');
    const bmdcInput = document.getElementById('docBmdc');

    if (docType && bmdcGroup && bmdcInput) {
        docType.addEventListener('change', function() {
            if (this.value === 'intern') {
                bmdcGroup.style.display = 'none';
                bmdcInput.removeAttribute('required');
            } else {
                bmdcGroup.style.display = 'block';
                bmdcInput.setAttribute('required', 'required');
            }
        });
        // Initial trigger
        docType.dispatchEvent(new Event('change'));
    }

    // ===== FORM SUBMIT =====
    const form = document.getElementById('doctorRegisterForm');
    if (!form) {
        console.error('❌ Form not found!');
        return;
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const user = firebase.auth().currentUser;
        if (!user) {
            alert('You must be logged in.');
            window.location.href = 'login.html';
            return;
        }

        // Get values
        const name = document.getElementById('docName')?.value.trim() || '';
        const docTypeVal = document.getElementById('docType')?.value || 'bmdc';
        const specialty = document.getElementById('docSpecialty')?.value || '';
        const degree = document.getElementById('docDegree')?.value.trim() || '';
        const bmdc = document.getElementById('docBmdc')?.value.trim() || '';
        const college = document.getElementById('docCollege')?.value || '';
        const studentId = document.getElementById('docStudentId')?.value.trim() || '';
        const chamber = document.getElementById('docChamber')?.value.trim() || '';
        const location = document.getElementById('docLocation')?.value || '';
        const phone = document.getElementById('docPhone')?.value.trim() || '';
        const fee = parseInt(document.getElementById('docFee')?.value) || 0;
        const available = document.querySelector('input[name="docAvailable"]:checked')?.value === 'true';


        // Validation
        if (!name || !specialty || !degree || !college || !studentId || !chamber || !location || !phone || !fee) {
            alert('Please fill all required fields.');
            return;
        }
        if (isNaN(fee) || fee < 0) {
            alert('Enter a valid consultation fee.');
            return;
        }
        if (docTypeVal === 'bmdc' && !bmdc) {
            alert('BMDC Registration Number is required for BMDC doctors.');
            return;
        }

        // Profile picture
        const fileInput = document.getElementById('doctorPicInput');
        const file = fileInput?.files[0] || null;
        let profilePicBase64 = null;
        if (file) {
            try {
                profilePicBase64 = await compressImage(file, 300, 0.7);
            } catch (err) {
                alert('Failed to process image.');
                return;
            }
        }

        // 🔥 Doctor Data – verified: true
        const doctorData = {
            uid: user.uid,
            name,
            docType: docTypeVal,
            specialty,
            degree,
            bmdc: bmdc || 'N/A',
            college,
            studentId,
            chamber,
            location,
            phone,
            fee: fee + ' BDT',
            available,
            verified: true, // ✅ সব ডাক্তারই ভেরিফাইড
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (profilePicBase64) doctorData.profilePic = profilePicBase64;

        try {
            // Check if already registered
            const existing = await firebase.firestore()
                .collection('doctors')
                .where('uid', '==', user.uid)
                .get();

            if (!existing.empty) {
                const docId = existing.docs[0].id;
                await firebase.firestore().collection('doctors').doc(docId).update(doctorData);
                alert('✅ Your profile has been updated!');
            } else {
                await firebase.firestore().collection('doctors').add(doctorData);
                alert('✅ Registration successful! You will appear instantly.');
            }
            window.location.href = 'crescentcare.html';
        } catch (error) {
            console.error('❌ Firestore error:', error);
            alert('Error: ' + error.message);
        }
    });
});