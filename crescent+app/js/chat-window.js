// ============================================
// CHAT WINDOW - SKELETON + LIMIT 50 + IMAGE SUPPORT
// ============================================

let currentChatId = null;
let otherUserId = null;
let messagesUnsubscribe = null;
let chatDocUnsubscribe = null;
let currentUser = null;
let userProfileCache = {};
let typingTimeout = null;
let replyingTo = null;
let editingMessage = null;
let contextMenuOpen = false;

// =============================================
// SKELETON MESSAGE BUBBLES
// =============================================
function skeletonMessage(count = 5) {
    let html = '';
    for (let i = 0; i < count; i++) {
        const isSent = i % 2 === 0;
        const width = 30 + Math.floor(Math.random() * 50); // 30-80%
        html += `
            <div class="message-skeleton" style="
                display: flex;
                align-items: flex-end;
                gap: 8px;
                margin-bottom: 8px;
                justify-content: ${isSent ? 'flex-end' : 'flex-start'};
            ">
                ${!isSent ? `<div style="
                    width: 32px; height: 32px; border-radius: 50%;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    flex-shrink: 0;
                "></div>` : ''}
                <div style="
                    height: 32px; width: ${width}%;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 16px;
                    ${isSent ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'}
                "></div>
                ${isSent ? `<div style="
                    width: 32px; height: 32px; border-radius: 50%;
                    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    flex-shrink: 0;
                "></div>` : ''}
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
        currentUser = user;

        const params = new URLSearchParams(window.location.search);
        currentChatId = params.get('chatId');
        otherUserId = params.get('otherId');

        if (!currentChatId || !otherUserId) {
            document.getElementById('messageList').innerHTML = `<div class="no-chats"><i class="fas fa-exclamation-circle"></i><p>Invalid chat.</p></div>`;
            return;
        }

        loadPartnerNameAndPic(otherUserId);
        loadMessages(currentChatId);
        listenTypingStatus(currentChatId, otherUserId);
        markMessagesAsRead(currentChatId, user.uid);
        setupTypingListener();
    });

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('messageContextMenu');
        if (menu && !menu.contains(e.target)) closeContextMenu();
    });
});

function setupTypingListener() {
    const input = document.getElementById('messageInput');
    let typingTimer;
    input.addEventListener('input', function() {
        clearTimeout(typingTimer);
        setTypingStatus(true);
        typingTimer = setTimeout(() => setTypingStatus(false), 1500);
    });
    input.addEventListener('blur', function() {
        clearTimeout(typingTimer);
        setTypingStatus(false);
    });
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (editingMessage) cancelEdit();
            else if (replyingTo) cancelReply();
        }
    });
}

async function setTypingStatus(isTyping) {
    if (!currentChatId || !currentUser) return;
    try {
        await firebase.firestore().collection('chats').doc(currentChatId).set({
            typing: { [currentUser.uid]: isTyping ? true : null }
        }, { merge: true });
    } catch (error) {
        console.error('Error setting typing status:', error);
    }
}

function listenTypingStatus(chatId, otherId) {
    if (chatDocUnsubscribe) chatDocUnsubscribe();
    chatDocUnsubscribe = firebase.firestore().collection('chats').doc(chatId).onSnapshot((doc) => {
        if (doc.exists) {
            const typing = doc.data().typing || {};
            const isOtherTyping = typing[otherId] === true;
            const indicator = document.getElementById('typingIndicator');
            const nameSpan = document.getElementById('typingUserName');
            if (isOtherTyping) {
                getUserProfile(otherId).then(userData => {
                    nameSpan.textContent = userData?.name || 'Someone';
                });
                indicator.style.display = 'block';
            } else {
                indicator.style.display = 'none';
            }
        }
    }, (error) => {
        console.error('Error listening typing status:', error);
    });
}

function loadPartnerNameAndPic(userId) {
    getUserProfile(userId).then(userData => {
        if (userData) {
            document.getElementById('chatPartnerName').textContent = userData.name || 'User';
        }
    });
}

