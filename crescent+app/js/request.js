// ============================================
// BLOOD REQUEST SYSTEM - SKELETON + OPTIMIZED (NO INDEX)
// ============================================

let currentUser = null;
let editingRequestId = null;
let allRequests = [];
let autocompleteTimeout = null;

const LOCATIONIQ_TOKEN = 'pk.6233e1f050e2472d37bc17cb18a3b519';

// =============================================
// SKELETON REQUEST CARD
// =============================================
function skeletonRequestCard(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="request-skeleton-card" style="
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 16px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                margin-bottom: 12px;
            ">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="
                        width: 40px; height: 40px; border-radius: 50%;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                    "></div>
                    <div style="flex:1;">
                        <div style="
                            height: 14px; width: 60%;
                            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                            background-size: 200% 100%;
                            animation: shimmer 1.5s infinite;
                            border-radius: 6px;
                            margin-bottom: 6px;
                        "></div>
                        <div style="
                            height: 12px; width: 40%;
                            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                            background-size: 200% 100%;
                            animation: shimmer 1.5s infinite;
                            border-radius: 6px;
                        "></div>
                    </div>
                </div>
                <div style="
                    height: 16px; width: 80%;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 6px;
                "></div>
                <div style="display:flex; gap:8px;">
                    <div style="
                        height: 30px; width: 60px;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 20px;
                    "></div>
                    <div style="
                        height: 30px; width: 60px;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 20px;
                    "></div>
                </div>
            </div>
        `;
    }
    return html;
}

// =============================================
// SHIMMER ANIMATION (inject once)
// =============================================
(function injectShimmerCSS() {
    if (document.getElementById('shimmer-style')) return;
    const style = document.createElement('style');
    style.id = 'shimmer-style';
    style.textContent = `
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
    `;
    document.head.appendChild(style);
})();

document.addEventListener('DOMContentLoaded', function() {
    const priorityBtns = document.querySelectorAll('.priority-btn');
    priorityBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            priorityBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('priority').value = this.dataset.value;
        });
    });

    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = user;
        loadRequests();
    });

    const form = document.getElementById('requestForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const addressInput = document.getElementById('hospitalAddress');
    if (addressInput) {
        addressInput.addEventListener('input', function() {
            clearTimeout(autocompleteTimeout);
            const query = this.value.trim();
            if (query.length < 3) {
                document.getElementById('suggestions-box').style.display = 'none';
                return;
            }
            autocompleteTimeout = setTimeout(() => fetchLocationIQSuggestions(query), 300);
        });
        document.addEventListener('click', function(e) {
            const wrapper = document.querySelector('.autocomplete-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                document.getElementById('suggestions-box').style.display = 'none';
            }
        });
    }

    document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

    const searchBtn = document.querySelector('.search-donor-btn');
    if (searchBtn) searchBtn.addEventListener('click', searchDonorsForRequest);
});

async function fetchLocationIQSuggestions(query) {
    try {
        const url = `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(query)}&limit=5&countrycodes=bd`;
        const response = await fetch(url);
        if (!response.ok) {
            document.getElementById('suggestions-box').style.display = 'none';
            return;
        }
        const data = await response.json();
        const box = document.getElementById('suggestions-box');
        box.innerHTML = '';
        if (!Array.isArray(data) || data.length === 0) {
            box.style.display = 'none';
            return;
        }
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = item.display_name || '';
            div.addEventListener('click', function() {
                document.getElementById('hospitalAddress').value = div.textContent;
                box.style.display = 'none';
            });
            box.appendChild(div);
        });
        box.style.display = 'block';
    } catch (error) {
        console.error('LocationIQ error:', error);
        document.getElementById('suggestions-box').style.display = 'none';
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
        alert('You must be logged in.');
        return;
    }

    const patientName = document.getElementById('patientName').value.trim();
    const patientAge = parseInt(document.getElementById('patientAge').value);
    const disease = document.getElementById('disease').value.trim();
    const bloodGroup = document.getElementById('bloodGroup').value;
    const hospitalAddress = document.getElementById('hospitalAddress').value.trim();
    const units = parseInt(document.getElementById('units').value) || 1;
    const priority = document.getElementById('priority').value;
    const note = document.getElementById('note').value.trim();

    if (!patientName || !patientAge || !bloodGroup || !hospitalAddress) {
        alert('Please fill in all required fields.');
        return;
    }
    if (isNaN(patientAge) || patientAge < 0 || patientAge > 120) {
        alert('Please enter a valid age (0-120).');
        return;
    }

    try {
        const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data() || {};
        const userName = userData.name || currentUser.displayName || 'User';
        const userPhone = userData.phone || '';
        const userProfilePic = userData.profilePic || null;

        const requestData = {
            userId: currentUser.uid,
            userName: userName,
            userPhone: userPhone,
            userProfilePic: userProfilePic,
            patientName: patientName,
            patientAge: patientAge,
            disease: disease,
            bloodGroup: bloodGroup,
            hospitalAddress: hospitalAddress,
            units: units,
            priority: priority,
            note: note,
            status: 'Pending',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingRequestId) {
            await firebase.firestore().collection('bloodRequests').doc(editingRequestId).update(requestData);
            alert('Request updated successfully!');
            editingRequestId = null;
            document.getElementById('cancelEditBtn').style.display = 'none';
            document.querySelector('.submit-request-btn').innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
        } else {
            requestData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await firebase.firestore().collection('bloodRequests').add(requestData);
            alert('Request submitted successfully!');
        }

        resetForm();
        setTimeout(() => loadRequests(), 500);

    } catch (error) {
        console.error('Error saving request:', error);
        alert('Error: ' + error.message);
    }
}

// =============================================
// LOAD REQUESTS - NO ORDERBY (NO INDEX NEEDED)
// =============================================
async function loadRequests() {
    const container = document.getElementById('requestList');
    if (!currentUser) return;
    // ✅ স্কেলেটন দেখান
    container.innerHTML = skeletonRequestCard(3);

    try {
        const snapshot = await firebase.firestore()
            .collection('bloodRequests')
            .where('userId', '==', currentUser.uid)
            .get();

        allRequests = [];
        snapshot.forEach(doc => {
            allRequests.push({ id: doc.id, ...doc.data() });
        });

        // ✅ ক্লায়েন্ট সাইডে createdAt অনুযায়ী সাজান (নতুন থেকে পুরোনো)
        allRequests.sort((a, b) => {
            const aTime = a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
        });

        // শুধু সর্বশেষ ২০টি দেখান
        const displayRequests = allRequests.slice(0, 20);
        renderRequests(displayRequests);

    } catch (error) {
        console.error('Error loading requests:', error);
        container.innerHTML = '<p style="color:#e74c3c; text-align:center;">Failed to load requests. Please try again.</p>';
    }
}

function renderRequests(requests) {
    const container = document.getElementById('requestList');
    container.innerHTML = '';

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No requests yet. Create one above!</p>
            </div>
        `;
        return;
    }

    requests.forEach(req => {
        const card = document.createElement('div');
        card.className = 'request-card';
        const timeAgo = req.createdAt ? timeSince(req.createdAt.toDate()) : 'Just now';
        const priorityClass = (req.priority || 'Normal').toLowerCase();
        const statusClass = (req.status || 'Pending').toLowerCase();

        const profilePic = req.userProfilePic || `https://ui-avatars.com/api/?name=${req.userName || 'U'}&background=2c3e50&color=fff&size=64&bold=true`;

        card.innerHTML = `
            <div class="request-card-header" style="display:flex; align-items:center; gap:12px;">
                <img src="${profilePic}" alt="${req.userName}" loading="lazy" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #2c3e50;" />
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="blood-group">🩸 ${req.bloodGroup}</span>
                        <span class="priority-badge ${priorityClass}">${req.priority}</span>
                        <span class="status-badge ${statusClass}">${req.status}</span>
                    </div>
                    <div style="font-size:13px; color:#888; margin-top:2px;">
                        <i class="fas fa-user"></i> ${req.userName || 'Anonymous'}
                    </div>
                </div>
            </div>
            <div class="request-card-body">
                <div class="request-patient"><strong>${req.patientName}</strong> (${req.patientAge || 'N/A'} yrs)</div>
                <div class="request-meta">
                    <span><i class="fas fa-hospital"></i> ${req.hospitalAddress || 'N/A'}</span>
                    <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                </div>
                ${req.disease ? `<div class="request-note">🩺 ${req.disease}</div>` : ''}
                ${req.note ? `<div class="request-note">📝 ${req.note}</div>` : ''}
            </div>
            <div class="request-card-actions">
                ${req.status === 'Pending' ? `
                    <button class="action-btn found" onclick="markFound('${req.id}')"><i class="fas fa-check"></i> Found</button>
                    <button class="action-btn edit" onclick="editRequest('${req.id}')"><i class="fas fa-edit"></i> Edit</button>
                    <button class="action-btn cancel" onclick="cancelRequest('${req.id}')"><i class="fas fa-times"></i> Cancel</button>
                ` : `
                    <span class="resolved-label">${req.status === 'Found' ? '✅ Resolved' : '❌ Cancelled'}</span>
                `}
            </div>
        `;
        container.appendChild(card);
    });
}

