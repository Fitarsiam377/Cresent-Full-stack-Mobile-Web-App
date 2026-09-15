// ============================================
// CHAT LIST - SKELETON + IMAGES (NO SPINNER)
// ============================================

let chatUnsubscribe = null;

// =============================================
// SKELETON CARD HTML (chat list items)
// =============================================
function skeletonChatCard(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="chat-skeleton-item" style="
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
                        height: 12px; width: 60%;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 6px;
                    "></div>
                </div>
                <div style="
                    height: 20px; width: 40px;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 10px;
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

document.addEventListener('DOMContentLoaded', function() {
    // Show skeletons immediately
    const container = document.getElementById('chatList');
    if (container) {
        container.innerHTML = skeletonChatCard(3);
    }

    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        loadChatList(user.uid);
    });
});

function loadChatList(userId) {
    const container = document.getElementById('chatList');
    // Show skeletons while loading (if not already shown)
    container.innerHTML = skeletonChatCard(3);

    if (chatUnsubscribe) chatUnsubscribe();

    chatUnsubscribe = firebase.firestore()
        .collection('chats')
        .where('participants', 'array-contains', userId)
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                container.innerHTML = `<div class="no-chats"><i class="fas fa-comment-slash"></i><p>No conversations yet. Start chatting by clicking Chat button on a donor or doctor card.</p></div>`;
                return;
            }

            let chats = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                chats.push({ id: doc.id, ...data });
            });
            chats.sort((a, b) => {
                const timeA = a.lastMessageTime?.toDate?.() || new Date(0);
                const timeB = b.lastMessageTime?.toDate?.() || new Date(0);
                return timeB - timeA;
            });

            container.innerHTML = '';
            chats.forEach(chat => {
                const otherId = chat.participants.find(id => id !== userId);
                const unread = chat.unread?.[userId] || 0;

                firebase.firestore().collection('users').doc(otherId).get()
                    .then(userDoc => {
                        if (!userDoc.exists) return;
                        const userData = userDoc.data();
                        const name = userData.name || 'Unknown';
                        const initial = name.charAt(0).toUpperCase();
                        const avatarBg = '#2c3e50';

                        const item = document.createElement('div');
                        item.className = 'chat-item';
                        item.onclick = (e) => {
                            if (e.target.closest('.delete-chat-btn')) return;
                            window.location.href = `chat-window.html?chatId=${chat.id}&otherId=${otherId}`;
                        };

                        // ✅ Avatar: supports HTTP URL or Base64
                        let avatarHTML = '';
                        const profilePic = userData.profilePic;
                        if (profilePic && (profilePic.startsWith('http') || profilePic.startsWith('data:image'))) {
                            avatarHTML = `<img src="${profilePic}" alt="${name}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />`;
                        } else {
                            avatarHTML = `<span style="font-size:20px; font-weight:700; color:white;">${initial}</span>`;
                        }

                        const time = chat.lastMessageTime?.toDate?.() ? timeSince(chat.lastMessageTime.toDate()) : '';

                        item.innerHTML = `
                            <div class="avatar" style="background:${avatarBg}; display:flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; flex-shrink:0; overflow:hidden;">${avatarHTML}</div>
                            <div class="info" style="flex:1; min-width:0;">
                                <div class="name" style="font-weight:600; font-size:16px; color:#2c3e50;">${name}</div>
                                <div class="last-msg" style="font-size:14px; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.lastMessage || 'Start chatting'}</div>
                                <div class="time" style="font-size:12px; color:#aaa; margin-top:2px;">${time}</div>
                            </div>
                            ${unread > 0 ? `<span class="unread-badge" style="background:#e74c3c; color:white; font-size:12px; font-weight:bold; padding:2px 10px; border-radius:30px; flex-shrink:0;">${unread}</span>` : ''}
                            <button class="delete-chat-btn" onclick="event.stopPropagation(); deleteChat('${chat.id}')" title="Delete conversation" style="background:none; border:none; color:#ccc; cursor:pointer; font-size:16px; padding:4px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        `;
                        container.appendChild(item);
                    })
                    .catch(err => console.warn('Error fetching user:', err));
            });
        }, (error) => {
            console.error('Chat list error:', error);
            container.innerHTML = `<div class="no-chats"><i class="fas fa-exclamation-circle"></i><p>Error loading chats. Please refresh.</p></div>`;
        });
}

// ============================================
// DELETE CONVERSATION (unchanged)
// ============================================
window.deleteChat = async function(chatId) {
    if (!confirm('Are you sure you want to delete this entire conversation? This cannot be undone.')) return;

    try {
        const db = firebase.firestore();
        const chatRef = db.collection('chats').doc(chatId);
        const messagesRef = chatRef.collection('messages');

        const messagesSnap = await messagesRef.get();
        const batch = db.batch();
        messagesSnap.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        await chatRef.delete();

        console.log('✅ Conversation deleted:', chatId);
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete conversation: ' + error.message);
    }
};

function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + 'y';
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + 'mo';
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + 'd';
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + 'h';
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + 'm';
    return 'Just now';
}