// ============================================
// DASHBOARD - INFINITE SCROLL DONORS (NO SPINNER)
// + LOCATION SEARCH FILTER
// ============================================

let allDonors = [];
let myRequests = [];
let pendingRequests = [];
let currentUser = null;
let userHelpOfferIds = new Set();
let notificationsUnsubscribe = null;
let expiryCheckInterval = null;
let pendingRequestsUnsubscribe = null;
let seenRequestIds = new Set();
let seenNotificationIds = new Set();
let ratingSubmissions = {};
// Donor pagination variables
let donorPageSize = 30;
let lastDonorDoc = null;
let hasMoreDonors = true;
let isLoadingDonors = false;
let donorFilter = '';        // blood group filter
let locationFilterText = ''; // location filter

const PRIORITY_ORDER = { 'Critical': 1, 'Medium': 2, 'Normal': 3 };

// =============================================
// SKELETON CARD HTML (all sections)
// =============================================
function skeletonCard(height = '80px', count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card" style="
                height: ${height};
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
                border-radius: 12px;
                margin-bottom: 12px;
            "></div>
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

// =============================================
// SHOW SKELETONS IMMEDIATELY ON PAGE LOAD (no spinner)
// =============================================
function showInitialSkeletons() {
    const containers = [
        'myRequestsContainer',
        'pendingRequestsContainer',
        'myHelpOffersContainer',
        'myDeliveryRequestsContainer'
    ];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = skeletonCard('90px', 3);
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    showInitialSkeletons();
});

// =============================================
// TIME UTILITY
// =============================================
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

function getColor(bloodGroup) {
    const colors = {
        'A+': '#e74c3c', 'A-': '#c0392b',
        'B+': '#2980b9', 'B-': '#1a5276',
        'AB+': '#8e44ad', 'AB-': '#6c3483',
        'O+': '#27ae60', 'O-': '#1e8449'
    };
    return colors[bloodGroup] || '#2c3e50';
}

// ===== TOAST =====
function showToast(title, body) {
    let toast = document.getElementById('notificationToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'notificationToast';
        toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; background: #2c3e50; color: white;
            padding: 12px 20px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 9999; max-width: 350px; font-family: 'Segoe UI', sans-serif;
            transition: all 0.3s ease; opacity: 0; transform: translateY(20px);
            pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<strong>${title}</strong><br>${body}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 5000);
}

// =============================================
// DONORS - INFINITE SCROLL (PAGINATION + LOCATION FILTER)
// =============================================
function loadDonors(reset = true) {
    const grid = document.getElementById('donorGrid');
    if (!grid) return;

    if (reset) {
        // Reset all state
        allDonors = [];
        lastDonorDoc = null;
        hasMoreDonors = true;
        isLoadingDonors = false;
        donorFilter = document.getElementById('bloodGroupFilter')?.value || '';
        locationFilterText = document.getElementById('locationFilter')?.value.trim().toLowerCase() || '';
        // Show skeleton cards while loading
        grid.innerHTML = skeletonCard('80px', 3);
    }

    if (isLoadingDonors || !hasMoreDonors) return;
    isLoadingDonors = true;

    // Build query
    let query = firebase.firestore()
        .collection('users')
        .orderBy('createdAt', 'desc')
        .limit(donorPageSize);

    if (lastDonorDoc && !reset) {
        query = query.startAfter(lastDonorDoc);
    }

    query.get().then((snapshot) => {
        if (snapshot.empty) {
            hasMoreDonors = false;
            isLoadingDonors = false;
            if (reset) {
                grid.innerHTML = `<div class="no-donors"><i class="fas fa-search"></i><p>No users found. Be the first to join!</p></div>`;
            } else {
                const loadMoreBtn = document.getElementById('loadMoreDonors');
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            }
            return;
        }

        const newDonors = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.name) return;
            newDonors.push({
                id: doc.id,
                uid: data.uid || doc.id,
                name: data.name || 'Unknown',
                blood: data.bloodGroup || 'N/A',
                location: data.location ? `${data.location.city}, ${data.location.area}` : 'Location not set',
                phone: data.phone || '',
                email: data.email || '',
                profilePic: data.profilePic || null,
                isDonor: data.isDonor === true,
                averageRating: data.averageRating || 0,
                totalRatings: data.totalRatings || 0,
                lastDonation: data.lastDonation || null
            });
        });

        // Apply blood group filter (client-side)
        let filteredNew = newDonors;
        if (donorFilter) {
            filteredNew = filteredNew.filter(d => d.blood === donorFilter);
        }

        // Apply location filter (client-side)
        if (locationFilterText) {
            filteredNew = filteredNew.filter(d => {
                const loc = (d.location || '').toLowerCase();
                return loc.includes(locationFilterText);
            });
        }

        if (reset) {
            allDonors = filteredNew;
        } else {
            allDonors = [...allDonors, ...filteredNew];
        }

        lastDonorDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < donorPageSize) {
            hasMoreDonors = false;
        }

        // Render
        renderDonors(allDonors);
        updateDonorLoadMoreButton();
        updateFilterInfo();

        isLoadingDonors = false;
    }).catch((error) => {
        console.error('Error loading donors:', error);
        if (reset) {
            grid.innerHTML = `<div class="no-donors" style="color:#e74c3c;"><i class="fas fa-exclamation-circle"></i><p>Failed to load users. Please refresh.</p></div>`;
        }
        isLoadingDonors = false;
    });
}

