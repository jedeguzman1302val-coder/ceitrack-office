// HAKBANG 1: FIREBASE CONFIGURATION AT INITIALIZATION
const firebaseConfig = {
    apiKey: "AIzaSyCeTfbcz9-lqT0JTMO8JVTWV-luBhT8kO0",
    authDomain: "project-6675709483481122019.firebaseapp.com",
    databaseURL: "https://project-6675709483481122019-default-rtdb.firebaseio.com",
    projectId: "project-6675709483481122019",
    storageBucket: "project-6675709483481122019.appspot.com",
    messagingSenderId: "305985446601",
    appId: "1:305985446601:web:914f344ff38ac5b177e318"
};

// Initialize Firebase (kung hindi pa initialized)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Kunin ang Firestore instance para magamit sa buong script
const db = firebase.firestore();
const storage = firebase.storage();


// HAKBANG 2: ANG LOGIC NG IYONG PAGE
document.addEventListener('DOMContentLoaded', () => {
    const currentUserJSON = sessionStorage.getItem('currentUser');
    const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;

    let selectedStudent = null;
    const API_BASE = (window.location.port) ? 'http://localhost:3000' : '';
    let pendingImageUrl = null; // To store the URL of the image waiting to be sent

    if (!currentUser || !currentUser.idNumber) {
        console.error('Adviser data not found in sessionStorage.');
        document.getElementById('adviser-name').textContent = 'Unknown User';
        renderStudents([]);
        return;
    }

    const adviserInfo = {
        id: currentUser.idNumber,
        name: currentUser.name || 'Adviser',
        department: currentUser.department || '',
        section: currentUser.section || ''
    };

    function displayHeaderInfo() {
        document.getElementById('adviser-name').textContent = adviserInfo.name;
        document.getElementById('adviser-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adviserInfo.name)}&background=4361ee&color=fff`;
        const metaEl = document.getElementById('adviser-meta');
        if (metaEl) {
            metaEl.textContent = (adviserInfo.department && adviserInfo.section) ? `${adviserInfo.department} • ${adviserInfo.section}` : (adviserInfo.department || adviserInfo.section || '');
        }
    }

    async function loadStudents() {
        if (!adviserInfo.department || !adviserInfo.section) {
            renderStudents([]);
            return;
        }
        const loadingEl = document.getElementById('students-loading');
        if (loadingEl) loadingEl.style.display = 'block';
        try {
            const res = await fetch(`${API_BASE}/api/students/${adviserInfo.department}/${adviserInfo.section}`);
            if (!res.ok) throw new Error(`Failed to load students list: ${res.status}`);
            const students = await res.json();
            // For each student, fetch preview/unread and attach to student object for faster rendering
            const withPreviewPromises = (students || []).map(async s => {
                const studentId = s.idNumber || s.id;
                const preview = await fetchChatPreviewForStudent(studentId);
                return Object.assign({}, s, { _chatPreview: preview });
            });
            const studentsWithPreview = await Promise.all(withPreviewPromises);
            // Sort: students with unread messages first, then by most recent message time
            try {
                studentsWithPreview.sort((a, b) => {
                    const aUnread = (a._chatPreview && typeof a._chatPreview.unreadCount === 'number') ? a._chatPreview.unreadCount : 0;
                    const bUnread = (b._chatPreview && typeof b._chatPreview.unreadCount === 'number') ? b._chatPreview.unreadCount : 0;
                    if (aUnread !== bUnread) return bUnread - aUnread;
                    const aTime = a._chatPreview && a._chatPreview.lastMessageTime ? new Date(a._chatPreview.lastMessageTime).getTime() : 0;
                    const bTime = b._chatPreview && b._chatPreview.lastMessageTime ? new Date(b._chatPreview.lastMessageTime).getTime() : 0;
                    return bTime - aTime;
                });
            } catch (e) {
                console.error('Error sorting studentsWithPreview', e);
            }

            renderStudents(studentsWithPreview || []);
            // Start real-time unread listeners for the loaded students so badges update live
            try {
                startUnreadListenersForStudents(studentsWithPreview || []);
            } catch (e) {
                console.error('Failed to start unread listeners after loading students', e);
            }
        } catch (err) {
            console.error('Error fetching students:', err);
            renderStudents([]);
        }
    }

    function renderStudents(students) {
        const container = document.getElementById('students-list-container');
        if (!container) return;
        container.innerHTML = '';
        const loadingEl = document.getElementById('students-loading');
        if (loadingEl) loadingEl.style.display = 'none';

        if (!students || students.length === 0) {
            container.innerHTML = '<p style="padding:20px;text-align:center;color:#6b7280">No students found.</p>';
            return;
        }
        students.forEach(s => {
            const name = s.name || 'Unnamed Student';
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
            const studentId = s.idNumber || s.id;
            const div = document.createElement('div');
            div.className = 'chat-item';
            div.setAttribute('data-id', studentId);
            // Use any preview data already fetched
            const preview = s._chatPreview || {};
            const lastMessageText = preview.lastMessageText || '';
            const lastMessageTime = preview.lastMessageTime ? new Date(preview.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            div.innerHTML = `
                <div class="avatar-container">
                    <img src="${avatarUrl}" alt="${name}">
                    <div class="status-indicator"></div>
                </div>
                <div class="student-info">
                    <div class="student-name">${name}</div>
                    <div class="last-message-preview">${lastMessageText}</div>
                </div>
                <div class="chat-item-right">
                    <div class="last-message-time">${lastMessageTime}</div>
                    <div class="unread-badge-placeholder" data-student-id="${studentId}"></div>
                </div>`;
            div.addEventListener('click', () => selectStudent(s, div));
            container.appendChild(div);
            // Set initial unread count from preview (listeners will update it live)
            try {
                const initialUnread = (preview && typeof preview.unreadCount === 'number') ? preview.unreadCount : 0;
                const badgeContainer = div.querySelector('.unread-badge-placeholder');
                if (badgeContainer) badgeContainer.innerHTML = initialUnread > 0 ? `<div class="unread-count">${initialUnread}</div>` : '';
            } catch (e) {
                console.error('Error setting initial unread count for', studentId, e);
            }
        });
    }

    // Helper: fetch preview for a student (latest message text and unread count)
    async function fetchChatPreviewForStudent(studentId) {
        try {
            const messagePath = db.collection('students')
                .doc(adviserInfo.department)
                .collection(adviserInfo.section)
                .doc(studentId)
                .collection('messagewithadviser');

            const latestSnap = await messagePath.orderBy('timestamp', 'desc').limit(1).get();
            let lastMessageText = '';
            let lastMessageTime = null;
            if (!latestSnap.empty) {
                const data = latestSnap.docs[0].data() || {};
                lastMessageText = data.text || (data.imageUrl ? 'Image' : '') || '';
                lastMessageTime = data.timestamp ? (typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate() : data.timestamp) : null;
            }

            // unread count: messages not sent by adviser and not marked isRead
            const unreadSnap = await messagePath.where('senderId', '!=', adviserInfo.id).get();
            let unreadCount = 0;
            unreadSnap.forEach(doc => {
                const d = doc.data() || {};
                if (d.isRead === true) return;
                if (d.deleted) return;
                unreadCount++;
            });

            return { lastMessageText, lastMessageTime, unreadCount };
        } catch (error) {
            console.error('fetchChatPreviewForStudent error', error);
            return { lastMessageText: '', lastMessageTime: null, unreadCount: 0 };
        }
    }

    // Helper: fetch unread count only
    async function fetchUnreadCountForStudent(studentId) {
        try {
            const messagePath = db.collection('students')
                .doc(adviserInfo.department)
                .collection(adviserInfo.section)
                .doc(studentId)
                .collection('messagewithadviser');

            const unreadSnap = await messagePath.where('senderId', '!=', adviserInfo.id).get();
            let unreadCount = 0;
            unreadSnap.forEach(doc => {
                const d = doc.data() || {};
                if (d.isRead === true) return;
                if (d.deleted) return;
                unreadCount++;
            });
            return unreadCount;
        } catch (error) {
            console.error('fetchUnreadCountForStudent error', error);
            return 0;
        }
    }

    // Helper: fetch chat preview for chairperson
    async function fetchChairpersonChatPreview() {
        try {
            const messagePath = db.collection('advisers')
                .doc(adviserInfo.department)
                .collection('sections')
                .doc(adviserInfo.section)
                .collection('messagewithchair');

            const latestSnap = await messagePath.orderBy('timestamp', 'desc').limit(1).get();
            let lastMessageText = '';
            let lastMessageTime = null;
            if (!latestSnap.empty) {
                const data = latestSnap.docs[0].data() || {};
                lastMessageText = data.text || (data.imageUrl ? 'Image' : '') || '';
                lastMessageTime = data.timestamp ? (typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate() : data.timestamp) : null;
            }

            // unread count: messages not sent by adviser and not marked isRead
            const unreadSnap = await messagePath.where('senderId', '!=', adviserInfo.id).get();
            let unreadCount = 0;
            unreadSnap.forEach(doc => {
                const d = doc.data() || {};
                if (d.isRead === true) return;
                if (d.deleted) return;
                unreadCount++;
            });

            return { lastMessageText, lastMessageTime, unreadCount };
        } catch (error) {
            console.error('fetchChairpersonChatPreview error', error);
            return { lastMessageText: '', lastMessageTime: null, unreadCount: 0 };
        }
    }

    // Helper: fetch chat preview for secretary
    async function fetchSecretaryChatPreview() {
        try {
            const messagePath = db.collection('advisers')
                .doc(adviserInfo.department)
                .collection('sections')
                .doc(adviserInfo.section)
                .collection('messagewithsec');

            const latestSnap = await messagePath.orderBy('timestamp', 'desc').limit(1).get();
            let lastMessageText = '';
            let lastMessageTime = null;
            if (!latestSnap.empty) {
                const data = latestSnap.docs[0].data() || {};
                lastMessageText = data.text || (data.imageUrl ? 'Image' : '') || '';
                lastMessageTime = data.timestamp ? (typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate() : data.timestamp) : null;
            }

            // unread count: messages not sent by adviser and not marked isRead
            const unreadSnap = await messagePath.where('senderId', '!=', adviserInfo.id).get();
            let unreadCount = 0;
            unreadSnap.forEach(doc => {
                const d = doc.data() || {};
                if (d.isRead === true) return;
                if (d.deleted) return;
                unreadCount++;
            });

            return { lastMessageText, lastMessageTime, unreadCount };
        } catch (error) {
            console.error('fetchSecretaryChatPreview error', error);
            return { lastMessageText: '', lastMessageTime: null, unreadCount: 0 };
        }
    }

    async function deleteMessage(messageId, studentNumber) {
        try {
            let messagePath;
            
            // Determine message path based on chat type
            if (selectedStudent.chatType === 'chairperson') {
                messagePath = db.collection('advisers')
                    .doc(adviserInfo.department)
                    .collection('sections')
                    .doc(adviserInfo.section)
                    .collection('messagewithchair')
                    .doc(messageId);
            } else if (selectedStudent.chatType === 'secretary') {
                messagePath = db.collection('advisers')
                    .doc(adviserInfo.department)
                    .collection('sections')
                    .doc(adviserInfo.section)
                    .collection('messagewithsec')
                    .doc(messageId);
            } else {
                messagePath = db.collection('students')
                    .doc(adviserInfo.department)
                    .collection(adviserInfo.section)
                    .doc(studentNumber)
                    .collection('messagewithadviser')
                    .doc(messageId);
            }
            
            await messagePath.delete();
            return true;
        } catch (error) {
            console.error('Error deleting message:', error);
            return false;
        }
    }

    async function editMessage(messageId, studentNumber, newText) {
        try {
            let messagePath;
            
            // Determine message path based on chat type
            if (selectedStudent.chatType === 'chairperson') {
                messagePath = db.collection('advisers')
                    .doc(adviserInfo.department)
                    .collection('sections')
                    .doc(adviserInfo.section)
                    .collection('messagewithchair')
                    .doc(messageId);
            } else if (selectedStudent.chatType === 'secretary') {
                messagePath = db.collection('advisers')
                    .doc(adviserInfo.department)
                    .collection('sections')
                    .doc(adviserInfo.section)
                    .collection('messagewithsec')
                    .doc(messageId);
            } else {
                messagePath = db.collection('students')
                    .doc(adviserInfo.department)
                    .collection(adviserInfo.section)
                    .doc(studentNumber)
                    .collection('messagewithadviser')
                    .doc(messageId);
            }
            
            await messagePath.update({
                text: newText,
                edited: true
            });
            return true;
        } catch (error) {
            console.error('Error editing message:', error);
            return false;
        }
    }

    function displayMessage(message, isSent = false) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const time = message.timestamp ? new Date(message.timestamp.toDate()) : new Date();
        const timeString = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        
        // Build message content (text and/or image)
        let messageContent = '';
        if (message.text) {
            messageContent += `<p class="message-text">${message.text}${message.edited ? ' <small>(edited)</small>' : ''}</p>`;
        }
        if (message.imageUrl) {
            messageContent += `<img src="${message.imageUrl}" alt="Image" class="chat-image" style="max-width: 200px; border-radius: 8px; margin-top: 5px; cursor: pointer;">`;
        }
        
        // Only show options for sent messages - icons beside bubble
        const optionsHtml = isSent ? `
            <div class="message-options">
                ${message.text ? `<button class="edit-message-btn" title="Edit message" data-message-id="${message.id}">
                    <i class="fas fa-edit"></i>
                </button>` : ''}
                <button class="delete-message-btn" title="Delete message" data-message-id="${message.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        ` : '';
        
        messageDiv.innerHTML = `
            <div class="message-content-wrapper">
                ${messageContent}
                <div class="message-time">${timeString}</div>
            </div>
            ${optionsHtml}
        `;
        
        // Add click handler for image viewing
        const chatImage = messageDiv.querySelector('.chat-image');
        if (chatImage) {
            chatImage.addEventListener('click', () => {
                openImageModal(chatImage.src);
            });
        }
        
        if (isSent) {
            // Edit message handler (only for text messages)
            const editBtn = messageDiv.querySelector('.edit-message-btn');
            if (editBtn) {
                editBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    const newText = prompt('Edit message:', message.text);
                    if (newText && newText !== message.text && newText.trim()) {
                        const success = await editMessage(message.id, selectedStudent.idNumber, newText);
                        if (success) {
                            const messageText = messageDiv.querySelector('.message-text');
                            if (messageText) {
                                messageText.innerHTML = `${newText} <small style="opacity: 0.7;">(edited)</small>`;
                            }
                        } else {
                            alert('Failed to edit message. Please try again.');
                        }
                    }
                });
            }

            // Delete message handler (for both text and images)
            const deleteBtn = messageDiv.querySelector('.delete-message-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    if (confirm('Are you sure you want to delete this message?')) {
                        const success = await deleteMessage(message.id, selectedStudent.idNumber);
                        if (success) {
                            messageDiv.remove();
                        } else {
                            alert('Failed to delete message. Please try again.');
                        }
                    }
                });
            }
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Open image in modal
    function openImageModal(src) {
        const modal = document.getElementById('image-viewer-modal');
        const modalImg = document.getElementById('modal-image');
        if (modal && modalImg) {
            modal.style.display = 'flex';
            modalImg.src = src;
        }
    }

    // Close image modal
    function closeImageModal() {
        const modal = document.getElementById('image-viewer-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    let currentMessageListener = null;
    let lastLoadedMessageTime = null;
    let presenceUnsubscribe = null;
    // Map for studentId -> unsubscribe function for unread listeners
    const unreadListeners = new Map();

    // Clear all unread listeners
    function clearAllUnreadListeners() {
        try {
            unreadListeners.forEach((unsub, id) => {
                try { unsub(); } catch (e) { /* ignore */ }
            });
            unreadListeners.clear();
        } catch (e) {
            console.error('clearAllUnreadListeners error', e);
        }
    }

    // Start a real-time listener for unread count for a student
    function startUnreadListenerForStudent(studentId) {
        try {
            if (!adviserInfo || !adviserInfo.department || !adviserInfo.section) return null;
            if (!studentId) return null;
            if (unreadListeners.has(studentId)) return unreadListeners.get(studentId);

            const messagePath = db.collection('students')
                .doc(adviserInfo.department)
                .collection(adviserInfo.section)
                .doc(studentId)
                .collection('messagewithadviser');

            const unsub = messagePath.onSnapshot((snap) => {
                try {
                    let unreadCount = 0;
                    snap.forEach(doc => {
                        const d = doc.data() || {};
                        if (d.senderId !== adviserInfo.id && d.isRead !== true && !d.deleted) {
                            unreadCount++;
                        }
                    });

                    const badgeContainer = document.querySelector(`.unread-badge-placeholder[data-student-id='${studentId}']`);
                    if (badgeContainer) {
                        badgeContainer.innerHTML = unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : '';
                    }
                } catch (e) {
                    console.error('unread snapshot handler error for', studentId, e);
                }
            }, (err) => {
                console.error('Unread listener error for', studentId, err);
            });

            unreadListeners.set(studentId, unsub);
            return unsub;
        } catch (err) {
            console.error('startUnreadListenerForStudent error', err);
            return null;
        }
    }

    // Start listeners for an array of students
    function startUnreadListenersForStudents(students) {
        try {
            clearAllUnreadListeners();
            (students || []).forEach(s => {
                const sid = s.idNumber || s.id;
                if (sid) startUnreadListenerForStudent(sid);
            });
        } catch (e) {
            console.error('startUnreadListenersForStudents error', e);
        }
    }

    // Start unread listener for chairperson
    function startChairpersonUnreadListener() {
        try {
            if (!adviserInfo || !adviserInfo.department || !adviserInfo.section) return null;

            const messagePath = db.collection('advisers')
                .doc(adviserInfo.department)
                .collection('sections')
                .doc(adviserInfo.section)
                .collection('messagewithchair');

            const unsub = messagePath.onSnapshot((snap) => {
                try {
                    let unreadCount = 0;
                    snap.forEach(doc => {
                        const d = doc.data() || {};
                        if (d.senderId !== adviserInfo.id && d.isRead !== true && !d.deleted) {
                            unreadCount++;
                        }
                    });

                    const badgeContainer = document.querySelector(`.unread-badge-placeholder[data-chair-id]`);
                    if (badgeContainer) {
                        badgeContainer.innerHTML = unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : '';
                    }
                } catch (e) {
                    console.error('unread snapshot handler error for chairperson', e);
                }
            }, (err) => {
                console.error('Unread listener error for chairperson', err);
            });

            return unsub;
        } catch (err) {
            console.error('startChairpersonUnreadListener error', err);
            return null;
        }
    }

    // Start unread listener for secretary
    function startSecretaryUnreadListener() {
        try {
            if (!adviserInfo || !adviserInfo.department || !adviserInfo.section) return null;

            const messagePath = db.collection('advisers')
                .doc(adviserInfo.department)
                .collection('sections')
                .doc(adviserInfo.section)
                .collection('messagewithsec');

            const unsub = messagePath.onSnapshot((snap) => {
                try {
                    let unreadCount = 0;
                    snap.forEach(doc => {
                        const d = doc.data() || {};
                        if (d.senderId !== adviserInfo.id && d.isRead !== true && !d.deleted) {
                            unreadCount++;
                        }
                    });

                    const badgeContainer = document.querySelector(`.unread-badge-placeholder[data-sec-id]`);
                    if (badgeContainer) {
                        badgeContainer.innerHTML = unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : '';
                    }
                } catch (e) {
                    console.error('unread snapshot handler error for secretary', e);
                }
            }, (err) => {
                console.error('Unread listener error for secretary', err);
            });

            return unsub;
        } catch (err) {
            console.error('startSecretaryUnreadListener error', err);
            return null;
        }
    }

    function listenToMessages(studentNumber) {
        // Remove any existing listener
        if (currentMessageListener) {
            currentMessageListener();
        }

        const messagePath = db.collection('students')
            .doc(adviserInfo.department)
            .collection(adviserInfo.section)
            .doc(studentNumber)
            .collection('messagewithadviser');
            
        currentMessageListener = messagePath
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        const messageTime = message.timestamp?.toMillis();
                        
                        // Only display messages that are newer than our last loaded message
                        // or messages that don't have a timestamp (like immediate local display)
                        if (!lastLoadedMessageTime || !messageTime || messageTime > lastLoadedMessageTime) {
                            displayMessage(message, message.senderId === adviserInfo.id);
                        }
                    }
                });
            });

        return currentMessageListener;
    }

    async function sendMessage() {
        const messageInput = document.getElementById('message');
        const messageText = messageInput.value.trim();
        const imageUrlToSend = pendingImageUrl;

        if (!messageText && !imageUrlToSend) {
            return;
        }

        if (!selectedStudent) {
            alert("Please select a recipient first!");
            return;
        }

        const studentNumber = selectedStudent.idNumber || selectedStudent.id;
        const sendBtn = document.getElementById('send-btn');
        
        // Disable send button and show loading
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const messageData = {
            senderId: adviserInfo.id,
            senderName: adviserInfo.name,
            receiverId: studentNumber,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isRead: false
        };

        // Add text if present
        if (messageText) {
            messageData.text = messageText;
        }

        // Add image URL if present
        if (imageUrlToSend) {
            messageData.imageUrl = imageUrlToSend;
        }

        try {
            let messagePath;
            
            // Determine message path based on chat type
            if (selectedStudent.chatType === 'chairperson') {
                // advisers/{department}/sections/{section}/messagewithchair
                messagePath = db.collection('advisers')
                    .doc(adviserInfo.department)
                    .collection('sections')
                    .doc(adviserInfo.section)
                    .collection('messagewithchair');
            } else if (selectedStudent.chatType === 'secretary') {
                // advisers/{department}/sections/{section}/messagewithsec
                messagePath = db.collection('advisers')
                    .doc(adviserInfo.department)
                    .collection('sections')
                    .doc(adviserInfo.section)
                    .collection('messagewithsec');
            } else {
                // students/{department}/{section}/{studentId}/messagewithadviser
                messagePath = db.collection('students')
                    .doc(adviserInfo.department)
                    .collection(adviserInfo.section)
                    .doc(studentNumber)
                    .collection('messagewithadviser');
            }

            await messagePath.add(messageData);
            
            // Clear input after successful send
            messageInput.value = '';
            removeImagePreview();
            
            // Message will be displayed by the real-time listener automatically

        } catch (error) {
            console.error("Error sending message: ", error);
            alert("Failed to send message. Please try again.");
        } finally {
            // Re-enable send button
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    // Handle image selection and upload
    async function handleImageSelection(event) {
        if (!selectedStudent) {
            alert("Please select a recipient first to send an image!");
            event.target.value = '';
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        const imagePreviewContainer = document.getElementById('image-preview-container');
        const imagePreview = document.getElementById('image-preview');
        const sendBtn = document.getElementById('send-btn');

        // Show loading state
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        if (imagePreview) imagePreview.src = '';
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';

        try {
            const storageRef = storage.ref();
            const studentNumber = selectedStudent.idNumber || selectedStudent.id;
            
            // Determine storage path based on chat type
            let storagePath;
            if (selectedStudent.chatType === 'chairperson') {
                storagePath = `chat_images/advisers/${adviserInfo.department}/${adviserInfo.section}/chairperson/${Date.now()}_${file.name}`;
            } else if (selectedStudent.chatType === 'secretary') {
                storagePath = `chat_images/advisers/${adviserInfo.department}/${adviserInfo.section}/secretary/${Date.now()}_${file.name}`;
            } else {
                storagePath = `chat_images/${adviserInfo.department}/${adviserInfo.section}/${studentNumber}/${Date.now()}_${file.name}`;
            }
            
            const imageRef = storageRef.child(storagePath);
            
            const snapshot = await imageRef.put(file);
            pendingImageUrl = await snapshot.ref.getDownloadURL();

            if (imagePreview) imagePreview.src = pendingImageUrl;
            if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image. Please try again.");
            removeImagePreview();
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    // Remove image preview
    function removeImagePreview() {
        pendingImageUrl = null;
        const imageInput = document.getElementById('image-input');
        const imagePreview = document.getElementById('image-preview');
        const imagePreviewContainer = document.getElementById('image-preview-container');
        
        if (imageInput) imageInput.value = '';
        if (imagePreview) imagePreview.src = '';
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    }

    // Mark unread messages as read for a student when adviser opens the chat
    async function markMessagesAsReadForStudent(studentId) {
        try {
            const messagePath = db.collection('students')
                .doc(adviserInfo.department)
                .collection(adviserInfo.section)
                .doc(studentId)
                .collection('messagewithadviser');

            const unreadSnap = await messagePath.where('senderId', '!=', adviserInfo.id).get();
            const batch = db.batch();
            unreadSnap.forEach(doc => {
                const data = doc.data() || {};
                if (data.isRead === true) return;
                if (data.deleted) return;
                batch.update(doc.ref, { isRead: true });
            });
            // Only commit if there are updates
            // Firestore batch.commit() with an empty batch is allowed but wastes a request; still safe
            await batch.commit();
        } catch (error) {
            console.error('markMessagesAsReadForStudent error', error);
        }
    }

    async function markChairpersonMessagesAsRead() {
        try {
            const messagePath = db.collection('advisers')
                .doc(adviserInfo.department)
                .collection('sections')
                .doc(adviserInfo.section)
                .collection('messagewithchair');

            const unreadSnap = await messagePath.where('senderId', '!=', adviserInfo.id).get();
            const batch = db.batch();
            unreadSnap.forEach(doc => {
                const data = doc.data() || {};
                if (data.isRead === true) return;
                if (data.deleted) return;
                batch.update(doc.ref, { isRead: true });
            });
            await batch.commit();
        } catch (error) {
            console.error('markChairpersonMessagesAsRead error', error);
        }
    }

    async function markSecretaryMessagesAsRead() {
        try {
            const messagePath = db.collection('advisers')
                .doc(adviserInfo.department)
                .collection('sections')
                .doc(adviserInfo.section)
                .collection('messagewithsec');

            const unreadSnap = await messagePath.where('senderId', '!=', adviserInfo.id).get();
            const batch = db.batch();
            unreadSnap.forEach(doc => {
                const data = doc.data() || {};
                if (data.isRead === true) return;
                if (data.deleted) return;
                batch.update(doc.ref, { isRead: true });
            });
            await batch.commit();
        } catch (error) {
            console.error('markSecretaryMessagesAsRead error', error);
        }
    }

    // Update adviser's online status in Firestore.
    // Writes to: advisers/{department}/sections/{section} document
    // Sets { online: boolean, lastSeen: Timestamp }
    async function setAdviserOnline(isOnline) {
        try {
            if (!adviserInfo || !adviserInfo.department || !adviserInfo.section) {
                console.warn('Cannot set adviser online status: missing department or section');
                return false;
            }

            const docRef = db.collection('advisers')
                .doc(adviserInfo.department)
                .collection('sections')
                .doc(adviserInfo.section);

            await docRef.set({
                online: !!isOnline,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return true;
        } catch (err) {
            console.error('setAdviserOnline error', err);
            return false;
        }
    }

    async function renderChatInterface(student) {
        const chatWindow = document.getElementById('chat-window');
        if (!chatWindow) return;
        const name = student.name || 'Student';
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
        chatWindow.innerHTML = `
            <div class="chat-header">
                <img src="${avatarUrl}" alt="${name}">
                <div class="chat-header-info">
                    <div class="chat-header-name">${name}</div>
                    <div class="chat-header-status">
                        <span class="indicator"></span><span id="status-text">Offline</span>
                    </div>
                </div>
            </div>
            <div id="messages">
                <p style="text-align:center; color: #888; margin-top: 20px;">Loading messages...</p>
            </div>
            <div id="image-preview-container" style="display: none; padding: 10px; background: #f3f4f6; border-radius: 8px; margin: 10px; position: relative;">
                <img id="image-preview" src="" alt="Image Preview" style="max-width: 200px; border-radius: 8px;">
                <button id="remove-image-preview" class="action-btn" style="position: absolute; top: 5px; right: 5px; background: #ef4444; color: white;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="input-container">
                <input type="file" id="image-input" accept="image/*" style="display: none;">
                <button class="action-btn" id="attach-image-btn"><i class="fas fa-paperclip"></i></button>
                <input type="text" id="message" placeholder="Type a message...">
                <button id="send-btn"><i class="fas fa-paper-plane"></i></button>
            </div>`;
            
        // Load existing messages
        const studentNumber = student.idNumber || student.id;
        const messagePath = db.collection('students')
            .doc(adviserInfo.department)
            .collection(adviserInfo.section)
            .doc(studentNumber)
            .collection('messagewithadviser');
            
        try {
            const messages = await messagePath.orderBy('timestamp', 'asc').get();
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = ''; // Clear loading message
            
            if (messages.empty) {
                messagesContainer.innerHTML = `
                    <p style="text-align:center; color: #888; margin-top: 20px;">
                        This is the beginning of your conversation with ${name}.
                    </p>`;
                lastLoadedMessageTime = null;
            } else {
                messages.forEach(doc => {
                    const message = doc.data();
                    displayMessage(message, message.senderId === adviserInfo.id);
                    // Update the last loaded message time
                    if (message.timestamp) {
                        const messageTime = message.timestamp.toMillis();
                        lastLoadedMessageTime = Math.max(lastLoadedMessageTime || 0, messageTime);
                    }
                });
            }
            
            // Start listening for new messages
            listenToMessages(studentNumber);
            
        } catch (error) {
            console.error('Error loading messages:', error);
            document.getElementById('messages').innerHTML = `
                <p style="text-align:center; color: #888; margin-top: 20px;">
                    Failed to load messages. Please try again.
                </p>`;
        }

        document.getElementById('send-btn').addEventListener('click', sendMessage);
        document.getElementById('message').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        // Image attachment handlers
        const attachImageBtn = document.getElementById('attach-image-btn');
        const imageInput = document.getElementById('image-input');
        const removeImagePreviewBtn = document.getElementById('remove-image-preview');
        
        if (attachImageBtn && imageInput) {
            attachImageBtn.addEventListener('click', () => {
                imageInput.click();
            });
            imageInput.addEventListener('change', handleImageSelection);
        }
        
        if (removeImagePreviewBtn) {
            removeImagePreviewBtn.addEventListener('click', removeImagePreview);
        }
    }

    // Update the Conversations status UI (dot + text)
    function updatePresenceUI(isOnline) {
        try {
            const dot = document.getElementById('chat-list-dot');
            const text = document.getElementById('chat-list-status-text');
            if (!dot || !text) return;
            if (isOnline) {
                dot.classList.add('online');
                dot.style.background = '#16a34a'; // green
                text.textContent = 'Online';
            } else {
                dot.classList.remove('online');
                dot.style.background = '#9ca3af'; // gray
                text.textContent = 'Offline';
            }
        } catch (e) {
            console.error('updatePresenceUI error', e);
        }
    }

    // Listen to the advisers/{department}/sections/{section} doc for presence changes
    function listenToAdviserPresence() {
        try {
            if (!adviserInfo || !adviserInfo.department || !adviserInfo.section) return null;
            const docRef = db.collection('advisers')
                .doc(adviserInfo.department)
                .collection('sections')
                .doc(adviserInfo.section);

            // Unsubscribe existing listener
            if (presenceUnsubscribe) {
                try { presenceUnsubscribe(); } catch (e) { /* ignore */ }
            }

            presenceUnsubscribe = docRef.onSnapshot((snap) => {
                if (!snap.exists) {
                    updatePresenceUI(false);
                    return;
                }
                const data = snap.data() || {};
                updatePresenceUI(!!data.online);
            }, (err) => {
                console.error('Presence listener error', err);
            });

            return presenceUnsubscribe;
        } catch (err) {
            console.error('listenToAdviserPresence error', err);
            return null;
        }
    }

    function selectStudent(student, element) {
        selectedStudent = { ...student, idNumber: student.idNumber || student.id, chatType: 'student' };
        document.querySelectorAll('.chat-item').forEach(it => it.classList.remove('active'));
        if (element) element.classList.add('active');
        renderChatInterface(student);

        // Mark messages as read for this student and clear badge in UI
        (async () => {
            try {
                await markMessagesAsReadForStudent(selectedStudent.idNumber);
                const activeItem = document.querySelector(`.chat-item[data-id='${selectedStudent.idNumber}']`);
                if (activeItem) {
                    const badge = activeItem.querySelector('.unread-badge-placeholder');
                    if (badge) badge.innerHTML = '';
                }
            } catch (e) {
                console.error('Error marking messages as read for', selectedStudent.idNumber, e);
            }
        })();
    }
    
    function openChairpersonChat(chairperson) {
        selectedStudent = {
            id: chairperson.id,
            idNumber: chairperson.id,
            name: chairperson.name,
            online: chairperson.online,
            chatType: 'chairperson'
        };
        
        document.querySelectorAll('.chat-item').forEach(it => it.classList.remove('active'));
        const chatItem = document.querySelector(`.chat-item[data-type="chairperson"]`);
        if (chatItem) chatItem.classList.add('active');
        
        renderChairpersonChatInterface(chairperson);
        
        // Clear unread badge
        (async () => {
            try {
                await markChairpersonMessagesAsRead();
                const badge = document.querySelector(`.unread-badge-placeholder[data-chair-id]`);
                if (badge) badge.innerHTML = '';
            } catch (e) {
                console.error('Error marking chairperson messages as read', e);
            }
        })();
    }
    
    function openSecretaryChat(secretary) {
        selectedStudent = {
            id: secretary.id,
            idNumber: secretary.id,
            name: secretary.name,
            online: secretary.online,
            chatType: 'secretary'
        };
        
        document.querySelectorAll('.chat-item').forEach(it => it.classList.remove('active'));
        const chatItem = document.querySelector(`.chat-item[data-type="secretary"]`);
        if (chatItem) chatItem.classList.add('active');
        
        renderSecretaryChatInterface(secretary);
        
        // Clear unread badge
        (async () => {
            try {
                await markSecretaryMessagesAsRead();
                const badge = document.querySelector(`.unread-badge-placeholder[data-sec-id]`);
                if (badge) badge.innerHTML = '';
            } catch (e) {
                console.error('Error marking secretary messages as read', e);
            }
        })();
    }
    
    async function renderChairpersonChatInterface(chairperson) {
        const chatWindow = document.getElementById('chat-window');
        if (!chatWindow) return;
        
        const name = chairperson.name || 'Chairperson';
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
        
        chatWindow.innerHTML = `
            <div class="chat-header">
                <img src="${avatarUrl}" alt="${name}">
                <div class="chat-header-info">
                    <div class="chat-header-name">${name}</div>
                    <div class="chat-header-status">
                        <span class="indicator ${chairperson.online ? 'online' : ''}"></span>
                        <span id="status-text">${chairperson.online ? 'Online' : 'Offline'}</span>
                    </div>
                </div>
            </div>
            <div id="messages">
                <p style="text-align:center; color: #888; margin-top: 20px;">Loading messages...</p>
            </div>
            <div id="image-preview-container" style="display: none; padding: 10px; background: #f3f4f6; border-radius: 8px; margin: 10px; position: relative;">
                <img id="image-preview" src="" alt="Image Preview" style="max-width: 200px; border-radius: 8px;">
                <button id="remove-image-preview" class="action-btn" style="position: absolute; top: 5px; right: 5px; background: #ef4444; color: white;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="input-container">
                <input type="file" id="image-input" accept="image/*" style="display: none;">
                <button class="action-btn" id="attach-image-btn"><i class="fas fa-paperclip"></i></button>
                <input type="text" id="message" placeholder="Type a message...">
                <button id="send-btn"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        
        // Load messages from advisers/{department}/sections/{section}/messagewithchair
        const messagePath = db.collection('advisers')
            .doc(adviserInfo.department)
            .collection('sections')
            .doc(adviserInfo.section)
            .collection('messagewithchair');
        
        try {
            const messages = await messagePath.orderBy('timestamp', 'asc').get();
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';
            
            if (messages.empty) {
                messagesContainer.innerHTML = `
                    <p style="text-align:center; color: #888; margin-top: 20px;">
                        This is the beginning of your conversation with ${name}.
                    </p>
                `;
            } else {
                messages.forEach(doc => {
                    const message = doc.data();
                    message.id = doc.id;
                    const isSent = message.senderId === adviserInfo.id;
                    displayMessage(message, isSent);
                });
            }
            
            // Listen for new messages
            listenToChairpersonMessages();
            
            // Setup message input handlers
            document.getElementById('send-btn').addEventListener('click', sendMessage);
            document.getElementById('message').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
            
            // Image attachment handlers
            const attachImageBtn = document.getElementById('attach-image-btn');
            const imageInput = document.getElementById('image-input');
            const removeImagePreviewBtn = document.getElementById('remove-image-preview');
            
            if (attachImageBtn && imageInput) {
                attachImageBtn.addEventListener('click', () => {
                    imageInput.click();
                });
                imageInput.addEventListener('change', handleImageSelection);
            }
            
            if (removeImagePreviewBtn) {
                removeImagePreviewBtn.addEventListener('click', removeImagePreview);
            }
            
        } catch (error) {
            console.error('Error loading chairperson messages:', error);
            document.getElementById('messages').innerHTML = '<p style="text-align:center; color: #dc3545;">Failed to load messages</p>';
        }
    }
    
    async function renderSecretaryChatInterface(secretary) {
        const chatWindow = document.getElementById('chat-window');
        if (!chatWindow) return;
        
        const name = secretary.name || 'Secretary';
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
        
        chatWindow.innerHTML = `
            <div class="chat-header">
                <img src="${avatarUrl}" alt="${name}">
                <div class="chat-header-info">
                    <div class="chat-header-name">${name}</div>
                    <div class="chat-header-status">
                        <span class="indicator ${secretary.online ? 'online' : ''}"></span>
                        <span id="status-text">${secretary.online ? 'Online' : 'Offline'}</span>
                    </div>
                </div>
            </div>
            <div id="messages">
                <p style="text-align:center; color: #888; margin-top: 20px;">Loading messages...</p>
            </div>
            <div id="image-preview-container" style="display: none; padding: 10px; background: #f3f4f6; border-radius: 8px; margin: 10px; position: relative;">
                <img id="image-preview" src="" alt="Image Preview" style="max-width: 200px; border-radius: 8px;">
                <button id="remove-image-preview" class="action-btn" style="position: absolute; top: 5px; right: 5px; background: #ef4444; color: white;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="input-container">
                <input type="file" id="image-input" accept="image/*" style="display: none;">
                <button class="action-btn" id="attach-image-btn"><i class="fas fa-paperclip"></i></button>
                <input type="text" id="message" placeholder="Type a message...">
                <button id="send-btn"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        
        // Load messages from advisers/{department}/sections/{section}/messagewithsec
        const messagePath = db.collection('advisers')
            .doc(adviserInfo.department)
            .collection('sections')
            .doc(adviserInfo.section)
            .collection('messagewithsec');
        
        try {
            const messages = await messagePath.orderBy('timestamp', 'asc').get();
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';
            
            if (messages.empty) {
                messagesContainer.innerHTML = `
                    <p style="text-align:center; color: #888; margin-top: 20px;">
                        This is the beginning of your conversation with ${name}.
                    </p>
                `;
            } else {
                messages.forEach(doc => {
                    const message = doc.data();
                    message.id = doc.id;
                    const isSent = message.senderId === adviserInfo.id;
                    displayMessage(message, isSent);
                });
            }
            
            // Listen for new messages
            listenToSecretaryMessages();
            
            // Setup message input handlers
            document.getElementById('send-btn').addEventListener('click', sendMessage);
            document.getElementById('message').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
            
            // Image attachment handlers
            const attachImageBtn = document.getElementById('attach-image-btn');
            const imageInput = document.getElementById('image-input');
            const removeImagePreviewBtn = document.getElementById('remove-image-preview');
            
            if (attachImageBtn && imageInput) {
                attachImageBtn.addEventListener('click', () => {
                    imageInput.click();
                });
                imageInput.addEventListener('change', handleImageSelection);
            }
            
            if (removeImagePreviewBtn) {
                removeImagePreviewBtn.addEventListener('click', removeImagePreview);
            }
            
        } catch (error) {
            console.error('Error loading secretary messages:', error);
            document.getElementById('messages').innerHTML = '<p style="text-align:center; color: #dc3545;">Failed to load messages</p>';
        }
    }
    
    function listenToChairpersonMessages() {
        if (currentMessageListener) {
            currentMessageListener();
        }
        
        const messagePath = db.collection('advisers')
            .doc(adviserInfo.department)
            .collection('sections')
            .doc(adviserInfo.section)
            .collection('messagewithchair');
        
        currentMessageListener = messagePath
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        const messageTime = message.timestamp?.toMillis();
                        
                        if (!lastLoadedMessageTime || !messageTime || messageTime > lastLoadedMessageTime) {
                            displayMessage(message, message.senderId === adviserInfo.id);
                        }
                    }
                });
            });
        
        return currentMessageListener;
    }
    
    function listenToSecretaryMessages() {
        if (currentMessageListener) {
            currentMessageListener();
        }
        
        const messagePath = db.collection('advisers')
            .doc(adviserInfo.department)
            .collection('sections')
            .doc(adviserInfo.section)
            .collection('messagewithsec');
        
        currentMessageListener = messagePath
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        const messageTime = message.timestamp?.toMillis();
                        
                        if (!lastLoadedMessageTime || !messageTime || messageTime > lastLoadedMessageTime) {
                            displayMessage(message, message.senderId === adviserInfo.id);
                        }
                    }
                });
            });
        
        return currentMessageListener;
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = (e.target.value || '').toLowerCase().trim();
            document.querySelectorAll('#students-list-container .chat-item').forEach(it => {
                const nameText = (it.querySelector('.student-name')?.textContent || '').toLowerCase();
                it.style.display = nameText.includes(q) ? '' : 'flex';
            });
        });
    }

    const sidebarToggleBtn = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', () => sidebar.classList.toggle('active'));
    }

    const tabsContainer = document.querySelector('.tabs');
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-link');
            if (!btn) return;
            tabsContainer.querySelectorAll('.tab-link').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('.chat-list-content').forEach(c => c.classList.remove('active'));
            const containerToShow = document.getElementById(`${filter}-list-container`);
            if (containerToShow) containerToShow.classList.add('active');
            if (filter === 'students') loadStudents();
            if (filter === 'chairperson') loadChairperson();
            if (filter === 'secretary') loadSecretary();
        });
    }

    async function loadChairperson() {
        const container = document.getElementById('chairperson-list-container');
        if (!container) return;
        
        container.innerHTML = '<p style="padding:20px;text-align:center;color:#6b7280">Loading chairperson...</p>';
        
        try {
            if (!adviserInfo.department) {
                container.innerHTML = '<p style="padding:20px;text-align:center;color:#6b7280">Department not found</p>';
                return;
            }
            
            // Fetch from officers/{department}/chairperson/idNumber
            const chairpersonRef = db.collection('officers').doc(adviserInfo.department).collection('chairperson');
            const snapshot = await chairpersonRef.get();
            
            if (snapshot.empty) {
                container.innerHTML = '<p style="padding:20px;text-align:center;color:#6b7280">No chairperson found</p>';
                return;
            }
            
            // Get the first chairperson document (should be only one)
            const chairDoc = snapshot.docs[0];
            const chairData = chairDoc.data();
            const chairIdNumber = chairDoc.id;
            
            const isOnline = chairData.online === true;
            const chairName = chairData.name || 'Chairperson';
            
            // Fetch chat preview (last message and unread count)
            const preview = await fetchChairpersonChatPreview();
            const lastMessageText = preview.lastMessageText || '';
            const lastMessageTime = preview.lastMessageTime ? new Date(preview.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const unreadCount = preview.unreadCount || 0;
            
            container.innerHTML = `
                <div class="chat-item" data-id="${chairIdNumber}" data-type="chairperson">
                    <div class="avatar-container">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(chairName)}&background=random" alt="${chairName}">
                        <div class="status-indicator ${isOnline ? 'online' : 'offline'}"></div>
                    </div>
                    <div class="student-info">
                        <div class="student-name">${chairName}</div>
                        <div class="last-message-preview">${lastMessageText}</div>
                    </div>
                    <div class="chat-item-right">
                        <div class="last-message-time">${lastMessageTime}</div>
                        <div class="unread-badge-placeholder" data-chair-id="${chairIdNumber}">
                            ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            // Add click handler
            const chatItem = container.querySelector('.chat-item');
            if (chatItem) {
                chatItem.addEventListener('click', () => {
                    openChairpersonChat({
                        id: chairIdNumber,
                        name: chairName,
                        online: isOnline
                    });
                });
            }
            
            // Listen for online status changes
            chairpersonRef.onSnapshot(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const statusIndicator = container.querySelector('.status-indicator');
                    if (statusIndicator) {
                        statusIndicator.className = `status-indicator ${data.online === true ? 'online' : 'offline'}`;
                    }
                });
            });
            
            // Listen for unread count changes
            startChairpersonUnreadListener();
            
        } catch (error) {
            console.error('Error loading chairperson:', error);
            container.innerHTML = '<p style="padding:20px;text-align:center;color:#dc3545">Failed to load chairperson</p>';
        }
    }

    async function loadSecretary() {
        const container = document.getElementById('secretary-list-container');
        if (!container) return;
        
        container.innerHTML = '<p style="padding:20px;text-align:center;color:#6b7280">Loading secretary...</p>';
        
        try {
            // Fetch from secretary/secretaryInfo
            const secretaryRef = db.collection('secretary').doc('secretaryInfo');
            const doc = await secretaryRef.get();
            
            if (!doc.exists) {
                container.innerHTML = '<p style="padding:20px;text-align:center;color:#6b7280">No secretary found</p>';
                return;
            }
            
            const secData = doc.data();
            const isOnline = secData.online === true;
            const secName = secData.name || 'Secretary';
            const secId = secData.idNumber || 'secretary';
            
            // Fetch chat preview (last message and unread count)
            const preview = await fetchSecretaryChatPreview();
            const lastMessageText = preview.lastMessageText || '';
            const lastMessageTime = preview.lastMessageTime ? new Date(preview.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const unreadCount = preview.unreadCount || 0;
            
            container.innerHTML = `
                <div class="chat-item" data-id="${secId}" data-type="secretary">
                    <div class="avatar-container">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(secName)}&background=random" alt="${secName}">
                        <div class="status-indicator ${isOnline ? 'online' : 'offline'}"></div>
                    </div>
                    <div class="student-info">
                        <div class="student-name">${secName}</div>
                        <div class="last-message-preview">${lastMessageText}</div>
                    </div>
                    <div class="chat-item-right">
                        <div class="last-message-time">${lastMessageTime}</div>
                        <div class="unread-badge-placeholder" data-sec-id="${secId}">
                            ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            // Add click handler
            const chatItem = container.querySelector('.chat-item');
            if (chatItem) {
                chatItem.addEventListener('click', () => {
                    openSecretaryChat({
                        id: secId,
                        name: secName,
                        online: isOnline
                    });
                });
            }
            
            // Listen for online status changes
            secretaryRef.onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const statusIndicator = container.querySelector('.status-indicator');
                    if (statusIndicator) {
                        statusIndicator.className = `status-indicator ${data.online === true ? 'online' : 'offline'}`;
                    }
                }
            });
            
            // Listen for unread count changes
            startSecretaryUnreadListener();
            
        } catch (error) {
            console.error('Error loading secretary:', error);
            container.innerHTML = '<p style="padding:20px;text-align:center;color:#dc3545">Failed to load secretary</p>';
        }
    }

    function initializePage() {
        displayHeaderInfo();
        loadStudents();

        // Mark adviser as online when they open this chat page
        // and ensure we mark offline when they leave or hide the page.
        (async () => {
            try {
                if (adviserInfo && adviserInfo.id && adviserInfo.department && adviserInfo.section) {
                    await setAdviserOnline(true);
                }
            } catch (e) {
                console.error('Failed to set adviser online on init', e);
            }
        })();

        // Start listening to presence changes so the UI shows Online/Offline
        try {
            listenToAdviserPresence();
        } catch (e) {
            console.error('Failed to start presence listener', e);
        }
    }

    // Logout functionality
    const logoutLinks = document.querySelectorAll('a[href="#"]');
    logoutLinks.forEach(link => {
        if (link.textContent.trim().toLowerCase().includes('logout')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                sessionStorage.clear();
                window.location.href = '../officelogin/officelogin.html';
            });
        }
    });

    initializePage();

    // Image modal close handlers
    const imageModal = document.getElementById('image-viewer-modal');
    const imageModalClose = imageModal?.querySelector('.image-modal-close');
    
    if (imageModalClose) {
        imageModalClose.addEventListener('click', closeImageModal);
    }
    
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
    }

    // Listen for page visibility changes and unload to update online status
    document.addEventListener('visibilitychange', () => {
        try {
            if (!adviserInfo || !adviserInfo.id || !adviserInfo.department || !adviserInfo.section) return;
            if (document.hidden) {
                // Page hidden -> consider adviser offline
                setAdviserOnline(false).catch(e => console.error('visibilitychange set offline failed', e));
            } else {
                setAdviserOnline(true).catch(e => console.error('visibilitychange set online failed', e));
            }
        } catch (e) {
            console.error('Error handling visibilitychange', e);
        }
    });

    // Attempt to mark adviser offline when the page is unloaded
    window.addEventListener('beforeunload', (e) => {
        try {
            if (adviserInfo && adviserInfo.id && adviserInfo.department && adviserInfo.section) {
                // Fire-and-forget; may not complete if browser unloads immediately
                setAdviserOnline(false).catch(err => console.error('beforeunload set offline failed', err));
            }
        } catch (err) {
            console.error('Error in beforeunload handler', err);
        }
        // No need to call preventDefault()
    });
});