async function getUserProfile(userId) {
    if (userProfileCache[userId]) return userProfileCache[userId];
    try {
        const doc = await firebase.firestore().collection('users').doc(userId).get();
        if (doc.exists) {
            userProfileCache[userId] = doc.data();
            return userProfileCache[userId];
        }
        return null;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

// =============================================
// LOAD MESSAGES WITH SKELETON (NO SPINNER)
// =============================================
function loadMessages(chatId) {
    const container = document.getElementById('messageList');
    // ✅ স্কেলেটন দেখান (স্পিনার রিমুভ)
    container.innerHTML = skeletonMessage(5);

    if (messagesUnsubscribe) messagesUnsubscribe();

    messagesUnsubscribe = firebase.firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot(async (snapshot) => {
            if (snapshot.empty) {
                container.innerHTML = `<div class="no-chats" style="padding:20px;"><i class="fas fa-comment-dots"></i><p>No messages yet. Say hello!</p></div>`;
                return;
            }

            const docs = snapshot.docs.slice().reverse();
            container.innerHTML = '';

            for (const doc of docs) {
                const data = doc.data();
                const isSent = data.senderId === currentUser.uid;
                const senderId = data.senderId;
                const senderData = await getUserProfile(senderId);
                const senderName = senderData?.name || 'Unknown';
                const profilePic = senderData?.profilePic || null;

                // ✅ Avatar: HTTP or Base64 support
                let avatarHTML = '';
                if (profilePic && (profilePic.startsWith('http') || profilePic.startsWith('data:image'))) {
                    avatarHTML = `<img src="${profilePic}" alt="${senderName}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid ${isSent ? '#3498db' : '#2c3e50'};" />`;
                } else {
                    const initial = senderName.charAt(0).toUpperCase();
                    avatarHTML = `<span style="width:32px; height:32px; border-radius:50%; background:${isSent ? '#3498db' : '#2c3e50'}; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; border:2px solid ${isSent ? '#3498db' : '#2c3e50'}; flex-shrink:0;">${initial}</span>`;
                }

                const time = data.timestamp?.toDate?.() ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                const messageDiv = document.createElement('div');
                messageDiv.className = `message-wrapper ${isSent ? 'sent-wrapper' : 'received-wrapper'}`;
                messageDiv.style.display = 'flex';
                messageDiv.style.alignItems = 'flex-end';
                messageDiv.style.gap = '8px';
                messageDiv.style.marginBottom = '6px';
                messageDiv.style.justifyContent = isSent ? 'flex-end' : 'flex-start';
                messageDiv.dataset.messageId = doc.id;
                messageDiv.dataset.senderName = senderName;
                messageDiv.dataset.text = data.text;
                messageDiv.dataset.isSent = isSent ? 'true' : 'false';
                messageDiv.dataset.chatId = chatId;

                const bubble = document.createElement('div');
                bubble.className = `message ${isSent ? 'sent' : 'received'}`;

                let replyHTML = '';
                if (data.replyTo) {
                    const repliedSenderName = data.replyTo.senderName || 'Someone';
                    const repliedText = data.replyTo.text || '';
                    replyHTML = `
                        <div class="reply-preview" style="
                            background: ${isSent ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)'};
                            border-left: 3px solid #3498db;
                            padding: 4px 10px;
                            border-radius: 6px;
                            margin-bottom: 4px;
                            font-size: 13px;
                            color: ${isSent ? 'rgba(255,255,255,0.7)' : '#888'};
                        ">
                            <strong style="font-size:12px; color:#3498db;">${repliedSenderName}</strong>
                            <span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${repliedText}</span>
                        </div>
                    `;
                }

                let textHtml = data.text;
                if (data.edited) textHtml += ` <span style="font-size:10px; color:#999; font-style:italic;">(edited)</span>`;

                bubble.innerHTML = `${replyHTML}${textHtml}<span class="timestamp">${time}</span>`;
                bubble.style.cursor = 'pointer';

                bubble.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const wrapper = this.closest('.message-wrapper');
                    if (wrapper) {
                        const rect = wrapper.getBoundingClientRect();
                        const x = e.clientX || rect.left + rect.width/2;
                        const y = e.clientY || rect.top;
                        showContextMenu(x, y, wrapper.dataset.messageId, wrapper.dataset.senderName, wrapper.dataset.text, wrapper.dataset.isSent === 'true', wrapper.dataset.chatId);
                    }
                });

                const wrapperDiv = document.createElement('div');
                wrapperDiv.style.display = 'flex';
                wrapperDiv.style.alignItems = 'center';
                wrapperDiv.style.gap = '6px';
                wrapperDiv.style.flexDirection = 'row';

                if (isSent) {
                    wrapperDiv.appendChild(bubble);
                    const avatarContainer = document.createElement('div');
                    avatarContainer.style.flexShrink = '0';
                    avatarContainer.innerHTML = avatarHTML;
                    wrapperDiv.appendChild(avatarContainer);
                } else {
                    const avatarContainer = document.createElement('div');
                    avatarContainer.style.flexShrink = '0';
                    avatarContainer.innerHTML = avatarHTML;
                    wrapperDiv.appendChild(avatarContainer);
                    wrapperDiv.appendChild(bubble);
                }

                messageDiv.appendChild(wrapperDiv);
                container.appendChild(messageDiv);
            }

            container.scrollTop = container.scrollHeight;
        }, (error) => {
            console.error('Message listener error:', error);
            container.innerHTML = `<div class="no-chats"><i class="fas fa-exclamation-circle"></i><p>Error loading messages.</p></div>`;
        });
}

