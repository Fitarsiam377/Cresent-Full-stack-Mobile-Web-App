// =============================================
// CRESCENT CARE - SKELETON (FALLBACK SPINNER)
// =============================================

let allDoctors = [];
let isLoading = false;
let hasMore = true;
let lastDoc = null;
const PAGE_SIZE = 30;

let searchTerm = '';
let specialtyFilter = '';
let locationFilter = '';

// =============================================
// SKELETON CARD HTML
// =============================================
function skeletonDoctorCard(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-doctor-card" style="
                background: white;
                border-radius: 16px;
                padding: 16px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                margin-bottom: 12px;
                display: flex;
                gap: 14px;
                align-items: center;
            ">
                <div style="
                    width: 56px; height: 56px; border-radius: 50%;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    flex-shrink: 0;
                "></div>
                <div style="flex:1;">
                    <div style="
                        height: 16px; width: 60%;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 6px;
                        margin-bottom: 8px;
                    "></div>
                    <div style="
                        height: 12px; width: 40%;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 6px;
                    "></div>
                </div>
                <div style="
                    height: 30px; width: 80px;
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
// SHIMMER ANIMATION (ইনজেক্ট)
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

// =============================================
// LOAD DOCTORS (FIRST PAGE)
// =============================================
async function loadDoctorsFromFirestore(reset = true) {
    const container = document.getElementById('doctorListContainer');
    const countEl = document.getElementById('resultsCount');
    if (!container) return;

    if (reset) {
        allDoctors = [];
        lastDoc = null;
        hasMore = true;
        // ✅ শুধু স্কেলেটন দেখান - স্পিনার রিমুভ
        container.innerHTML = skeletonDoctorCard(3);
    }

    if (isLoading || !hasMore) return;
    isLoading = true;

    try {
        let query = firebase.firestore()
            .collection('doctors')
            .orderBy('createdAt', 'desc')
            .limit(PAGE_SIZE);

        if (lastDoc && !reset) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            hasMore = false;
            if (reset) {
                container.innerHTML = `
                    <div class="care-no-results">
                        <i class="fas fa-user-md"></i>
                        <p>No doctors found yet.</p>
                        <p style="font-size:13px; color:#bbb; margin-top:4px;">Check back later or register as a doctor.</p>
                    </div>
                `;
                if (countEl) countEl.textContent = 'Showing 0 doctors';
            }
            isLoading = false;
            return;
        }

        const newDoctors = [];
        snapshot.forEach(doc => {
            newDoctors.push({ id: doc.id, ...doc.data() });
        });

        if (reset) {
            allDoctors = newDoctors;
        } else {
            allDoctors = [...allDoctors, ...newDoctors];
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        if (snapshot.docs.length < PAGE_SIZE) {
            hasMore = false;
        }

        applyFiltersAndRender();

        if (countEl) {
            countEl.textContent = `Showing ${allDoctors.length} doctor${allDoctors.length > 1 ? 's' : ''}`;
        }

    } catch (error) {
        console.error('❌ Error loading doctors:', error);
        if (reset) {
            container.innerHTML = `
                <div class="care-no-results">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load doctors. Please try again.</p>
                    <p style="font-size:13px; color:#bbb; margin-top:4px;">Error: ${error.message}</p>
                </div>
            `;
        }
    } finally {
        isLoading = false;
        updateLoadMoreButton();
    }
}

// =============================================
// LOAD MORE
// =============================================
function loadMoreDoctors() {
    if (!hasMore || isLoading) return;
    loadDoctorsFromFirestore(false);
}

// =============================================
// FILTER & RENDER
// =============================================
function applyFiltersAndRender() {
    const term = searchTerm.toLowerCase().trim();
    const specialty = specialtyFilter;
    const location = locationFilter;

    let filtered = allDoctors.filter(doc => {
        const matchName = doc.name.toLowerCase().includes(term) ||
                          doc.specialty.toLowerCase().includes(term) ||
                          (doc.degree && doc.degree.toLowerCase().includes(term));
        const matchSpecialty = specialty === '' || doc.specialty === specialty;
        const matchLocation = location === '' || doc.location === location;
        return matchName && matchSpecialty && matchLocation;
    });

    renderDoctorCards(filtered);
    const countEl = document.getElementById('resultsCount');
    if (countEl) {
        countEl.textContent = `Showing ${filtered.length} doctor${filtered.length > 1 ? 's' : ''}`;
    }
}

// =============================================
// RENDER DOCTOR CARDS
// =============================================
function renderDoctorCards(doctors) {
    const container = document.getElementById('doctorListContainer');
    container.innerHTML = '';

    if (doctors.length === 0) {
        container.innerHTML = `
            <div class="care-no-results">
                <i class="fas fa-search"></i>
                <p>No doctors match your search.</p>
            </div>
        `;
        return;
    }

    doctors.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'care-doctor-card';

        const statusClass = doc.available ? 'available' : 'unavailable';
        const statusText = doc.available ? '🟢 Available' : '🔴 Unavailable';
        const avatarBg = doc.available ? '#27ae60' : '#e74c3c';

        let avatarHTML = '';
        if (doc.profilePic && doc.profilePic.startsWith('http')) {
            avatarHTML = `<img src="${doc.profilePic}" alt="${doc.name}" loading="lazy" />`;
        } else {
            avatarHTML = `<img src="assets/blank.png" alt="${doc.name}" loading="lazy" />`;
        }

        let typeBadge = doc.docType === 'intern'
            ? `<span style="background:#f39c12; color:white; font-size:10px; padding:2px 12px; border-radius:30px; font-weight:600; margin-left:4px;">📘 Intern</span>`
            : `<span style="background:#2c3e50; color:white; font-size:10px; padding:2px 12px; border-radius:30px; font-weight:600; margin-left:4px;">🛡️ BMDC</span>`;

        const safeName = doc.name.replace(/'/g, "\\'");
        const safePhone = doc.phone || '';

        card.innerHTML = `
            <div class="doc-header">
                <div class="doc-avatar" style="background:${avatarBg};">${avatarHTML}</div>
                <div class="doc-info">
                    <div class="doc-name">${doc.name} ${typeBadge}</div>
                    <div class="doc-specialty"><i class="fas fa-stethoscope"></i> ${doc.specialty}</div>
                    <div style="font-size:12px; color:#888; margin-top:2px;">
                        🏥 ${doc.college || 'N/A'} | 🆔 ${doc.studentId || 'N/A'}
                    </div>
                </div>
                <div class="doc-status-fee">
                    <span class="doc-status ${statusClass}">${statusText}</span>
                    <div class="doc-fee">${doc.fee || 'N/A'}</div>
                </div>
            </div>
            <div class="doc-degree"><i class="fas fa-graduation-cap"></i> ${doc.degree || ''}</div>
            <div class="doc-details">
                <span><i class="fas fa-map-marker-alt"></i> ${doc.location || 'N/A'}</span>
                <span><i class="fas fa-hospital"></i> ${doc.chamber || 'N/A'}</span>
                ${doc.docType === 'bmdc' ? `<span><i class="fas fa-id-card"></i> BMDC: ${doc.bmdc || 'N/A'}</span>` : ''}
                <span><i class="fas fa-phone"></i> ${doc.phone || 'N/A'}</span>
            </div>
            <div class="doc-actions">
                <button class="consult-btn" onclick="consultDoctor('${safeName}', '${safePhone}')">
                    <i class="fas fa-comment-medical"></i> Consult Now
                </button>
                <button class="call-btn" onclick="callDoctor('${safePhone}')">
                    <i class="fas fa-phone"></i> Call
                </button>
                <button class="share-btn" onclick="shareDoctor('${safeName}')">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    updateLoadMoreButton();
}

// =============================================
// LOAD MORE BUTTON / INDICATOR
// =============================================
function updateLoadMoreButton() {
    const container = document.getElementById('doctorListContainer');
    const oldBtn = document.getElementById('loadMoreDoctors');
    if (oldBtn) oldBtn.remove();
    const oldLoader = document.getElementById('loadingMoreIndicator');
    if (oldLoader) oldLoader.remove();

    if (hasMore) {
        if (isLoading) {
            // ✅ স্পিনার রিমুভ - শুধু স্কেলেটন
            const skeletonWrapper = document.createElement('div');
            skeletonWrapper.id = 'loadingMoreIndicator';
            skeletonWrapper.innerHTML = skeletonDoctorCard(2);
            container.appendChild(skeletonWrapper);
        } else {
            const btn = document.createElement('button');
            btn.id = 'loadMoreDoctors';
            btn.textContent = 'Load More Doctors';
            btn.style.cssText = `
                display: block; width: 100%; padding: 12px;
                background: #2c3e50; color: white; border: none;
                border-radius: 30px; font-size: 14px; font-weight: 600;
                cursor: pointer; margin-top: 16px;
            `;
            btn.onclick = loadMoreDoctors;
            container.appendChild(btn);
        }
    }
}

// =============================================
// FILTER FUNCTIONS
// =============================================
function filterDoctors() {
    searchTerm = document.getElementById('docSearch').value;
    specialtyFilter = document.getElementById('docSpecialtyFilter').value;
    locationFilter = document.getElementById('docLocationFilter').value;
    applyFiltersAndRender();
}

function resetFilters() {
    document.getElementById('docSearch').value = '';
    document.getElementById('docSpecialtyFilter').value = '';
    document.getElementById('docLocationFilter').value = '';
    searchTerm = '';
    specialtyFilter = '';
    locationFilter = '';
    applyFiltersAndRender();
}

// =============================================
// ACTION FUNCTIONS
// =============================================
function consultDoctor(name, phone) {
    if (!phone) { alert('Phone number not available.'); return; }
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '+880' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('+')) cleanPhone = '+880' + cleanPhone;
    const message = encodeURIComponent(`Hello Doctor ${name}, I found you on Crescent Care. I need a consultation.`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
}

function callDoctor(phone) {
    if (!phone) { alert('Phone number not available.'); return; }
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '+880' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('+')) cleanPhone = '+880' + cleanPhone;
    window.location.href = `tel:${cleanPhone}`;
}

function shareDoctor(name) {
    if (navigator.share) {
        navigator.share({
            title: `Crescent Care - ${name}`,
            text: `Check out Dr. ${name} on Crescent Care. Find verified doctors in Bangladesh.`,
            url: window.location.href
        }).catch(err => console.log('Share cancelled'));
    } else {
        navigator.clipboard.writeText(`Crescent Care - ${name}. Find verified doctors at ${window.location.href}`)
            .then(() => alert('Link copied to clipboard!'))
            .catch(() => alert('Share not supported.'));
    }
}

// =============================================
// INFINITE SCROLL
// =============================================
function setupInfiniteScroll() {
    const scrollHandler = function() {
        if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 400) {
            if (hasMore && !isLoading) {
                loadMoreDoctors();
            }
        }
    };

    window.addEventListener('scroll', scrollHandler);
    setTimeout(scrollHandler, 500);
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    firebase.auth().onAuthStateChanged(function(user) {
        loadDoctorsFromFirestore(true);
        setupInfiniteScroll();
    });

    const searchInput = document.getElementById('docSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') filterDoctors();
        });
    }

    document.getElementById('docSpecialtyFilter')?.addEventListener('change', filterDoctors);
    document.getElementById('docLocationFilter')?.addEventListener('change', filterDoctors);
});