window.markFound = async function(requestId) {
    if (!confirm('Mark this request as found?')) return;
    try {
        await firebase.firestore().collection('bloodRequests').doc(requestId).update({
            status: 'Found',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Request marked as found!');
        loadRequests();
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
};

window.cancelRequest = async function(requestId) {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    try {
        await firebase.firestore().collection('bloodRequests').doc(requestId).update({
            status: 'Cancelled',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Request cancelled.');
        loadRequests();
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
};

window.editRequest = function(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    editingRequestId = requestId;
    document.getElementById('patientName').value = request.patientName || '';
    document.getElementById('patientAge').value = request.patientAge || '';
    document.getElementById('disease').value = request.disease || '';
    document.getElementById('bloodGroup').value = request.bloodGroup || '';
    document.getElementById('hospitalAddress').value = request.hospitalAddress || '';
    document.getElementById('units').value = request.units || 1;
    document.getElementById('note').value = request.note || '';

    const priorityBtns = document.querySelectorAll('.priority-btn');
    priorityBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.value === request.priority) btn.classList.add('active');
    });
    document.getElementById('priority').value = request.priority || 'Normal';

    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    document.querySelector('.submit-request-btn').innerHTML = '<i class="fas fa-save"></i> Update Request';
    document.querySelector('.request-form-section').scrollIntoView({ behavior: 'smooth' });
};

function resetForm() {
    document.getElementById('requestForm').reset();
    document.getElementById('priority').value = 'Normal';
    const priorityBtns = document.querySelectorAll('.priority-btn');
    priorityBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.value === 'Normal') btn.classList.add('active');
    });
    editingRequestId = null;
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.querySelector('.submit-request-btn').innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
    document.getElementById('suggestions-box').style.display = 'none';
}