// =============================================
// CONTEXT MENU (Reply, Edit, Unsend)
// =============================================
function showContextMenu(x, y, messageId, senderName, text, isSent, chatId) {
    closeContextMenu();
    const menu = document.createElement('div');
    menu.id = 'messageContextMenu';
    menu.style.cssText = `
        position: fixed;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        padding: 8px 0;
        min-width: 160px;
        z-index: 9999;
        border: 1px solid #eee;
        display: flex;
        flex-direction: column;
        gap: 2px;
        animation: fadeIn 0.15s ease;
    `;
    let left = x, top = y;
    const menuWidth = 180;
    const menuHeight = isSent ? 140 : 60;
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    const replyBtn = createMenuItem('<i class="fas fa-reply"></i> Reply', '#2c3e50', () => {
        closeContextMenu();
        replyToMessage(messageId, senderName, text);
    });
    menu.appendChild(replyBtn);

    if (isSent) {
        const editBtn = createMenuItem('<i class="fas fa-pen"></i> Edit', '#2c3e50', () => {
            closeContextMenu();
            startEditing(chatId, messageId, text);
        });
        menu.appendChild(editBtn);
        const unsendBtn = createMenuItem('<i class="fas fa-trash"></i> Unsend', '#e74c3c', () => {
            closeContextMenu();
            unsendMessage(chatId, messageId);
        });
        menu.appendChild(unsendBtn);
    }
    document.body.appendChild(menu);
    contextMenuOpen = true;
}

function createMenuItem(html, color, onClick) {
    const btn = document.createElement('button');
    btn.innerHTML = html;
    btn.style.cssText = `
        background: none; border: none; padding: 8px 18px; text-align: left;
        font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 10px;
        transition: 0.2s; border-radius: 0; color: ${color};
        font-family: inherit;
    `;
    btn.onmouseover = () => btn.style.background = '#f0f4f8';
    btn.onmouseout = () => btn.style.background = 'none';
    btn.onclick = (e) => { e.stopPropagation(); onClick(); };
    return btn;
}

function closeContextMenu() {
    const menu = document.getElementById('messageContextMenu');
    if (menu) menu.remove();
    contextMenuOpen = false;
}

function startEditing(chatId, messageId, currentText) {
    if (replyingTo) cancelReply();
    editingMessage = { chatId, messageId, currentText };
    const input = document.getElementById('messageInput');
    input.value = currentText;
    input.focus();
    input.select();
    showEditBanner();
}

