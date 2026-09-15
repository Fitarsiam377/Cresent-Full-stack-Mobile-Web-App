// ============================================
// ADMIN PANEL - SKELETON + PAGINATION
// ============================================

console.log('✅ admin.js loaded');

let currentTab = 'all';
let allUsers = [];
let allDoctors = [];
let allDonors = [];

// Pagination
let pageSize = 20;
let currentPage = 1;
let totalPages = 1;
let filteredItems = [];

// =============================================
// SKELETON CARD HTML
// =============================================
function skeletonAdminCard(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="admin-skeleton-card" style="
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 18px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                margin-bottom: 12px;
            ">
                <div style="
                    width: 48px; height: 48px; border-radius: 50%;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    flex-shrink: 0;
                "></div>
                <div style="flex:1;">
                    <div style="
                        height: 16px; width: 50%;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 6px;
                        margin-bottom: 8px;
                    "></div>
                    <div style="
                        height: 12px; width: 30%;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 6px;
                    "></div>
                </div>
                <div style="
                    height: 28px; width: 70px;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 20px;
                    flex-shrink: 0;
                "></div>
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

function initAdmin() {
    firebase.auth().onAuthStateChanged(async function(user) {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        try {
            const doc = await firebase.firestore().collection('users').doc(user.uid).get();
            if (doc.exists && doc.data().isAdmin === true) {
                // Show admin content immediately with skeletons
                document.getElementById('adminLoading').style.display = 'none';
                document.getElementById('adminContent').style.display = 'block';
                document.getElementById('adminListContainer').innerHTML = skeletonAdminCard(5);
                await loadAllData();
            } else {
                alert('⛔ Access denied. Admin only.');
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            console.error('Admin check error:', error);
            alert('Error verifying admin status.');
            window.location.href = 'dashboard.html';
        }
    });
}

async function loadAllData() {
    try {
        const usersSnap = await firebase.firestore().collection('users').get();
        allUsers = [];
        usersSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));

        const doctorsSnap = await firebase.firestore().collection('doctors').get();
        allDoctors = [];
        doctorsSnap.forEach(doc => allDoctors.push({ id: doc.id, ...doc.data() }));

        allDonors = allUsers.filter(u => u.isDonor === true);

        updateStats();
        applyFiltersAndRender();
    } catch (error) {
        console.error('Load error:', error);
        document.getElementById('adminListContainer').innerHTML = `
            <div class="no-data">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load data: ${error.message}</p>
            </div>
        `;
    }
}

function updateStats() {
    document.getElementById('totalUsers').textContent = allUsers.length;
    document.getElementById('totalDoctors').textContent = allDoctors.length;
    document.getElementById('totalDonors').textContent = allDonors.length;
}

function switchTab(tab) {
    currentTab = tab;
    currentPage = 1;
    document.querySelectorAll('.admin-tabs button').forEach(btn => btn.classList.remove('active'));
    if (tab === 'all') {
        document.getElementById('tabAll').classList.add('active');
    } else if (tab === 'doctors') {
        document.getElementById('tabDoctors').classList.add('active');
    } else {
        document.getElementById('tabDonors').classList.add('active');
    }
    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    let items = [];
    let label = '';

    if (currentTab === 'all') {
        items = allUsers;
        label = 'users';
    } else if (currentTab === 'doctors') {
        items = allDoctors;
        label = 'doctors';
    } else {
        items = allDonors;
        label = 'donors';
    }

    filteredItems = items;
    totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
    renderList(currentTab);
    renderPagination();
}

