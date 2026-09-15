// ============================================
// SUPPORT PAGE - CRESCENT+
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('supportForm');
    const submitBtn = document.getElementById('supportSubmitBtn');
    const successMsg = document.getElementById('successMsg');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');

    // ✅ সিলেক্ট চেঞ্জ হলে মেসেজ ফিল্ডের প্লেসহোল্ডার ও টেমপ্লেট পরিবর্তন
    const supportType = document.getElementById('supportType');
    const messageField = document.getElementById('supportMessage');
    const subjectField = document.getElementById('supportSubject');

    supportType.addEventListener('change', function() {
        const type = this.value;

        if (type === 'ban-request') {
            messageField.placeholder = 'Enter user details to ban:\n\nUser ID / Email:\nFull Name:\nBlood Group:\nMobile Number:\nReason for Ban:';
            messageField.value = 'User ID / Email: \nFull Name: \nBlood Group: \nMobile Number: \nReason for Ban: ';
            subjectField.placeholder = 'Ban Request: [User Name]';
            if (!subjectField.value) {
                subjectField.value = 'Ban Request: ';
            }
        } else if (type === 'ban-appeal') {
            messageField.placeholder = 'Explain why your account should not be banned:\n\nYour User ID:\nReason for Appeal:\nAdditional Details:';
            messageField.value = 'Your User ID: \nReason for Appeal: \nAdditional Details: ';
            subjectField.placeholder = 'Ban Appeal: [Your User ID]';
            if (!subjectField.value) {
                subjectField.value = 'Ban Appeal: ';
            }
        } else {
            // ডিফল্ট প্লেসহোল্ডার
            messageField.placeholder = 'Describe your issue in detail...';
            // শুধু মেসেজ ফিল্ড খালি করব না, যদি ইউজার আগে কিছু টাইপ করে থাকে তাহলে সেটা থাকবে
            // কিন্তু আমরা চাই না যে টেমপ্লেট থেকে গিয়ে অন্য ইস্যুতে পাঠায়, তাই খালি করব না
            // তবে subject ফিল্ডের placeholder রিসেট করব
            subjectField.placeholder = 'Brief subject';
            // messageField.value খালি করব না, ইউজার যা লিখেছে সেটা থাকবে
        }
    });

    // Auto-fill user data if logged in
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            const nameInput = document.getElementById('supportName');
            const emailInput = document.getElementById('supportEmail');
            
            firebase.firestore().collection('users').doc(user.uid).get()
                .then(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.name) nameInput.value = data.name;
                        if (data.email) emailInput.value = data.email;
                    }
                })
                .catch(() => {});
        }
    });

    // Form submit
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const name = document.getElementById('supportName').value.trim();
        const email = document.getElementById('supportEmail').value.trim();
        const type = document.getElementById('supportType').value;
        const subject = document.getElementById('supportSubject').value.trim();
        const message = document.getElementById('supportMessage').value.trim();

        if (!name || !email || !type || !subject || !message) {
            showError('Please fill all required fields.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        try {
            const user = firebase.auth().currentUser;
            const userId = user ? user.uid : null;

            await firebase.firestore().collection('supportTickets').add({
                userId: userId,
                name: name,
                email: email,
                type: type,
                subject: subject,
                message: message,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            successMsg.style.display = 'block';
            errorMsg.style.display = 'none';
            form.reset();
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';

            // রিসেট করার পর ডিফল্ট প্লেসহোল্ডার সেট করুন
            messageField.placeholder = 'Describe your issue in detail...';
            subjectField.placeholder = 'Brief subject';

            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 6000);

        } catch (error) {
            showError('Failed to send message: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
        }
    });

    function showError(text) {
        errorText.textContent = text;
        errorMsg.style.display = 'block';
        successMsg.style.display = 'none';
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 5000);
    }
});

// ============================================
// GLOBAL FUNCTIONS (called from HTML)
// ============================================

// Open Spam Folder based on user's email provider
window.openSpamFolder = function() {
    const emailInput = document.getElementById('supportEmail');
    const email = emailInput.value.trim() || '';

    let url = '';
    if (email.includes('gmail.com')) {
        url = 'https://mail.google.com/mail/u/0/#spam';
    } else if (email.includes('outlook.com') || email.includes('hotmail.com') || email.includes('live.com')) {
        url = 'https://outlook.live.com/mail/0/junkemail';
    } else if (email.includes('yahoo.com') || email.includes('yahoo.co')) {
        url = 'https://mail.yahoo.com/d/folders/3';
    } else {
        url = 'https://mail.google.com/mail/u/0/#spam';
    }

    if (confirm('Open your spam folder in a new tab? Click OK to continue.')) {
        window.open(url, '_blank');
    }
};

// Report Fake Donor
window.reportFakeUser = function() {
    document.getElementById('supportType').value = 'fake';
    document.getElementById('supportSubject').value = 'Fake Donor Report';
    document.getElementById('supportMessage').value = 
        'I want to report a fake donor. Details:\n\n' +
        'Donor Name: \n' +
        'Donor Blood Group: \n' +
        'Reason: \n\n' +
        '(Please provide as much detail as possible)';
    document.getElementById('supportMessage').focus();
};

// Report Fake Location
window.reportFakeLocation = function() {
    document.getElementById('supportType').value = 'fake';
    document.getElementById('supportSubject').value = 'Fake Location Report';
    document.getElementById('supportMessage').value = 
        'I want to report a fake location. Details:\n\n' +
        'User Name: \n' +
        'Reported Location: \n' +
        'Actual Location: \n' +
        'Reason: \n\n' +
        '(Please provide as much detail as possible)';
    document.getElementById('supportMessage').focus();
};

// ============================================
// MAIL VERIFICATION BLOCK REQUEST
// ============================================
window.requestMailBlock = function(email) {
    if (!email) {
        email = prompt('Enter the email address to block:');
        if (!email) return;
    }

    if (!confirm(`Block this email from creating accounts?\n\n${email}\n\nThis action requires admin approval.`)) return;

    firebase.firestore().collection('blockedEmails').add({
        email: email,
        reportedBy: firebase.auth().currentUser?.uid || 'anonymous',
        reason: 'Suspicious activity / fake account',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert('✅ Request submitted. Admin will review and block this email.');
    })
    .catch(err => {
        alert('Error: ' + err.message);
    });
};