function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + ' year' + (interval > 1 ? 's' : '') + ' ago';
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + ' month' + (interval > 1 ? 's' : '') + ' ago';
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + ' day' + (interval > 1 ? 's' : '') + ' ago';
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + ' hour' + (interval > 1 ? 's' : '') + ' ago';
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + ' minute' + (interval > 1 ? 's' : '') + ' ago';
    return 'Just now';
}

// ===== SEARCH DONORS =====
async function searchDonorsForRequest() {
    const resultsContainer = document.getElementById('donorSearchResults');
    const bloodGroup = document.getElementById('bloodGroup').value;
    if (!bloodGroup) {
        alert('Please select a blood group first.');
        return;
    }

    resultsContainer.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;

    try {
        const snapshot = await firebase.firestore()
            .collection('users')
            .where('isDonor', '==', true)
            .where('bloodGroup', '==', bloodGroup)
            .get();

        let donors = [];
        snapshot.forEach(doc => donors.push({ id: doc.id, ...doc.data() }));

        const hospitalAddr = document.getElementById('hospitalAddress').value.trim().toLowerCase();
        if (hospitalAddr) {
            donors = donors.filter(d => {
                const city = (d.location?.city || '').toLowerCase();
                const area = (d.location?.area || '').toLowerCase();
                return city.includes(hospitalAddr) || area.includes(hospitalAddr);
            });
        }

        if (donors.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results-found">
                    <i class="fas fa-search"></i>
                    <p>No donors found matching your request.</p>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = '';
        donors.forEach(donor => {
            const card = document.createElement('div');
            card.className = 'donor-result-card';
            const profilePic = donor.profilePic && (donor.profilePic.startsWith('http') || donor.profilePic.startsWith('data:image'))
                ? donor.profilePic
                : `https://ui-avatars.com/api/?name=${donor.name || 'U'}&background=2c3e50&color=fff&size=64`;
            const safeName = (donor.name || 'Unknown').replace(/'/g, "\\'");
            const phone = donor.phone || 'N/A';
            const blood = donor.bloodGroup || 'N/A';

            card.innerHTML = `
                <img src="${profilePic}" alt="${donor.name}" loading="lazy" class="result-avatar" />
                <div class="result-info">
                    <div class="result-name">${donor.name || 'Unknown'}</div>
                    <div class="result-blood">🩸 ${blood}</div>
                    <div class="result-phone"><i class="fas fa-phone"></i> ${phone}</div>
                </div>
                <div class="result-actions">
                    <button class="contact-donor-btn" onclick="talkWithDonor('${safeName}', '${phone}')">
                        <i class="fas fa-comment"></i> Contact
                    </button>
                </div>
            `;
            resultsContainer.appendChild(card);
        });

    } catch (error) {
        console.error('Error searching donors:', error);
        resultsContainer.innerHTML = `
            <div class="no-results-found" style="color:#e74c3c;">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to search donors. Please try again.</p>
            </div>
        `;
    }
}

function talkWithDonor(name, phone) {
    if (!phone || phone === 'N/A') { alert('Phone number not available.'); return; }
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '+880' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('+')) cleanPhone = '+880' + cleanPhone;
    const message = encodeURIComponent("Hello! I found you as a potential donor on Crescent+ for my blood request. Can you please help?");
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
}