function renderList(tab) {
    const container = document.getElementById('adminListContainer');
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredItems.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-users"></i>
                <p>No ${tab} found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    pageItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'admin-card';

        const isVerified = item.verified === true;
        const isAdmin = item.isAdmin === true;
        const isDonor = item.isDonor === true;

        let badgeText = isVerified ? '✅ Verified' : '⏳ Pending';
        let badgeClass = isVerified ? 'verified' : 'pending';
        if (isAdmin) {
            badgeText = '👑 Admin';
            badgeClass = 'admin';
        } else if (isDonor && !isAdmin) {
            badgeText = '🩸 Donor';
            badgeClass = 'donor';
        }

        const name = item.name || 'Unknown';
        const initial = name.charAt(0).toUpperCase();
        const avatarBg = isAdmin ? '#c0392b' : (isVerified ? '#27ae60' : '#f39c12');

        let avatarHTML = '';
        const profilePic = item.profilePic;
        if (profilePic && (profilePic.startsWith('http') || profilePic.startsWith('data:image'))) {
            avatarHTML = `<img src="${profilePic}" alt="${name}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />`;
        } else {
            avatarHTML = `<span style="font-size:20px; font-weight:700;">${initial}</span>`;
        }

        let detailText = '';
        if (tab === 'doctors') {
            detailText = `${item.specialty || 'N/A'} · ${item.location || 'N/A'}`;
        } else {
            detailText = `🩸 ${item.bloodGroup || 'N/A'} · ${item.location?.city || 'N/A'}`;
        }

        let verifyBtn = '';
        if (!isAdmin) {
            if (isVerified) {
                verifyBtn = `<button class="btn-unverify" onclick="toggleVerify('${item.id}', false)">Unverify</button>`;
            } else {
                verifyBtn = `<button class="btn-verify" onclick="toggleVerify('${item.id}', true)">Verify</button>`;
            }
        }

        card.innerHTML = `
            <div class="avatar" style="background:${avatarBg}; display:flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; flex-shrink:0; overflow:hidden;">${avatarHTML}</div>
            <div class="info" style="flex:1; min-width:0;">
                <div class="name" style="font-weight:600; font-size:15px; color:#2c3e50;">${name} <span class="badge ${badgeClass}" style="font-size:11px; padding:2px 10px; border-radius:30px; color:white; background:${isAdmin ? '#c0392b' : isVerified ? '#27ae60' : '#f39c12'};">${badgeText}</span></div>
                <div class="detail" style="font-size:13px; color:#888;">${detailText}</div>
                ${item.phone ? `<div class="detail" style="font-size:13px; color:#888;">📞 ${item.phone}</div>` : ''}
                ${item.email ? `<div class="detail" style="font-size:13px; color:#888;">✉️ ${item.email}</div>` : ''}
            </div>
            <div class="actions" style="display:flex; gap:6px; flex-shrink:0;">
                ${verifyBtn}
                <button class="btn-delete" onclick="deleteUser('${item.id}')" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:30px; cursor:pointer; font-size:13px;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderPagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = `<div style="display:flex; justify-content:center; gap:6px; margin-top:16px; flex-wrap:wrap;">`;
    for (let i = 1; i <= totalPages; i++) {
        const active = i === currentPage ? 'background:#2c3e50; color:white;' : 'background:#eee; color:#2c3e50;';
        html += `<button onclick="goToPage(${i})" style="border:none; padding:6px 14px; border-radius:30px; cursor:pointer; font-weight:600; ${active}">${i}</button>`;
    }
    html += `</div>`;
    paginationContainer.innerHTML = html;
}

window.goToPage = function(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderList(currentTab);
    renderPagination();
    document.getElementById('adminListContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.toggleVerify = async function(userId, status) {
    const confirmMsg = status ? 'Verify this user?' : 'Unverify this user?';
    if (!confirm(confirmMsg)) return;

    try {
        await firebase.firestore().collection('users').doc(userId).update({
            verified: status
        });
        alert(`✅ User ${status ? 'verified' : 'unverified'}!`);
        await loadAllData();
    } catch (error) {
        console.error('Verify error:', error);
        alert('Error: ' + error.message);
    }
};

window.deleteUser = async function(userId) {
    const confirmMsg = '⚠️ Are you sure you want to DELETE this user?\n\nThis action is irreversible!';
    if (!confirm(confirmMsg)) return;

    try {
        await firebase.firestore().collection('users').doc(userId).delete();
        const doctorSnap = await firebase.firestore().collection('doctors').where('uid', '==', userId).get();
        if (!doctorSnap.empty) {
            await firebase.firestore().collection('doctors').doc(doctorSnap.docs[0].id).delete();
        }
        alert('🗑️ User deleted successfully!');
        await loadAllData();
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error: ' + error.message);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    initAdmin();
});