// ===== Render donor cards =====
function renderDonors(donorList) {
    const grid = document.getElementById('donorGrid');
    grid.innerHTML = '';
    if (donorList.length === 0) {
        grid.innerHTML = `<div class="no-donors"><i class="fas fa-search"></i><p>No users match your search.</p></div>`;
        return;
    }

    const currentUserUid = firebase.auth().currentUser?.uid;

    donorList.forEach(donor => {
        const card = document.createElement('div');
        card.className = 'donor-card';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '14px';
        card.style.padding = '14px 18px';
        card.style.borderRadius = '18px';
        card.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
        card.style.transition = '0.2s';

        if (!donor.isDonor) {
            card.style.background = '#e6f7ff';
            card.style.border = '2px solid #91d5ff';
        } else {
            card.style.background = 'white';
            card.style.border = '1px solid #f0edea';
        }

        let avatarHTML = '';
        const profilePic = donor.profilePic;

        if (profilePic && (profilePic.startsWith('http') || profilePic.startsWith('data:image'))) {
            avatarHTML = `
                <img src="${profilePic}" alt="${donor.name}" loading="lazy" 
                     onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:56px; height:56px; border-radius:50%; background:${getColor(donor.blood)}; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:24px; flex-shrink:0;\\'>${donor.name.charAt(0).toUpperCase()}</div>';" 
                     style="width:56px; height:56px; border-radius:50%; object-fit:cover; border:2px solid #2c3e50;" />
            `;
        } else {
            avatarHTML = `<div style="width:56px; height:56px; border-radius:50%; background:${getColor(donor.blood)}; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:24px; flex-shrink:0;">${donor.name.charAt(0).toUpperCase()}</div>`;
        }

        const safeName = donor.name.replace(/'/g, "\\'");
        const statusBadge = donor.isDonor
            ? `<span style="background:#27ae60; color:white; font-size:11px; font-weight:700; padding:2px 12px; border-radius:30px; display:inline-block;">🩸 Donor</span>`
            : `<span style="background:#e74c3c; color:white; font-size:11px; font-weight:700; padding:2px 12px; border-radius:30px; display:inline-block;">⛔ Not a Donor</span>`;

        const avg = donor.averageRating || 0;
        const total = donor.totalRatings || 0;
        const fullStars = Math.floor(avg);
        const halfStar = avg % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        const RECEIVED_STAR_COLOR = '#2980b9';
        let starsHTML = '';
        for (let i = 0; i < fullStars; i++) starsHTML += `<i class="fas fa-star" style="color:${RECEIVED_STAR_COLOR}; font-size:14px;"></i>`;
        if (halfStar) starsHTML += `<i class="fas fa-star-half-alt" style="color:${RECEIVED_STAR_COLOR}; font-size:14px;"></i>`;
        for (let i = 0; i < emptyStars; i++) starsHTML += `<i class="far fa-star" style="color:#ddd; font-size:14px;"></i>`;
        const ratingText = total > 0 ? `${avg.toFixed(1)} (${total} review${total > 1 ? 's' : ''})` : 'No reviews yet';
        const canRate = currentUserUid && currentUserUid !== donor.uid;
        let lastDonationDisplay = donor.lastDonation || 'Not recorded yet';

        card.innerHTML = `
            <div style="flex-shrink:0;">${avatarHTML}</div>
            <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px;">
                    <span style="font-weight:700; font-size:16px; color:#2c3e50;">${donor.name}</span>
                    <span style="font-size:13px; color:#c0392b; font-weight:600;">🩸 ${donor.blood}</span>
                    ${statusBadge}
                </div>
                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:13px; color:#555;">
                    <span><i class="fas fa-phone" style="width:16px; color:#888;"></i> ${donor.phone || 'N/A'}</span>
                    <span><i class="fas fa-map-marker-alt" style="width:16px; color:#888;"></i> ${donor.location || 'N/A'}</span>
                    <span style="display:inline-flex; align-items:center; gap:2px;">${starsHTML}<span style="font-size:12px; color:#888; margin-left:4px;">${ratingText}</span></span>
                </div>
                <div style="font-size:13px; color:#555; margin-top:2px;">
                    <i class="fas fa-calendar-alt" style="width:16px; color:#888;"></i> Last Donation: ${lastDonationDisplay}
                </div>
                <div style="display:flex; gap:6px; margin-top:2px;">
                    <button class="talk-btn" onclick="talkWithDonor('${safeName}', '${donor.phone}')" style="flex:1; background:#eef2f7; color:#2c3e50; border:none; padding:6px 0; border-radius:30px; font-size:13px; font-weight:600; cursor:pointer; transition:0.2s;">
                        <i class="fas fa-comment"></i> Talk
                    </button>
                    <button class="call-btn" onclick="callDonor('${donor.phone}')" style="flex:1; background:#2c3e50; color:white; border:none; padding:6px 0; border-radius:30px; font-size:13px; font-weight:600; cursor:pointer; transition:0.2s;">
                        <i class="fas fa-phone"></i> Call
                    </button>
                    <button class="chat-btn" onclick="startChatWithUser('${donor.uid}')" style="flex:1; background:#3498db; color:white; border:none; padding:6px 0; border-radius:30px; font-size:13px; font-weight:600; cursor:pointer; transition:0.2s;">
                        <i class="fas fa-comment-dots"></i> Chat
                    </button>
                </div>
                ${canRate ? `
                <div style="display:flex; gap:2px; margin-top:2px; align-items:center;">
                    <span style="font-size:12px; color:#888; margin-right:4px;">Rate:</span>
                    <span class="rate-stars-row" data-selected-rating="0" onmouseleave="resetRateStars(this)" style="display:inline-flex; gap:2px;">
                        ${[1,2,3,4,5].map(star => `
                            <span class="rate-star" data-star="${star}" style="cursor:pointer; font-size:18px; color:#ddd; transition:0.15s;"
                                  onmouseenter="previewRateStars(this, ${star})"
                                  onclick="rateUser('${donor.uid}', ${star}, this)">
                                <i class="far fa-star"></i>
                            </span>
                        `).join('')}
                    </span>
                </div>
                ` : ''}
            </div>
        `;
        grid.appendChild(card);
    });

    updateDonorLoadMoreButton();
}

// ===== Update Load More button/indicator =====
function updateDonorLoadMoreButton() {
    const grid = document.getElementById('donorGrid');
    const oldBtn = document.getElementById('loadMoreDonors');
    if (oldBtn) oldBtn.remove();

    if (hasMoreDonors) {
        if (isLoadingDonors) {
            const loader = document.createElement('div');
            loader.id = 'loadMoreDonors';
            loader.style.cssText = 'margin-top: 16px;';
            loader.innerHTML = skeletonCard('60px', 1);
            grid.appendChild(loader);
        } else {
            const btn = document.createElement('button');
            btn.id = 'loadMoreDonors';
            btn.textContent = 'Load More Donors';
            btn.style.cssText = `
                display: block; width: 100%; padding: 12px;
                background: #2c3e50; color: white; border: none;
                border-radius: 30px; font-size: 14px; font-weight: 600;
                cursor: pointer; margin-top: 16px;
            `;
            btn.onclick = () => loadDonors(false);
            grid.appendChild(btn);
        }
    }
}

// ===== RATE STARS =====
const RATE_INPUT_COLOR = '#f1c40f';
function paintRateStars(row, count) {
    const stars = row.querySelectorAll('.rate-star');
    stars.forEach((span) => {
        const starNum = parseInt(span.dataset.star, 10);
        const icon = span.querySelector('i');
        if (starNum <= count) {
            span.style.color = RATE_INPUT_COLOR;
            if (icon) icon.className = 'fas fa-star';
        } else {
            span.style.color = '#ddd';
            if (icon) icon.className = 'far fa-star';
        }
    });
}
window.previewRateStars = function(starEl, count) {
    const row = starEl.closest('.rate-stars-row');
    if (row) paintRateStars(row, count);
};
window.resetRateStars = function(row) {
    const selected = parseInt(row.dataset.selectedRating || '0', 10);
    paintRateStars(row, selected);
};
window.rateUser = function(ratedUserId, rating, element) {
    const row = element.closest('.rate-stars-row');
    if (row) {
        row.dataset.selectedRating = String(rating);
        paintRateStars(row, rating);
    }
    submitRating(ratedUserId, rating);
};

// ===== Submit rating =====
async function submitRating(ratedUserId, rating) {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to rate.');
        return;
    }
    if (user.uid === ratedUserId) {
        alert('You cannot rate yourself.');
        return;
    }

    const key = `${ratedUserId}_${user.uid}`;
    if (ratingSubmissions[key]) return;
    ratingSubmissions[key] = true;
    setTimeout(() => { delete ratingSubmissions[key]; }, 3000);

    try {
        await firebase.firestore()
            .collection('users')
            .doc(ratedUserId)
            .collection('ratings')
            .doc(user.uid)
            .set({
                rating: rating,
                raterId: user.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

        const ratingsSnap = await firebase.firestore()
            .collection('users')
            .doc(ratedUserId)
            .collection('ratings')
            .get();

        let total = 0;
        let count = 0;
        ratingsSnap.forEach(doc => {
            total += doc.data().rating;
            count++;
        });
        const avg = count > 0 ? total / count : 0;

        await firebase.firestore()
            .collection('users')
            .doc(ratedUserId)
            .update({
                averageRating: avg,
                totalRatings: count
            });

        showToast('⭐ Rating Submitted', `You rated this user ${rating} stars.`);
    } catch (error) {
        console.error('Rating error:', error);
        alert('Failed to submit rating. Please try again.');
    }
}

function talkWithDonor(name, phone) {
    if (!phone) { alert('Phone number not available.'); return; }
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '+880' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('+')) cleanPhone = '+880' + cleanPhone;
    const message = encodeURIComponent("Hello! I found your contact on Crescent+ and I need blood urgently. Can you please help me?");
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
}
function callDonor(phone) {
    if (!phone) { alert('Phone number not available.'); return; }
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '+880' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('+')) cleanPhone = '+880' + cleanPhone;
    window.location.href = `tel:${cleanPhone}`;
}