function showEditBanner() {
    let banner = document.getElementById('editBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'editBanner';
        banner.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #eef7ff;
            padding: 6px 14px;
            border-radius: 12px 12px 0 0;
            border-left: 4px solid #3498db;
            font-size: 14px;
            color: #2c3e50;
            gap: 12px;
        `;
        const inputArea = document.querySelector('.message-input-area');
        inputArea.parentNode.insertBefore(banner, inputArea);
    }
    banner.innerHTML = `
        <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
            <strong style="font-size:13px; color:#3498db;">✏️ Editing message</strong>
            <span style="font-size:13px; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${editingMessage.currentText}</span>
        </div>
        <button onclick="cancelEdit()" style="background:none; border:none; color:#999; font-size:18px; cursor:pointer; padding:0 4px; transition:0.2s;" onmouseover="this.style.color='#e74c3c'" onmouseout="this.style.color='#999'">
            <i class="fas fa-times"></i>
        </button>
    `;
    banner.style.display = 'flex';
    const sendBtn = document.querySelector('.message-input-area button');
    if (sendBtn) {
        sendBtn.innerHTML = '<i class="fas fa-check"></i>';
        sendBtn.style.background = '#2ecc71';
        sendBtn.onclick = function(e) { e.preventDefault(); submitEdit(); };
    }
}

function cancelEdit() {
    editingMessage = null;
    const banner = document.getElementById('editBanner');
    if (banner) banner.style.display = 'none';
    const sendBtn = document.querySelector('.message-input-area button');
    if (sendBtn) {
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        sendBtn.style.background = '';
        sendBtn.onclick = function(e) { e.preventDefault(); sendMessage(); };
    }
    const input = document.getElementById('messageInput');
    input.value = '';
    input.focus();
}

function submitEdit() {
    if (!editingMessage) return;
    const input = document.getElementById('messageInput');
    const newText = input.value.trim();
    if (!newText || newText === editingMessage.currentText) { cancelEdit(); return; }
    const { chatId, messageId } = editingMessage;
    firebase.firestore().collection('chats').doc(chatId).collection('messages').doc(messageId).update({
        text: newText, edited: true, editedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => { console.log('✅ Message edited'); cancelEdit(); })
    .catch(err => { console.error('Edit error:', err); alert('Failed to edit message: ' + err.message); });
}

function replyToMessage(messageId, senderName, text) {
    if (editingMessage) cancelEdit();
    replyingTo = { messageId, senderName, text };
    showReplyBanner();
    document.getElementById('messageInput').focus();
}

function showReplyBanner() {
    let banner = document.getElementById('replyBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'replyBanner';
        banner.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #f0f4f8;
            padding: 6px 14px;
            border-radius: 12px 12px 0 0;
            border-left: 4px solid #3498db;
            font-size: 14px;
            color: #2c3e50;
            gap: 12px;
        `;
        const inputArea = document.querySelector('.message-input-area');
        inputArea.parentNode.insertBefore(banner, inputArea);
    }
    banner.innerHTML = `
        <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
            <strong style="font-size:13px; color:#3498db;">Replying to ${replyingTo.senderName}</strong>
            <span style="font-size:13px; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${replyingTo.text}</span>
        </div>
        <button onclick="cancelReply()" style="background:none; border:none; color:#999; font-size:18px; cursor:pointer; padding:0 4px; transition:0.2s;" onmouseover="this.style.color='#e74c3c'" onmouseout="this.style.color='#999'">
            <i class="fas fa-times"></i>
        </button>
    `;
    banner.style.display = 'flex';
}

function cancelReply() {
    replyingTo = null;
    const banner = document.getElementById('replyBanner');
    if (banner) banner.style.display = 'none';
}

async function unsendMessage(chatId, messageId) {
    if (!confirm('Unsend this message for everyone?')) return;
    try {
        await firebase.firestore().collection('chats').doc(chatId).collection('messages').doc(messageId).delete();
        console.log('✅ Message unsent');
    } catch (error) {
        console.error('Unsend error:', error);
        alert('Failed to unsend message: ' + error.message);
    }
}

function sendMessage() {
    if (editingMessage) { submitEdit(); return; }
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !currentChatId) return;
    input.value = '';
    const messageData = { senderId: currentUser.uid, text, timestamp: firebase.firestore.FieldValue.serverTimestamp(), read: false };
    if (replyingTo) {
        messageData.replyTo = { messageId: replyingTo.messageId, senderName: replyingTo.senderName, text: replyingTo.text };
        cancelReply();
    }
    firebase.firestore().collection('chats').doc(currentChatId).collection('messages').add(messageData)
        .then(() => {
            return firebase.firestore().collection('chats').doc(currentChatId).update({
                lastMessage: text,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                [`unread.${otherUserId}`]: firebase.firestore.FieldValue.increment(1)
            });
        })
        .catch(err => { console.error('Send error:', err); alert('Failed to send message.'); });
}

function markMessagesAsRead(chatId, userId) {
    firebase.firestore().collection('chats').doc(chatId).update({ [`unread.${userId}`]: 0 })
        .catch(err => console.warn('Mark read error:', err));
}

document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
});

window.cancelEdit = cancelEdit;
window.cancelReply = cancelReply;
window.sendMessage = sendMessage;
window.submitEdit = submitEdit;