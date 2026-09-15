// ============================================
// ADMIN SUPPORT TICKETS - SKELETON
// ============================================

let ticketsUnsubscribe = null;

// =============================================
// SKELETON TICKET CARD
// =============================================
function skeletonTicketCard(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="ticket-skeleton-card" style="
                padding: 16px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                margin-bottom: 12px;
                border-left: 4px solid #e0e0e0;
            ">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <div style="
                        height: 18px; width: 50%;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 6px;
                    "></div>
                    <div style="
                        height: 20px; width: 70px;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 20px;
                    "></div>
                </div>
                <div style="
                    height: 14px; width: 60%;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 6px;
                    margin-bottom: 8px;
                "></div>
                <div style="
                    height: 12px; width: 80%;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 6px;
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

document.addEventListener('DOMContentLoaded', function() {
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        firebase.firestore().collection('users').doc(user.uid).get()
            .then(doc => {
                if (!doc.exists || doc.data().isAdmin !== true) {
                    alert('Access denied. Admin only.');
                    window.location.href = 'dashboard.html';
                    return;
                }
                loadTickets();
            })
            .catch(() => {
                window.location.href = 'dashboard.html';
            });
    });
});

function loadTickets() {
    const container = document.getElementById('ticketList');
    const countEl = document.getElementById('ticketCount');

    // ✅ স্কেলেটন দেখান (স্পিনার রিমুভ)
    container.innerHTML = skeletonTicketCard(3);

    if (ticketsUnsubscribe) ticketsUnsubscribe();

    ticketsUnsubscribe = firebase.firestore()
        .collection('supportTickets')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                container.innerHTML = `<div class="no-tickets"><i class="fas fa-inbox"></i><p>No support tickets yet.</p></div>`;
                countEl.textContent = '0';
                return;
            }

            let html = '';
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                count++;
                const statusClass = data.status === 'resolved' ? 'status-resolved' : 'status-pending';
                const time = data.createdAt?.toDate?.() ? data.createdAt.toDate().toLocaleString() : 'N/A';
                
                html += `
                    <div class="ticket-card" id="ticket-${doc.id}">
                        <div class="header">
                            <span class="subject">${escapeHtml(data.subject || 'No subject')}</span>
                            <span class="status ${statusClass}">${data.status || 'pending'}</span>
                        </div>
                        <div class="meta">
                            <strong>${escapeHtml(data.name || 'Unknown')}</strong> &bull; 
                            ${escapeHtml(data.email || 'No email')} &bull; 
                            ${time}
                            <span class="type-badge">${data.type || 'other'}</span>
                        </div>
                        <div class="message">${escapeHtml(data.message || 'No message')}</div>
                        <div class="actions">
                            ${data.status !== 'resolved' ? `
                                <button class="btn-resolve" onclick="resolveTicket('${doc.id}')">
                                    <i class="fas fa-check"></i> Resolve
                                </button>
                            ` : `
                                <span class="resolved-label">✅ Resolved</span>
                            `}
                            <button class="btn-delete" onclick="deleteTicket('${doc.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
            countEl.textContent = count;

        }, (error) => {
            console.error('Error loading tickets:', error);
            container.innerHTML = `<div class="no-tickets"><i class="fas fa-exclamation-circle"></i><p>Error loading tickets.</p></div>`;
        });
}

// Resolve ticket
window.resolveTicket = async function(ticketId) {
    if (!confirm('Mark this ticket as resolved?')) return;
    try {
        await firebase.firestore().collection('supportTickets').doc(ticketId).update({
            status: 'resolved',
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('✅ Ticket marked as resolved!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Delete ticket
window.deleteTicket = async function(ticketId) {
    if (!confirm('Delete this ticket permanently?')) return;
    try {
        await firebase.firestore().collection('supportTickets').doc(ticketId).delete();
        alert('🗑️ Ticket deleted.');
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}