// ===== Search/Filter donors =====
function searchDonors() {
    donorFilter = document.getElementById('bloodGroupFilter')?.value || '';
    locationFilterText = document.getElementById('locationFilter')?.value.trim().toLowerCase() || '';
    loadDonors(true);
}

// ===== Apply Location Filter (Search button) =====
function applyLocationFilter() {
    const input = document.getElementById('locationFilter');
    const clearBtn = document.getElementById('clearLocationBtn');
    if (input && input.value.trim() !== '') {
        if (clearBtn) clearBtn.style.display = 'block';
    } else {
        if (clearBtn) clearBtn.style.display = 'none';
    }
    searchDonors();
}

// ===== Clear Location Filter =====
function clearLocationFilter() {
    const input = document.getElementById('locationFilter');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearLocationBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    searchDonors();
}

// ===== Update Active Filter Info =====
function updateFilterInfo() {
    const infoBox = document.getElementById('activeFilterInfo');
    const textEl = document.getElementById('filterText');
    if (!infoBox || !textEl) return;

    if (donorFilter || locationFilterText) {
        let parts = [];
        if (donorFilter) parts.push(`Blood: ${donorFilter}`);
        if (locationFilterText) parts.push(`Location: "${locationFilterText}"`);
        textEl.textContent = `${parts.join(' · ')} — ${allDonors.length} donor${allDonors.length !== 1 ? 's' : ''} found`;
        infoBox.style.display = 'block';
    } else {
        infoBox.style.display = 'none';
    }
}

// ===== Toggle donor list =====
function toggleDonorList() {
    const container = document.getElementById('donorGridContainer');
    const btn = document.getElementById('toggleDonorsBtn');
    if (!container) return;
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-times"></i> Hide donors';
        if (allDonors.length === 0) {
            loadDonors(true);
        } else {
            searchDonors();
        }
    } else {
        container.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-users"></i> See our community';
    }
}

// =============================================
// NOTIFICATIONS
// =============================================
function loadNotifications() {
    const user = firebase.auth().currentUser;
    if (!user) {
        const container = document.getElementById('notificationList');
        if (container) container.innerHTML = '<div class="noti-empty">Please log in to see notifications</div>';
        return;
    }

    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
        notificationsUnsubscribe = null;
    }

    const container = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    if (!container) return;

    notificationsUnsubscribe = firebase.firestore()
        .collection('notifications')
        .where('userId', '==', user.uid)
        .limit(20)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (seenNotificationIds.has(change.doc.id)) return;
                    seenNotificationIds.add(change.doc.id);
                    const title = data.title || 'New Notification';
                    const body = data.body || 'You have a new notification.';
                    if (typeof showToast === 'function') showToast(title, body);
                    if (Notification.permission === 'granted') {
                        navigator.serviceWorker.ready.then(registration => {
                            registration.showNotification('🔔 Crescent+', {
                                body: `${title}: ${body}`,
                                icon: '/assets/Crescentlogo.png',
                                tag: `notif-${change.doc.id}`,
                                data: { url: '/dashboard.html' }
                            });
                        }).catch(err => console.warn('SW notification error:', err));
                    }
                }
            });

            let unreadCount = 0;
            let notifications = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.createdAt && data.createdAt.toDate) data._date = data.createdAt.toDate();
                else data._date = new Date(0);
                data._id = doc.id;
                notifications.push(data);
            });
            notifications.sort((a, b) => b._date - a._date);

            let html = '';
            notifications.forEach((data) => {
                if (!data.read) unreadCount++;
                const time = data._date && data._date.getTime() > 0 ? timeSince(data._date) : 'Just now';
                html += `
                    <div class="notification-item ${data.read ? 'read' : 'unread'}" data-id="${data._id}">
                        <div class="noti-icon">${data.icon || '📨'}</div>
                        <div class="noti-content">
                            <div class="noti-title">${data.title || 'Notification'}</div>
                            <div class="noti-body">${data.body || ''}</div>
                            <div class="noti-time">${time}</div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html || '<div class="noti-empty">No notifications</div>';
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }

            document.querySelectorAll('.notification-item.unread').forEach(el => {
                el.addEventListener('click', function() {
                    const id = this.dataset.id;
                    if (id) {
                        firebase.firestore().collection('notifications').doc(id).update({ read: true })
                            .then(() => {
                                this.classList.remove('unread');
                                this.classList.add('read');
                                const badgeEl = document.getElementById('notificationBadge');
                                if (badgeEl) {
                                    let count = parseInt(badgeEl.textContent) || 0;
                                    count = Math.max(0, count - 1);
                                    if (count > 0) {
                                        badgeEl.textContent = count;
                                        badgeEl.style.display = 'flex';
                                    } else {
                                        badgeEl.style.display = 'none';
                                    }
                                }
                            })
                            .catch(err => console.warn('Mark read error:', err));
                    }
                });
            });

        }, (error) => {
            console.error('🔴 Notification listener error:', error);
            container.innerHTML = '<div class="noti-empty">No notifications</div>';
            if (badge) badge.style.display = 'none';
        });
}

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        const list = document.getElementById('notificationList');
        if (list && list.children.length === 0) loadNotifications();
    }
}

async function checkAndDeleteExpiredRequests() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const db = firebase.firestore();
    const now = new Date();
    const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    try {
        const snapshot = await db.collection('bloodRequests')
            .where('userId', '==', user.uid)
            .where('status', '==', 'Pending')
            .where('createdAt', '<=', cutoff)
            .get();

        if (snapshot.empty) return;
        const batch = db.batch();
        let count = 0;
        snapshot.forEach(doc => { batch.delete(doc.ref); count++; });
        await batch.commit();
        if (count > 0) showToast('🗑️ Auto Deleted', `${count} expired request(s) removed.`);
    } catch (error) {
        console.error('Error deleting expired requests:', error);
    }
}

// =============================================
// MY REQUESTS - SKELETON FIRST
// =============================================
async function loadMyRequests() {
    const container = document.getElementById('myRequestsContainer');
    if (container) {
        container.innerHTML = skeletonCard('90px', 3);
    }

    try {
        const user = firebase.auth().currentUser;
        if (!user) return;
        currentUser = user;

        const snapshot = await firebase.firestore()
            .collection('bloodRequests')
            .where('userId', '==', user.uid)
            .get();

        myRequests = [];
        snapshot.forEach(doc => {
            myRequests.push({ id: doc.id, ...doc.data() });
        });

        myRequests.sort((a, b) => {
            const aTime = a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
        });

        const displayRequests = myRequests.slice(0, 20);

        await Promise.all(displayRequests.map(async (req) => {
            const offersSnapshot = await firebase.firestore()
                .collection('helpOffers')
                .where('requestId', '==', req.id)
                .get();

            if (!offersSnapshot.empty) {
                const offerDoc = offersSnapshot.docs[0];
                const offerData = offerDoc.data();
                const donorId = offerData.helperId;
                const donorDoc = await firebase.firestore().collection('users').doc(donorId).get();
                if (donorDoc.exists) {
                    const donorData = donorDoc.data();
                    req.donorInfo = {
                        id: donorId,
                        name: donorData.name || 'Unknown',
                        phone: donorData.phone || 'N/A',
                        location: donorData.location ? `${donorData.location.city}, ${donorData.location.area}` : 'N/A',
                        profilePic: donorData.profilePic || null,
                        bloodGroup: donorData.bloodGroup || 'N/A'
                    };
                }
            }
        }));

        renderMyRequests(displayRequests);

    } catch (error) {
        console.error('Error loading my requests:', error);
        if (container) {
            container.innerHTML = `<p style="color:#e74c3c; text-align:center;">
                ⚠️ Could not load your requests. Please refresh.
            </p>`;
        }
    }
}

function renderMyRequests(requests) {
    const container = document.getElementById('myRequestsContainer');
    container.innerHTML = '';
    if (requests.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">
            <i class="fas fa-inbox" style="font-size:30px; display:block; margin-bottom:8px;"></i>
            No requests yet.
        </div>`;
        return;
    }

    requests.forEach(req => {
        const card = document.createElement('div');
        card.className = 'request-card';
        const timeAgo = req.createdAt ? timeSince(req.createdAt.toDate()) : 'Just now';
        const priorityClass = (req.priority || 'Normal').toLowerCase();
        const statusClass = (req.status || 'Pending').toLowerCase();
        const hospital = req.hospitalAddress || req.hospital || 'N/A';
        const profilePic = req.userProfilePic || `https://ui-avatars.com/api/?name=${req.userName || 'U'}&background=2c3e50&color=fff&size=64&bold=true`;

        let donorHTML = '';
        if (req.donorInfo) {
            const donor = req.donorInfo;
            const donorPic = donor.profilePic || `https://ui-avatars.com/api/?name=${donor.name.charAt(0).toUpperCase()}&background=27ae60&color=fff&size=40`;
            donorHTML = `
                <div class="donor-info-badge">
                    <img src="${donorPic}" alt="${donor.name}" loading="lazy" />
                    <div class="donor-details">
                        <div class="donor-name">${donor.name}</div>
                        <div class="donor-detail">${donor.phone} · ${donor.location}</div>
                    </div>
                    <div class="contact-btns">
                        <button class="whatsapp-btn" onclick="whatsappRequester('${donor.phone}')"><i class="fab fa-whatsapp"></i></button>
                        <button class="call-btn" onclick="callRequester('${donor.phone}')"><i class="fas fa-phone"></i></button>
                    </div>
                </div>
            `;
        }

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
                <div class="request-patient"><strong>${req.patientName}</strong> – ${hospital}</div>
                <div class="request-meta"><span><i class="fas fa-clock"></i> ${timeAgo}</span></div>
                ${req.note ? `<div class="request-note">📝 ${req.note}</div>` : ''}
                ${donorHTML}
            </div>
            <div class="request-card-actions">
                <button class="action-btn view" onclick="viewRequestDetails('${req.id}')"><i class="fas fa-eye"></i> Details</button>
                ${req.status === 'Pending' ? `
                    <button class="action-btn found" onclick="markFoundMyRequest('${req.id}')"><i class="fas fa-check"></i> Found</button>
                ` : `
                    <span class="resolved-label">${req.status === 'Found' ? '✅ Resolved' : '❌ Cancelled'}</span>
                `}
                <button class="action-btn cancel" onclick="deleteMyRequest('${req.id}')"><i class="fas fa-trash"></i> Remove</button>
                ${req.status === 'Pending' && req.donorInfo ? `
                    <button class="action-btn delivery-btn" onclick="requestDeliveryForRequest('${req.id}')"><i class="fas fa-truck"></i> Request Delivery</button>
                ` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

window.markFoundMyRequest = async function(requestId) {
    if (!confirm('Mark this request as found?')) return;
    try {
        await firebase.firestore().collection('bloodRequests').doc(requestId).update({
            status: 'Found',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('✅ Request marked as found!');
        loadMyRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

window.deleteMyRequest = async function(requestId) {
    if (!confirm('Are you sure you want to delete this request?')) return;
    try {
        await firebase.firestore().collection('bloodRequests').doc(requestId).delete();
        alert('🗑️ Request deleted.');
        loadMyRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

async function requestDeliveryForRequest(requestId) {
    try {
        const offersSnapshot = await firebase.firestore()
            .collection('helpOffers')
            .where('requestId', '==', requestId)
            .get();
        if (offersSnapshot.empty) {
            alert('No one has offered help for this request yet.');
            return;
        }
        const offerDoc = offersSnapshot.docs[0];
        const offerData = offerDoc.data();
        const donorId = offerData.helperId;
        const donorDoc = await firebase.firestore().collection('users').doc(donorId).get();
        if (!donorDoc.exists) {
            alert('Donor data not found.');
            return;
        }
        const donorData = donorDoc.data();
        const donorName = donorData.name || 'Unknown';
        const donorPhone = donorData.phone || 'N/A';
        const donorAddress = donorData.location ? `${donorData.location.city}, ${donorData.location.area}` : 'N/A';
        const bloodGroup = donorData.bloodGroup || 'N/A';
        openDeliveryModal(requestId, donorId, donorName, donorPhone, donorAddress, bloodGroup);
    } catch (error) {
        console.error('Error fetching donor for delivery:', error);
        alert('Could not fetch donor information.');
    }
}

// =============================================
// REQUEST DETAILS MODAL
// =============================================
window.viewRequestDetails = async function(requestId) {
    try {
        const doc = await firebase.firestore().collection('bloodRequests').doc(requestId).get();
        if (!doc.exists) { alert('Request not found.'); return; }
        const data = doc.data();
        const modal = document.getElementById('requestModal');
        const content = document.getElementById('modalContent');

        const time = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'N/A';
        const priorityClass = (data.priority || 'Normal').toLowerCase();
        const statusClass = (data.status || 'Pending').toLowerCase();
        const hospital = data.hospitalAddress || data.hospital || 'N/A';
        const profilePic = data.userProfilePic || `https://ui-avatars.com/api/?name=${data.userName || 'U'}&background=2c3e50&color=fff&size=80&bold=true`;

        let hasOffer = false;
        let donorId = '', donorName = '', donorPhone = '', donorAddress = '', bloodGroup = '';

        if (data.status === 'Pending') {
            const offersSnapshot = await firebase.firestore()
                .collection('helpOffers')
                .where('requestId', '==', requestId)
                .limit(1)
                .get();
            if (!offersSnapshot.empty) {
                hasOffer = true;
                const offerData = offersSnapshot.docs[0].data();
                donorId = offerData.helperId;
                const donorDoc = await firebase.firestore().collection('users').doc(donorId).get();
                if (donorDoc.exists) {
                    const dData = donorDoc.data();
                    donorName = dData.name || 'Unknown';
                    donorPhone = dData.phone || 'N/A';
                    donorAddress = dData.location ? `${dData.location.city}, ${dData.location.area}` : 'N/A';
                    bloodGroup = dData.bloodGroup || 'N/A';
                }
            }
        }

        content.innerHTML = `
            <div class="modal-print-wrapper" id="printableArea">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${profilePic}" alt="${data.userName}" loading="lazy" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid #2c3e50;" />
                        <div>
                            <h2 style="margin:0;">🩸 Blood Request</h2>
                            <div style="font-size:13px; color:#888;">by ${data.userName || 'Anonymous'}</div>
                        </div>
                    </div>
                    <span class="request-id">#${requestId.slice(0, 8)}</span>
                </div>
                <div class="modal-status-bar">
                    <span class="priority-badge ${priorityClass}">${data.priority || 'Normal'}</span>
                    <span class="status-badge ${statusClass}">${data.status || 'Pending'}</span>
                </div>
                <div class="modal-body">
                    <div class="detail-row"><span class="label">Patient</span><span class="value">${data.patientName}</span></div>
                    <div class="detail-row"><span class="label">Age</span><span class="value">${data.patientAge || 'N/A'}</span></div>
                    ${data.disease ? `<div class="detail-row"><span class="label">Disease</span><span class="value">${data.disease}</span></div>` : ''}
                    <div class="detail-row"><span class="label">Blood Group</span><span class="value">${data.bloodGroup}</span></div>
                    <div class="detail-row"><span class="label">Hospital</span><span class="value">${hospital}</span></div>
                    <div class="detail-row"><span class="label">Units</span><span class="value">${data.units || 1}</span></div>
                    <div class="detail-row"><span class="label">Requested by</span><span class="value">${data.userName || 'Anonymous'}</span></div>
                    <div class="detail-row"><span class="label">Contact</span><span class="value">${data.userPhone || 'N/A'}</span></div>
                    <div class="detail-row"><span class="label">Created</span><span class="value">${time}</span></div>
                    ${data.note ? `<div class="detail-row note-row"><span class="label">Note</span><span class="value">${data.note}</span></div>` : ''}
                </div>
                <div class="modal-footer"><small>Crescent+ · Blood Donation Platform</small></div>
            </div>
            <div class="modal-actions" style="display:grid; grid-template-columns:${hasOffer ? '1fr 1fr 1fr' : '1fr 1fr'}; gap:10px; padding:0 30px 30px;">
                <button class="action-btn print-btn" onclick="printRequest()"><i class="fas fa-print"></i> Print</button>
                ${hasOffer ? `<button class="action-btn delivery-btn" onclick="openDeliveryModal('${requestId}', '${donorId}', '${donorName}', '${donorPhone}', '${donorAddress}', '${bloodGroup}')"><i class="fas fa-truck" style="font-size:13px;"></i> Request Delivery</button>` : ''}
                <button class="action-btn close-modal-btn" onclick="closeModal()"><i class="fas fa-times"></i> Close</button>
            </div>
        `;
        modal.style.display = 'flex';
    } catch (error) {
        alert('Error loading details: ' + error.message);
    }
};

window.closeModal = function() {
    document.getElementById('requestModal').style.display = 'none';
};

window.printRequest = function() {
    const printContents = document.getElementById('printableArea').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>Blood Request</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
            .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2c3e50; padding-bottom: 12px; margin-bottom: 16px; }
            .modal-header h2 { font-size: 24px; font-weight: 800; color: #2c3e50; margin: 0; }
            .request-id { font-size: 13px; color: #888; background: #f0f0f0; padding: 4px 14px; border-radius: 30px; }
            .modal-status-bar { display: flex; gap: 10px; margin-bottom: 16px; }
            .priority-badge, .status-badge { font-size: 13px; font-weight: 700; padding: 4px 16px; border-radius: 30px; color: white; }
            .priority-badge.critical { background: #c0392b; }
            .priority-badge.medium { background: #e67e22; }
            .priority-badge.normal { background: #27ae60; }
            .status-badge.pending { background: #2980b9; }
            .status-badge.found { background: #27ae60; }
            .status-badge.cancelled { background: #95a5a6; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-row .label { font-weight: 600; color: #555; }
            .detail-row .value { color: #2c3e50; text-align: right; }
            .note-row { flex-direction: column; align-items: flex-start; gap: 4px; background: #faf8f6; padding: 12px 16px; border-radius: 8px; margin-top: 6px; }
            .note-row .value { text-align: left; width: 100%; }
            .modal-footer { margin-top: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 12px; }
        </style>
        </head><body>${printContents}</body></html>
    `);
    win.document.close();
    win.print();
};

function callRequester(phone) {
    if (!phone) { alert('Phone number not available.'); return; }
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '+880' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('+')) cleanPhone = '+880' + cleanPhone;
    window.location.href = `tel:${cleanPhone}`;
}

function whatsappRequester(phone) {
    if (!phone) { alert('Phone number not available.'); return; }
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '+880' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('+')) cleanPhone = '+880' + cleanPhone;
    const message = encodeURIComponent("Hello! I saw your blood request on Crescent+ and I can help. Please contact me.");
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
}

// =============================================
// HELP OFFERS - SKELETON FIRST
// =============================================
async function loadMyHelpOffers() {
    const container = document.getElementById('myHelpOffersContainer');
    if (container) container.innerHTML = skeletonCard('80px', 2);

    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const offersSnapshot = await firebase.firestore()
            .collection('helpOffers')
            .where('helperId', '==', user.uid)
            .get();

        if (offersSnapshot.empty) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">
                <i class="fas fa-inbox" style="font-size:30px; display:block; margin-bottom:8px;"></i>
                No active offers.
            </div>`;
            return;
        }

        const offerResults = await Promise.all(offersSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            const requestDoc = await firebase.firestore().collection('bloodRequests').doc(data.requestId).get();
            if (!requestDoc.exists) return null;
            return { offerId: doc.id, requestId: data.requestId, ...requestDoc.data() };
        }));
        const offerData = offerResults.filter(Boolean);

        if (offerData.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">
                <i class="fas fa-inbox" style="font-size:30px; display:block; margin-bottom:8px;"></i>
                No active offers.
            </div>`;
            return;
        }
        renderMyHelpOffers(offerData);
    } catch (error) {
        console.error('Error loading help offers:', error);
        container.innerHTML = `<p style="color:#e74c3c; text-align:center;">Failed to load your offers.</p>`;
    }
}

function renderMyHelpOffers(offers) {
    const container = document.getElementById('myHelpOffersContainer');
    container.innerHTML = '';
    offers.forEach(offer => {
        const card = document.createElement('div');
        card.className = 'request-card';
        const timeAgo = offer.createdAt ? timeSince(offer.createdAt.toDate()) : 'Just now';
        const priorityClass = (offer.priority || 'Normal').toLowerCase();
        const hospital = offer.hospitalAddress || offer.hospital || 'N/A';
        const profilePic = offer.userProfilePic || `https://ui-avatars.com/api/?name=${offer.userName || 'U'}&background=2c3e50&color=fff&size=64&bold=true`;
        const userPhone = offer.userPhone || '';

        card.innerHTML = `
            <div class="request-card-header" style="display:flex; align-items:center; gap:12px;">
                <img src="${profilePic}" alt="${offer.userName}" loading="lazy" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #2c3e50;" />
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="blood-group">🩸 ${offer.bloodGroup}</span>
                        <span class="priority-badge ${priorityClass}">${offer.priority || 'Normal'}</span>
                    </div>
                    <div style="font-size:13px; color:#888; margin-top:2px;">
                        <i class="fas fa-user"></i> ${offer.userName || 'Anonymous'}
                    </div>
                </div>
            </div>
            <div class="request-card-body">
                <div class="request-patient"><strong>${offer.patientName}</strong> – ${hospital}</div>
                <div class="request-meta">
                    <span><i class="fas fa-user"></i> ${offer.userName || 'Anonymous'}</span>
                    <span><i class="fas fa-phone"></i> ${offer.userPhone || 'N/A'}</span>
                    <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                </div>
                ${offer.note ? `<div class="request-note">📝 ${offer.note}</div>` : ''}
            </div>
            <div class="request-card-actions">
                <button class="action-btn view" onclick="viewRequestDetails('${offer.requestId}')"><i class="fas fa-eye"></i> Details</button>
                ${userPhone ? `
                    <button class="action-btn whatsapp-btn" onclick="whatsappRequester('${userPhone}')"><i class="fab fa-whatsapp"></i></button>
                    <button class="action-btn call-btn" onclick="callRequester('${userPhone}')"><i class="fas fa-phone"></i></button>
                ` : ''}
                <button class="action-btn cancel" onclick="cancelHelpOffer('${offer.offerId}', '${offer.requestId}')">
                    <i class="fas fa-times"></i> Cancel Help
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.cancelHelpOffer = async function(offerId, requestId) {
    if (!confirm('Are you sure you want to cancel your help offer?')) return;
    try {
        await firebase.firestore().collection('helpOffers').doc(offerId).delete();
        alert('Help offer cancelled.');
        await loadPendingRequests();
        await loadMyHelpOffers();
        const modal = document.getElementById('requestModal');
        if (modal.style.display === 'flex') viewRequestDetails(requestId);
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

window.toggleHelpOffer = async function(requestId) {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in.');
        return;
    }

    try {
        const offersSnapshot = await firebase.firestore()
            .collection('helpOffers')
            .where('requestId', '==', requestId)
            .where('helperId', '==', user.uid)
            .get();

        if (!offersSnapshot.empty) {
            const doc = offersSnapshot.docs[0];
            await doc.ref.delete();
            alert('You have cancelled your help offer.');
        } else {
            await firebase.firestore().collection('helpOffers').add({
                requestId: requestId,
                helperId: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            });

            const requestDoc = await firebase.firestore().collection('bloodRequests').doc(requestId).get();
            if (!requestDoc.exists) {
                alert('Request not found.');
                return;
            }
            const requestData = requestDoc.data();
            const requesterId = requestData.userId;
            const bloodGroup = requestData.bloodGroup || 'N/A';
            const patientName = requestData.patientName || 'a patient';

            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            const helperName = userData.name || user.displayName || 'Someone';

            await firebase.firestore().collection('notifications').add({
                userId: requesterId,
                title: '🩸 Help Offer Received',
                body: `${helperName} offered to donate ${bloodGroup} blood for ${patientName}.`,
                icon: '🩸',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                data: { requestId: requestId, helperId: user.uid }
            });

            await createOrGetChatRoom(user.uid, requesterId, requestId);
            alert('✅ You offered help! A chat room has been created.');
        }

        await loadPendingRequests();
        await loadMyHelpOffers();
        const modal = document.getElementById('requestModal');
        if (modal.style.display === 'flex') viewRequestDetails(requestId);
    } catch (error) {
        console.error('Toggle help error:', error);
        alert('Error: ' + error.message);
    }
};

// =============================================
// PENDING REQUESTS - SKELETON FIRST
// =============================================
async function loadPendingRequests() {
    const container = document.getElementById('pendingRequestsContainer');
    if (!container) return;

    if (pendingRequestsUnsubscribe) {
        pendingRequestsUnsubscribe();
        pendingRequestsUnsubscribe = null;
    }

    const user = firebase.auth().currentUser;
    if (!user) {
        container.innerHTML = `<p style="color:#e74c3c; text-align:center;">Please log in.</p>`;
        return;
    }

    container.innerHTML = skeletonCard('95px', 3);

    pendingRequestsUnsubscribe = firebase.firestore()
        .collection('bloodRequests')
        .where('status', '==', 'Pending')
        .limit(50)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.userId === user.uid) return;
                    if (seenRequestIds.has(change.doc.id)) return;
                    seenRequestIds.add(change.doc.id);
                    const requesterName = data.userName || 'Someone';
                    const bloodGroup = data.bloodGroup || 'N/A';
                    const msg = `🩸 ${requesterName} requested ${bloodGroup} blood`;
                    if (typeof showToast === 'function') showToast('New Blood Request', msg);
                    if (Notification.permission === 'granted') {
                        navigator.serviceWorker.ready.then(registration => {
                            registration.showNotification('🩸 Crescent+ - New Blood Request', {
                                body: msg,
                                icon: '/assets/Crescentlogo.png',
                                tag: `request-${change.doc.id}`,
                                data: { url: '/dashboard.html' }
                            });
                        }).catch(err => console.warn('SW notification error:', err));
                    }
                }
            });

            const updatedRequests = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId !== user.uid) {
                    updatedRequests.push({ id: doc.id, ...data });
                }
            });

            updatedRequests.sort((a, b) => {
                const pa = PRIORITY_ORDER[a.priority] || 3;
                const pb = PRIORITY_ORDER[b.priority] || 3;
                if (pa !== pb) return pa - pb;
                const aTime = a.createdAt ? a.createdAt.toDate().getTime() : 0;
                const bTime = b.createdAt ? b.createdAt.toDate().getTime() : 0;
                return bTime - aTime;
            });

            pendingRequests = updatedRequests;
            renderPendingRequests(pendingRequests);

        }, (error) => {
            console.error('❌ Pending requests listener error:', error);
            container.innerHTML = `<p style="color:#e74c3c; text-align:center;">⚠️ Could not load pending requests. Please refresh.</p>`;
        });
}

function renderPendingRequests(requests) {
    const container = document.getElementById('pendingRequestsContainer');
    container.innerHTML = '';

    if (requests.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">
            <i class="fas fa-check-circle" style="font-size:30px; display:block; margin-bottom:8px; color:#2ecc71;"></i>
            No pending requests from others.
        </div>`;
        return;
    }

    requests.forEach(req => {
        const card = document.createElement('div');
        card.className = 'request-card';
        const timeAgo = req.createdAt ? timeSince(req.createdAt.toDate()) : 'Just now';
        const priorityClass = (req.priority || 'Normal').toLowerCase();

        const hasOffered = userHelpOfferIds.has(req.id);
        const helpButtonText = hasOffered ? 'Cancel Help' : 'I Can Help';
        const helpIcon = hasOffered ? 'fa-times' : 'fa-hand-holding-heart';
        const helpClass = hasOffered ? 'cancel' : 'help-btn';

        const hospital = req.hospitalAddress || req.hospital || 'N/A';
        const profilePic = req.userProfilePic || `https://ui-avatars.com/api/?name=${req.userName || 'U'}&background=2c3e50&color=fff&size=64&bold=true`;
        const userPhone = req.userPhone || '';

        card.innerHTML = `
            <div class="request-card-header" style="display:flex; align-items:center; gap:12px;">
                <img src="${profilePic}" alt="${req.userName}" loading="lazy" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #2c3e50;" />
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="blood-group">🩸 ${req.bloodGroup}</span>
                        <span class="priority-badge ${priorityClass}">${req.priority || 'Normal'}</span>
                    </div>
                    <div style="font-size:13px; color:#888; margin-top:2px;">
                        <i class="fas fa-user"></i> ${req.userName || 'Anonymous'}
                    </div>
                </div>
            </div>
            <div class="request-card-body">
                <div class="request-patient"><strong>${req.patientName}</strong> – ${hospital}</div>
                <div class="request-meta">
                    <span><i class="fas fa-user"></i> ${req.userName || 'Anonymous'}</span>
                    <span><i class="fas fa-phone"></i> ${req.userPhone || 'N/A'}</span>
                    <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                </div>
                ${req.note ? `<div class="request-note">📝 ${req.note}</div>` : ''}
            </div>
            <div class="request-card-actions" style="display:flex; flex-wrap:wrap; gap:6px;">
                <button class="action-btn view" onclick="viewRequestDetails('${req.id}')"><i class="fas fa-eye"></i> Details</button>
                ${userPhone ? `
                    <button class="action-btn whatsapp-btn" onclick="whatsappRequester('${userPhone}')"><i class="fab fa-whatsapp"></i></button>
                    <button class="action-btn call-btn" onclick="callRequester('${userPhone}')"><i class="fas fa-phone"></i></button>
                ` : ''}
                <button class="action-btn ${helpClass}" onclick="toggleHelpOffer('${req.id}')">
                    <i class="fas ${helpIcon}"></i> ${helpButtonText}
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

// =============================================
// MY DELIVERY REQUESTS - SKELETON FIRST
// =============================================
async function loadMyDeliveryRequests() {
    const container = document.getElementById('myDeliveryRequestsContainer');
    if (!container) return;
    container.innerHTML = skeletonCard('100px', 2);

    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const snapshot = await firebase.firestore()
            .collection('deliveryRequests')
            .where('userId', '==', user.uid)
            .get();

        const donorSnapshot = await firebase.firestore()
            .collection('deliveryRequests')
            .where('donorId', '==', user.uid)
            .get();

        let deliveryRequests = [];
        snapshot.forEach(doc => deliveryRequests.push({ id: doc.id, ...doc.data() }));
        donorSnapshot.forEach(doc => {
            if (!deliveryRequests.find(r => r.id === doc.id)) {
                deliveryRequests.push({ id: doc.id, ...doc.data() });
            }
        });

        deliveryRequests.sort((a, b) => {
            const aTime = a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
        });

        renderMyDeliveryRequests(deliveryRequests);
    } catch (error) {
        console.error('Error loading delivery requests:', error);
        container.innerHTML = `<p style="color:#e74c3c; text-align:center;">Failed to load delivery requests.</p>`;
    }
}

function renderMyDeliveryRequests(requests) {
    const container = document.getElementById('myDeliveryRequestsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (requests.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">
            <i class="fas fa-truck" style="font-size:30px; display:block; margin-bottom:8px;"></i>
            No delivery requests yet.
        </div>`;
        return;
    }

    requests.forEach(req => {
        const card = document.createElement('div');
        card.className = 'request-card';
        const timeAgo = req.createdAt ? timeSince(req.createdAt.toDate()) : 'Just now';
        const statusClass = (req.status || 'pending').toLowerCase();
        const donorPic = req.donorProfilePic || `https://ui-avatars.com/api/?name=${req.donorName?.charAt(0) || 'D'}&background=27ae60&color=fff&size=40`;
        const userPic = req.userProfilePic || `https://ui-avatars.com/api/?name=${req.userName?.charAt(0) || 'U'}&background=2980b9&color=fff&size=40`;

        card.innerHTML = `
            <div class="request-card-header">
                <span class="blood-group">🩸 ${req.bloodGroup || 'N/A'}</span>
                <span class="status-badge ${statusClass}">${req.status || 'Pending'}</span>
            </div>
            <div class="request-card-body">
                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:6px; background:#f0f8f0; padding:4px 10px; border-radius:20px;">
                        <img src="${donorPic}" loading="lazy" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" />
                        <span><strong>Donor:</strong> ${req.donorName || 'Unknown'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; background:#eef4fb; padding:4px 10px; border-radius:20px;">
                        <img src="${userPic}" loading="lazy" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" />
                        <span><strong>Recipient:</strong> ${req.userName || 'Unknown'}</span>
                    </div>
                </div>
                <div class="delivery-location-details" style="background:#f8f6f4; padding:10px; border-radius:8px; margin:6px 0;">
                    <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
                        <span><i class="fas fa-map-marker-alt" style="color:#27ae60;"></i> <strong>Pickup:</strong> ${req.donorAddress || 'N/A'}</span>
                        <span><i class="fas fa-map-marker-alt" style="color:#c0392b;"></i> <strong>Dropoff:</strong> ${req.userAddress || 'N/A'}</span>
                    </div>
                </div>
                <div class="delivery-cost-details" style="display:flex; justify-content:space-between; background:#faf8f6; padding:8px 12px; border-radius:8px;">
                    <span>📏 <strong>Distance:</strong> ${req.distance || 0} km</span>
                    <span>💰 <strong>Travel Cost:</strong> ${req.travelCost || 0} BDT</span>
                    <span>💳 <strong>Payment:</strong> ${(req.paymentMethod || 'N/A').toUpperCase()}</span>
                </div>
                ${req.note ? `<div class="request-note">📝 ${req.note}</div>` : ''}
            </div>
            <div class="request-card-actions">
                <button class="action-btn view" onclick="printDeliveryCard('${req.id}')"><i class="fas fa-print"></i> Print Card</button>
                ${req.status === 'pending' ? `<button class="action-btn found" onclick="markDeliveryCompleted('${req.id}')"><i class="fas fa-check"></i> Mark Done</button>` : `<span class="resolved-label">✅ ${req.status === 'completed' ? 'Completed' : 'Cancelled'}</span>`}
                <button class="action-btn cancel" onclick="deleteDeliveryRequest('${req.id}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.deleteDeliveryRequest = async function(deliveryId) {
    if (!confirm('Delete this delivery request? This cannot be undone.')) return;
    try {
        await firebase.firestore().collection('deliveryRequests').doc(deliveryId).delete();
        alert('🗑️ Delivery request deleted.');
        loadMyDeliveryRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

window.markDeliveryCompleted = async function(deliveryId) {
    if (!confirm('Mark this delivery as completed?')) return;
    try {
        await firebase.firestore().collection('deliveryRequests').doc(deliveryId).update({
            status: 'completed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('✅ Delivery marked as completed!');
        loadMyDeliveryRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// =============================================
// CHAT ROOM
// =============================================
async function createOrGetChatRoom(userId1, userId2, requestId = null) {
    try {
        const snapshot = await firebase.firestore()
            .collection('chats')
            .where('participants', 'array-contains', userId1)
            .get();

        let existingChat = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.participants.includes(userId2)) {
                existingChat = { id: doc.id, ...data };
            }
        });

        if (existingChat) return existingChat.id;

        const chatData = {
            participants: [userId1, userId2],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: '',
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
            unread: { [userId1]: 0, [userId2]: 0 }
        };
        if (requestId) chatData.requestId = requestId;
        const chatRef = await firebase.firestore().collection('chats').add(chatData);
        return chatRef.id;
    } catch (error) {
        console.error('Error creating chat room:', error);
        return null;
    }
}

window.startChatWithUser = async function(otherUserId) {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert('Please log in to chat.');
        window.location.href = 'login.html';
        return;
    }
    if (otherUserId === user.uid) {
        alert('You cannot chat with yourself.');
        return;
    }

    try {
        const chatId = await createOrGetChatRoom(user.uid, otherUserId);
        if (chatId) {
            window.location.href = `chat-window.html?chatId=${chatId}&otherId=${otherUserId}`;
        } else {
            alert('Failed to start chat. Please try again.');
        }
    } catch (error) {
        console.error('Start chat error:', error);
        alert('Error starting chat: ' + error.message);
    }
};

// =============================================
// AUTO-DELETE & ADMIN CHECK
// =============================================
function startExpiryCheckInterval() {
    if (expiryCheckInterval) clearInterval(expiryCheckInterval);
    expiryCheckInterval = setInterval(() => {
        checkAndDeleteExpiredRequests();
    }, 5 * 60 * 1000);
}

async function checkAdminAndShowButton() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        const btn = document.getElementById('adminPanelBtn');
        if (btn) {
            btn.style.display = (doc.exists && doc.data().isAdmin === true) ? 'block' : 'none';
        }
    } catch (e) {
        console.error('Admin check error:', e);
    }
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    // Blood group filter
    const bloodFilter = document.getElementById('bloodGroupFilter');
    if (bloodFilter) bloodFilter.addEventListener('change', searchDonors);

    // Location search bar
    const locationInput = document.getElementById('locationFilter');
    if (locationInput) {
        locationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyLocationFilter();
            }
        });

        let locTimer;
        locationInput.addEventListener('input', function() {
            clearTimeout(locTimer);
            const val = this.value.trim();
            const clearBtn = document.getElementById('clearLocationBtn');
            if (clearBtn) clearBtn.style.display = val !== '' ? 'block' : 'none';

            locTimer = setTimeout(() => {
                searchDonors();
            }, 300);
        });
    }

    const user = firebase.auth().currentUser;
    if (user) {
        checkAndDeleteExpiredRequests();
        startExpiryCheckInterval();
        setTimeout(checkAdminAndShowButton, 500);
    }
});

firebase.auth().onAuthStateChanged(async function(user) {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;

    const nameEl = document.getElementById('userName');
    const displayName = user.displayName || 'User';
    if (nameEl) nameEl.textContent = displayName;

    const userDocRef = firebase.firestore().collection('users').doc(user.uid);
    const unsubscribe = userDocRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const finalName = data.name || user.displayName || 'User';
            if (nameEl) nameEl.textContent = finalName;
            const profileIcon = document.getElementById('profileIconImg');
            if (profileIcon) {
                if (data.profilePic) profileIcon.src = data.profilePic;
                else {
                    const initial = (data.name || 'U').charAt(0).toUpperCase();
                    profileIcon.src = `https://ui-avatars.com/api/?name=${initial}&background=2c3e50&color=fff&size=100`;
                }
            }
        } else {
            if (nameEl) nameEl.textContent = user.displayName || 'User';
        }
    }, (error) => {
        console.error('Error listening to user doc:', error);
    });

    checkAndDeleteExpiredRequests();
    startExpiryCheckInterval();

    await Promise.all([
        loadMyRequests(),
        loadPendingRequests()
    ]);

    setTimeout(() => {
        loadMyHelpOffers();
        loadMyDeliveryRequests();
        loadNotifications();
        checkAdminAndShowButton();
    }, 1500);
});