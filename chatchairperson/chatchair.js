const API_BASE = (typeof window !== 'undefined' && window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';

document.addEventListener('DOMContentLoaded', () => {
    // --- Sidebar Toggle Functionality ---
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const mainContentWrapper = document.querySelector('.main-content-wrapper');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            mainContentWrapper.classList.toggle('sidebar-active'); // Optional: if you need to adjust main content
        });
    }

    // --- User Info Initialization ---
    // Fetches user data from the server using the ID from localStorage
    async function initUserInfo() {
            // Prefer sessionStorage.currentUser set by login, fallback to localStorage
            let idNumber = null;
            try {
                const cur = sessionStorage.getItem('currentUser');
                if (cur) {
                    const obj = JSON.parse(cur);
                    if (obj && obj.idNumber) {
                        idNumber = obj.idNumber;
                        currentDepartment = obj.department || currentDepartment;
                        if (obj.name) {
                            const headerName = document.getElementById('header-username');
                            if (headerName) headerName.textContent = obj.name;
                        }
                    }
                }
            } catch (e) { console.warn('Failed parsing sessionStorage.currentUser', e); }

            if (!idNumber) idNumber = localStorage.getItem('idNumber');
            if (!idNumber) {
                alert('No ID number found in storage. Please log in first.');
                window.location.href = '/officelogin/officelogin.html';
                return;
            }

        try {
            const response = await fetch(`${API_BASE}/api/user-info/${idNumber}`);
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const userData = await response.json();
            
            const usernameElem = document.getElementById('header-username');
            const departmentElem = document.getElementById('chairdepartment');
            const userProfileImg = document.querySelector('.user-profile img');

            if (usernameElem && userData.name) {
                usernameElem.textContent = userData.name;
            }
            if (departmentElem && userData.department) {
                departmentElem.textContent = userData.department;
            }
            if (userProfileImg && userData.name) {
                // Generate avatar from the fetched name
                userProfileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=3f37c9&color=fff`;
            }

        } catch (error) {
            console.error("Failed to fetch user info for header:", error);
        }
    }

    // Initialize user info on page load
    initUserInfo();
});

// Firebase is initialized in the page (see chatchair.html). Use the existing instance.
const db = (typeof window !== 'undefined' && window.db) ? window.db : (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length ? firebase.firestore() : null);
const storage = (typeof firebase !== 'undefined' && firebase.storage) ? firebase.storage() : null; // Firebase Storage (if available)
const chairpersonID = "Chairperson";

let currentDepartment = null; // To store the chairperson's department
let allStudents = []; // To store all students for client-side filtering
let allAdvisers = []; // To store all advisers for client-side filtering

let selectedContact = null;
let selectedContactType = null; // 'student' or 'adviser'

let pendingImageUrl = null; // To store the URL of the image waiting to be sent
let editingMessageId = null; // To store the ID of the message being edited
let unsubscribeFromMessages = null; // To store the unsubscribe function for real-time messages
let chatPreviewUnsubscribers = new Map(); // Map to store unsubscribe functions for chat list previews

function clearAllChatPreviewListeners() {
    chatPreviewUnsubscribers.forEach(unsubscribe => unsubscribe());
    chatPreviewUnsubscribers.clear();
}

document.addEventListener('DOMContentLoaded', async () => {
    await initChairpersonInfo(); // Fetch chairperson info first
    if (currentDepartment) {
        await loadSections(); // Then load sections
        await loadStudents(); // Then load all students
    }

    // (removed small in-list status widget; header status remains)

    // Presence: set chairperson online status in Firestore and keep it alive
    // We'll update officers/<department>/chairperson/<idNumber> with { online: boolean, lastSeen: serverTimestamp }
    let presenceIntervalId = null;

    // ...existing code...

    async function setChairOnlineStatus(isOnline) {
            try {
                // Prefer sessionStorage.currentUser (set by the login flow) and fall back to localStorage
                let idNumber = null;
                try {
                    const cur = sessionStorage.getItem('currentUser');
                    if (cur) {
                        const obj = JSON.parse(cur);
                        if (obj && obj.idNumber) idNumber = obj.idNumber;
                    }
                } catch (e) { /* ignore parse errors */ }
                if (!idNumber) idNumber = localStorage.getItem('idNumber');
                if (!idNumber || !currentDepartment) return;
            const officerRef = db.collection('officers').doc(currentDepartment).collection('chairperson').doc(idNumber);
            await officerRef.set({
                online: !!isOnline,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Also update local UI status indicator if present
            const statusText = document.getElementById('status-text');
            const statusIndicator = document.getElementById('status-indicator');
            if (statusText) statusText.textContent = isOnline ? 'Online' : 'Offline';
            if (statusIndicator) {
                if (isOnline) statusIndicator.classList.add('online'); else statusIndicator.classList.remove('online');
            }

            // Also update the header Chat List status indicator (beside the Chat List title)
            try {
                const headerDot = document.getElementById('chat-list-dot');
                const headerText = document.getElementById('chat-list-status-text');
                if (headerDot) headerDot.style.background = isOnline ? '#28a745' : '#6c757d';
                if (headerText) headerText.textContent = isOnline ? 'Online' : 'Offline';
            } catch (e) {
                // non-fatal
            }
        } catch (err) {
            console.error('[Presence] Failed to set online status:', err);
        }
    }

    // Start presence when page is visible
    try {
        // initial set
        await setChairOnlineStatus(true);

        // heartbeat to keep lastSeen updated (every 30s)
        presenceIntervalId = setInterval(() => {
            setChairOnlineStatus(true).catch(e => console.error('[Presence] heartbeat error', e));
        }, 30000);

        // When tab/window hidden, mark offline; when visible again, mark online
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                setChairOnlineStatus(true);
            } else {
                setChairOnlineStatus(false);
            }
        });

        // On unload, mark offline and clear interval
        window.addEventListener('beforeunload', () => {
            try { setChairOnlineStatus(false); } catch (_) {}
            if (presenceIntervalId) clearInterval(presenceIntervalId);
        });
    } catch (err) {
        console.error('[Presence] initialization error', err);
    }

    // Handle Enter key press
    const messageInput = document.getElementById('message');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Handle image attachment button click
    const attachImageBtn = document.getElementById('attach-image-btn');
    const imageInput = document.getElementById('image-input');
    if (attachImageBtn && imageInput) {
        attachImageBtn.addEventListener('click', () => {
            imageInput.click(); // Trigger the hidden file input
        });

        imageInput.addEventListener('change', handleImageSelection);
    }

    // Handle removing image preview
    const removeImagePreviewBtn = document.getElementById('remove-image-preview');
    if (removeImagePreviewBtn) {
        removeImagePreviewBtn.addEventListener('click', removeImagePreview);
    }

    // Handle cancel edit button click
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelEdit);
    }
});

function openTab(event, tabName) {
    // Get all elements with class="tab-link" and remove the class "active"
    const tablinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Clear all existing chat preview listeners when switching tabs
    clearAllChatPreviewListeners();

    // Show the current tab, and add an "active" class to the button that opened the tab
    event.currentTarget.className += " active";

    // Hide all tab content by default
    const studentList = document.getElementById('student-list');
    studentList.innerHTML = ''; // Clear the list

    const sectionFilter = document.getElementById('section-filter-wrapper');

    if (tabName === 'students') {
        sectionFilter.style.display = 'block';
        loadStudents();
    } else if (tabName === 'advisers') {
        sectionFilter.style.display = 'block';
        loadAdvisers();
    } else if (tabName === 'secretary') {
        sectionFilter.style.display = 'none';
        displayWelcomeMessage("Secretary chat is not yet implemented.", "fas fa-user-secret");
    }
}

// Fetches chairperson info to get their department
async function initChairpersonInfo() {
    // Prefer sessionStorage.currentUser (set by the login flow) and fall back to localStorage
    let idNumber = null;
        try {
            const cur = sessionStorage.getItem('currentUser');
            if (cur) {
                const obj = JSON.parse(cur);
                if (obj && obj.idNumber) idNumber = obj.idNumber;
            }
        } catch (e) { /* ignore parse errors */ }
        if (!idNumber) idNumber = localStorage.getItem('idNumber');
        if (!idNumber) {
            console.error("Chairperson ID not found in storage.");
            return;
        }
    try {
    const response = await fetch(`${API_BASE}/api/user-info/${idNumber}`);
        const userData = await response.json();
        if (userData.department) {
            currentDepartment = userData.department;
        } else {
            console.error("Could not determine chairperson's department.");
        }
    } catch (error) {
        console.error("Error fetching chairperson info:", error);
    }
}

// Load sections into the filter dropdown
async function loadSections() {
    if (!currentDepartment) return;
    try {
    const response = await fetch(`${API_BASE}/api/sections/${currentDepartment}`);
        const sections = await response.json();
        const sectionFilter = document.getElementById('section-filter');
        
        sections.forEach(sectionId => {
            const option = document.createElement('option');
            option.value = sectionId;
            option.textContent = `Section ${sectionId}`;
            sectionFilter.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading sections:", error);
    }
}

// Load all students from the chairperson's department
async function loadStudents() {
    if (!currentDepartment) {
        displayWelcomeMessage("Error: Department not found.", "fas fa-exclamation-triangle", "var(--danger-color)");
        return;
    }

    try {
    const response = await fetch(`${API_BASE}/api/students/${currentDepartment}`);
        allStudents = await response.json();

        // Build initial preview (unread + latest message) for each student
        const previewPromises = allStudents.map(async (s) => {
            const preview = await fetchChatPreviewForContact(s, 'student');
            return { student: s, preview };
        });
        const previewResults = await Promise.all(previewPromises);

        const initialOnlineStatusMap = {};
        const initialPreviewMap = {};
        const initialUnreadMap = {};

        previewResults.forEach(r => {
            initialUnreadMap[r.student.id] = r.preview.unreadCount;
            initialPreviewMap[r.student.id] = { lastMessageTime: r.preview.lastMessageTime, lastMessageText: r.preview.lastMessageText };
        });

        // Sort all contacts by latest message time (newest first) for initial display
        const sortedInitialStudents = [...allStudents].sort((a, b) => {
            const ta = (initialPreviewMap[a.id] && initialPreviewMap[a.id].lastMessageTime) ? initialPreviewMap[a.id].lastMessageTime.getTime() : 0;
            const tb = (initialPreviewMap[b.id] && initialPreviewMap[b.id].lastMessageTime) ? initialPreviewMap[b.id].lastMessageTime.getTime() : 0;
            return tb - ta; // newest first
        });

        // Clear previous listeners when re-loading students
        clearAllChatPreviewListeners();

        const onlineStatusMap = initialOnlineStatusMap; // Use initial for first display
        const previewMap = initialPreviewMap;
        const unreadMap = initialUnreadMap;

        // Initial display of students (now with proper sorting)
        displayStudents(sortedInitialStudents, onlineStatusMap, previewMap, unreadMap);

        // For each student, set up real-time listeners for presence and chat preview
        allStudents.forEach(student => {
            const studentRef = db.collection('students').doc(currentDepartment).collection(student.section).doc(student.id);
            const messagesCollection = studentRef.collection("messagechair");

            // Listen for presence (online/offline status)
            const presenceUnsubscribe = db.collection('students').doc(currentDepartment).collection(student.section).doc(student.id).collection('presence').doc('status')
                .onSnapshot(docSnapshot => {
                    if (docSnapshot.exists) {
                        const data = docSnapshot.data();
                        const isOnline = data && data.online === true;
                        onlineStatusMap[student.id] = isOnline; // Update map
                        // Re-render only this student's status indicator
                        const studentItem = document.querySelector(`.chat-item[data-id='${student.id}']`);
                        if (studentItem) {
                            const statusIndicator = studentItem.querySelector('.status-indicator');
                            if (statusIndicator) {
                                if (isOnline) statusIndicator.classList.add('online');
                                else statusIndicator.classList.remove('online');
                            }
                        }
                    }
                }, err => console.error('[Presence Listener] Error for student', student.id, err));
            chatPreviewUnsubscribers.set(`student-presence-${student.id}`, presenceUnsubscribe);

            // Listen for chat preview (last message and unread count)
            const chatPreviewUnsubscribe = messagesCollection.orderBy('messageDate', 'desc')
                .onSnapshot(snapshot => {
                    let lastMessageTime = null;
                    let lastMessageText = '';
                    if (!snapshot.empty) {
                        const latestDoc = snapshot.docs[0];
                        const data = latestDoc.data() || {};
                        lastMessageTime = data.messageDate ? (typeof data.messageDate.toDate === 'function' ? data.messageDate.toDate() : new Date(data.messageDate)) : null;
                        lastMessageText = data.message || (data.imageUrl ? 'Image' : '');
                    }
                    previewMap[student.id] = { lastMessageTime, lastMessageText };

                    let unreadCount = 0;
                    snapshot.forEach(doc => {
                        const d = doc.data() || {};
                        // Only count messages *from the student* that are not deleted and not read by chairperson
                        if (d.messagePerson !== 'Chairperson' && !d.deleted && d.read !== true) {
                            unreadCount++;
                        }
                    });
                    unreadMap[student.id] = unreadCount;

                    // Re-render the student list to reflect updated preview and unread count
                    // Sort all contacts by latest message time (newest first) before displaying
                    const sortedStudents = [...allStudents].sort((a, b) => {
                        const ta = (previewMap[a.id] && previewMap[a.id].lastMessageTime) ? previewMap[a.id].lastMessageTime.getTime() : 0;
                        const tb = (previewMap[b.id] && previewMap[b.id].lastMessageTime) ? previewMap[b.id].lastMessageTime.getTime() : 0;
                        return tb - ta; // newest first
                    });
                    displayStudents(sortedStudents, onlineStatusMap, previewMap, unreadMap);
                }, err => console.error('[Chat Preview Listener] Error for student', student.id, err));
            chatPreviewUnsubscribers.set(`student-chat-${student.id}`, chatPreviewUnsubscribe);
        });

    } catch (error) {
        console.error("Error loading students:", error);
        displayWelcomeMessage("Error loading students.", "fas fa-exclamation-triangle", "var(--danger-color)");
    }
}

async function loadAdvisers() {
    if (!currentDepartment) {
        displayWelcomeMessage("Error: Department not found.", "fas fa-exclamation-triangle", "var(--danger-color)");
        return;
    }

    try {
    const response = await fetch(`${API_BASE}/api/advisers/${currentDepartment}`);
        allAdvisers = await response.json();

        // Build initial preview (unread + latest message) for each adviser
        const previewPromises = allAdvisers.map(async (a) => {
            const preview = await fetchChatPreviewForContact(a, 'adviser');
            return { adviser: a, preview };
        });
        const previewResults = await Promise.all(previewPromises);

        const initialOnlineStatusMap = {};
        const initialPreviewMap = {};
        const initialUnreadMap = {};

        previewResults.forEach(r => {
            initialUnreadMap[r.adviser.idNumber] = r.preview.unreadCount;
            initialPreviewMap[r.adviser.idNumber] = { lastMessageTime: r.preview.lastMessageTime, lastMessageText: r.preview.lastMessageText };
        });

        // Sort all contacts by latest message time (newest first) for initial display
        const sortedInitialAdvisers = [...allAdvisers].sort((a, b) => {
            const ta = (initialPreviewMap[a.idNumber] && initialPreviewMap[a.idNumber].lastMessageTime) ? initialPreviewMap[a.idNumber].lastMessageTime.getTime() : 0;
            const tb = (initialPreviewMap[b.idNumber] && initialPreviewMap[b.idNumber].lastMessageTime) ? initialPreviewMap[b.idNumber].lastMessageTime.getTime() : 0;
            return tb - ta; // newest first
        });

        // Clear previous listeners when re-loading advisers
        clearAllChatPreviewListeners();

        const onlineStatusMap = initialOnlineStatusMap;
        const previewMap = initialPreviewMap;
        const unreadMap = initialUnreadMap;

        // Initial display of advisers (now with proper sorting)
        displayAdvisers(sortedInitialAdvisers, onlineStatusMap, previewMap, unreadMap);

        // For each adviser, set up real-time listeners for presence and chat preview
        allAdvisers.forEach(adviser => {
            const adviserRef = db.collection('advisers').doc(currentDepartment).collection("sections").doc(adviser.section).doc(adviser.idNumber);
            const messagesCollection = adviserRef.collection("messagewithchair");

            // Listen for presence (online/offline status)
            const presenceUnsubscribe = db.collection('advisers').doc(currentDepartment).collection("sections").doc(adviser.section).doc(adviser.idNumber).collection('presence').doc('status')
                .onSnapshot(docSnapshot => {
                    if (docSnapshot.exists) {
                        const data = docSnapshot.data();
                        const isOnline = data && data.online === true;
                        onlineStatusMap[adviser.idNumber] = isOnline; // Update map
                        // Re-render only this adviser's status indicator
                        const adviserItem = document.querySelector(`.chat-item[data-id='${adviser.idNumber}']`);
                        if (adviserItem) {
                            const statusIndicator = adviserItem.querySelector('.status-indicator');
                            if (statusIndicator) {
                                if (isOnline) statusIndicator.classList.add('online');
                                else statusIndicator.classList.remove('online');
                            }
                        }
                    }
                }, err => console.error('[Presence Listener] Error for adviser', adviser.idNumber, err));
            chatPreviewUnsubscribers.set(`adviser-presence-${adviser.idNumber}`, presenceUnsubscribe);

            // Listen for chat preview (last message and unread count)
            const chatPreviewUnsubscribe = messagesCollection.orderBy('messageDate', 'desc')
                .onSnapshot(snapshot => {
                    let lastMessageTime = null;
                    let lastMessageText = '';
                    if (!snapshot.empty) {
                        const latestDoc = snapshot.docs[0];
                        const data = latestDoc.data() || {};
                        lastMessageTime = data.messageDate ? (typeof data.messageDate.toDate === 'function' ? data.messageDate.toDate() : new Date(data.messageDate)) : null;
                        lastMessageText = data.message || (data.imageUrl ? 'Image' : '');
                    }
                    previewMap[adviser.idNumber] = { lastMessageTime, lastMessageText };

                    let unreadCount = 0;
                    snapshot.forEach(doc => {
                        const d = doc.data() || {};
                        // Only count messages *from the adviser* that are not deleted and not read by chairperson
                        if (d.messagePerson !== 'Chairperson' && !d.deleted && d.read !== true) {
                            unreadCount++;
                        }
                    });
                    unreadMap[adviser.idNumber] = unreadCount;

                    // Re-render the adviser list to reflect updated preview and unread count
                    // Sort all contacts by latest message time (newest first) before displaying
                    const sortedAdvisers = [...allAdvisers].sort((a, b) => {
                        const ta = (previewMap[a.idNumber] && previewMap[a.idNumber].lastMessageTime) ? previewMap[a.idNumber].lastMessageTime.getTime() : 0;
                        const tb = (previewMap[b.idNumber] && previewMap[b.idNumber].lastMessageTime) ? previewMap[b.idNumber].lastMessageTime.getTime() : 0;
                        return tb - ta; // newest first
                    });
                    displayAdvisers(sortedAdvisers, onlineStatusMap, previewMap, unreadMap);
                }, err => console.error('[Chat Preview Listener] Error for adviser', adviser.idNumber, err));
            chatPreviewUnsubscribers.set(`adviser-chat-${adviser.idNumber}`, chatPreviewUnsubscribe);
        });

    } catch (error) {
        console.error("Error loading advisers:", error);
        displayWelcomeMessage("Error loading advisers.", "fas fa-exclamation-triangle", "var(--danger-color)");
    }
}

// Handle section filter change
function handleSectionFilterChange() {
    const selectedSection = document.getElementById('section-filter').value;
    const activeTab = document.querySelector('.tab-link.active');

    if (!activeTab) return;

    const activeTabText = activeTab.textContent.toLowerCase();

    if (activeTabText === 'students') {
        if (selectedSection === 'all') {
            // Reuse loadStudents which already computes unread and shows only new chats
            loadStudents();
            return;
        } else {
            const filteredStudents = allStudents.filter(student => student.section === selectedSection);
            (async () => {
                const previewPromises = filteredStudents.map(async (s) => ({ student: s, preview: await fetchChatPreviewForContact(s, 'student') }));
                const previewResults = await Promise.all(previewPromises);

                previewResults.sort((a, b) => {
                    const ta = a.preview.lastMessageTime ? a.preview.lastMessageTime.getTime() : 0;
                    const tb = b.preview.lastMessageTime ? b.preview.lastMessageTime.getTime() : 0;
                    return tb - ta;
                });

                const unreadMap = {};
                const previewMap = {};
                previewResults.forEach(r => {
                    unreadMap[r.student.id] = r.preview.unreadCount;
                    previewMap[r.student.id] = { lastMessageTime: r.preview.lastMessageTime, lastMessageText: r.preview.lastMessageText };
                });

                displayStudents(previewResults.map(r => r.student), {}, previewMap, unreadMap);
            })();
        }
    } else if (activeTabText === 'advisers') {
        if (selectedSection === 'all') {
            // Reuse loadAdvisers which computes unread and shows only new adviser chats
            loadAdvisers();
            return;
        } else {
            const filteredAdvisers = allAdvisers.filter(adviser => adviser.section === selectedSection);
            (async () => {
                const previewPromises = filteredAdvisers.map(async (a) => ({ adviser: a, preview: await fetchChatPreviewForContact(a, 'adviser') }));
                const previewResults = await Promise.all(previewPromises);

                previewResults.sort((a, b) => {
                    const ta = a.preview.lastMessageTime ? a.preview.lastMessageTime.getTime() : 0;
                    const tb = b.preview.lastMessageTime ? b.preview.lastMessageTime.getTime() : 0;
                    return tb - ta;
                });

                const unreadMap = {};
                const previewMap = {};
                previewResults.forEach(r => {
                    unreadMap[r.adviser.idNumber] = r.preview.unreadCount;
                    previewMap[r.adviser.idNumber] = { lastMessageTime: r.preview.lastMessageTime, lastMessageText: r.preview.lastMessageText };
                });

                displayAdvisers(previewResults.map(r => r.adviser), {}, previewMap, unreadMap);
            })();
        }
    }
}

// Display students in the list
function displayStudents(students, onlineStatusMap = {}, previewMap = {}, unreadMap = {}) {
    const studentList = document.getElementById("student-list");
    studentList.innerHTML = ""; // Clear list

    if (!students || students.length === 0) {
        displayWelcomeMessage("No students found in this section.", "fas fa-user-graduate");
        return;
    }

    students.forEach((studentData) => {
        const studentName = studentData.name || "Unknown Student";
    // Use previewMap for last message text/time if available
    const preview = previewMap[studentData.id] || {};
    const lastMessageTime = preview.lastMessageTime ? preview.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
    const lastMessageText = preview.lastMessageText || "";

        const maxLength = 15; // Define max length for preview (approx 2 words)
        const truncatedMessage = lastMessageText.length > maxLength ? lastMessageText.substring(0, maxLength) + '...' : lastMessageText;

        const div = document.createElement("div");
        let classNames = "chat-item";
        if (selectedContact && selectedContactType === 'student' && selectedContact.id === studentData.id) {
            classNames += " active";
        }
        div.className = classNames;
        div.setAttribute('data-id', studentData.id);
        
        div.innerHTML = `
            <div class="avatar-container">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=e0e0e0&color=666" alt="${studentName}">
                <div class="status-indicator ${onlineStatusMap[studentData.id] ? 'online' : ''}"></div>
            </div>
            <div class="student-info">
                <div class="student-name">${studentName}</div>
                <div class="last-message-preview">${truncatedMessage}</div>
            </div>
            <div class="chat-item-right">
                <div class="last-message-time">${lastMessageTime}</div>
                <div class="unread-badge-placeholder"></div>
            </div>
        `;

        div.onclick = async () => {
            selectContact(studentData, 'student');
            // Mark messages as read for this contact now that chair opened the chat
            await markMessagesAsReadForContact(studentData, 'student');
            // Refresh the list so unread badges update
            loadStudents();
        };
        studentList.appendChild(div);

        // Populate unread badge using unreadMap (if available) else fetch
        (async () => {
            try {
                const unreadCount = typeof unreadMap[studentData.id] !== 'undefined' ? unreadMap[studentData.id] : await fetchUnreadCountForContact(studentData, 'student');
                const badgeContainer = div.querySelector('.unread-badge-placeholder');
                if (badgeContainer) {
                    badgeContainer.innerHTML = unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : '';
                }
            } catch (err) {
                console.error('[Chat] Error loading student unread count', err);
            }
        })();
    });
}

function displayAdvisers(advisers, onlineStatusMap = {}, previewMap = {}, unreadMap = {}) {
    const studentList = document.getElementById("student-list");
    studentList.innerHTML = ""; // Clear list

    if (!advisers || advisers.length === 0) {
        displayWelcomeMessage("No advisers found.", "fas fa-user-tie");
        return;
    }

    advisers.forEach(async (adviserData) => {
        const adviserName = adviserData.name || "Unknown Adviser";
    const preview = previewMap[adviserData.idNumber] || {};
    const lastMessageTime = preview.lastMessageTime ? preview.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
    const lastMessageText = preview.lastMessageText || "";

        const maxLength = 15; // Define max length for preview (approx 2 words)
        const truncatedMessage = lastMessageText.length > maxLength ? lastMessageText.substring(0, maxLength) + '...' : lastMessageText;

        const div = document.createElement("div");
        let classNames = "chat-item";
        if (selectedContact && selectedContactType === 'adviser' && selectedContact.idNumber === adviserData.idNumber) {
            classNames += " active";
        }
        div.className = classNames;
        div.setAttribute('data-id', adviserData.idNumber);
        
        // Placeholder for unread badge; we'll populate after querying
        div.innerHTML = `
            <div class="avatar-container">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(adviserName)}&background=e0e0e0&color=666" alt="${adviserName}">
                <div class="status-indicator ${onlineStatusMap[adviserData.idNumber] ? 'online' : ''}"></div>
            </div>
            <div class="student-info">
                <div class="student-name">${adviserName}</div>
                <div class="last-message-preview">${truncatedMessage}</div>
            </div>
            <div class="chat-item-right">
                <div class="last-message-time">${lastMessageTime}</div>
                <div class="unread-badge-placeholder"></div>
            </div>
        `;

        div.onclick = async () => {
            selectContact(adviserData, 'adviser');
            await markMessagesAsReadForContact(adviserData, 'adviser');
            loadAdvisers();
        };

        studentList.appendChild(div);

        // Fetch unread count from unreadMap if provided, otherwise compute
        try {
            const unreadCount = typeof unreadMap[adviserData.idNumber] !== 'undefined' ? unreadMap[adviserData.idNumber] : await fetchUnreadCountForContact(adviserData, 'adviser');
            const badgeContainer = div.querySelector('.unread-badge-placeholder');
            if (badgeContainer) {
                badgeContainer.innerHTML = unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : '';
            }
        } catch (err) {
            console.error('[Chat] Error loading adviser unread count', err);
        }
    });
}

// Helper to display messages in the student list area
function displayWelcomeMessage(message, iconClass, color = 'var(--gray-color)') {
    const studentList = document.getElementById("student-list");
    studentList.innerHTML = `
        <div class="welcome-message" style="color: ${color};">
            <i class="${iconClass}"></i>
            <p>${message}</p>
        </div>
    `;
}

// Filter contacts based on search input
function filterContacts() {
    const searchInput = document.getElementById('search-input').value.toLowerCase();
    const items = document.querySelectorAll('#student-list .chat-item');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const isVisible = text.includes(searchInput);
        item.style.display = isVisible ? 'flex' : 'none';
    });
}

// Select a contact to open chat
function selectContact(contactData, type) {
    selectedContact = contactData;
    selectedContactType = type;

    // Unsubscribe from previous chat's messages if active
    if (unsubscribeFromMessages) {
        unsubscribeFromMessages();
        unsubscribeFromMessages = null;
    }

    // Update UI
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const contactId = type === 'student' ? contactData.id : contactData.idNumber;
    const activeItem = document.querySelector(`.chat-item[data-id='${contactId}']`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    // Show chat header
    document.getElementById('chat-header').style.display = 'flex';
    document.getElementById('current-student-name').textContent = contactData.name;
    
    // Update avatar
    const avatar = document.getElementById('current-student-avatar');
    if (activeItem) {
        const selectedAvatar = activeItem.querySelector('img');
        avatar.src = selectedAvatar.src;
    } else {
        avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contactData.name)}&background=e0e0e0&color=666`;
    }
    
    // Update status indicator (placeholder logic)
    const statusIndicator = document.getElementById('status-indicator');
    statusIndicator.classList.remove('online'); // Default to offline
    document.getElementById('status-text').textContent = 'Offline';
    
    // Show input container
    document.getElementById('input-container').style.display = 'flex';
    
    // Load messages
    fetchMessages();
}

// Handle image selection and display preview
async function handleImageSelection(event) {
    if (!selectedContact) {
        alert("Please select a contact first to send an image!");
        event.target.value = ''; // Clear the file input
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
    imagePreview.src = ''; // Clear previous preview
    imagePreviewContainer.style.display = 'flex';

    try {
        const storageRef = storage.ref();
        const imageRef = storageRef.child(`chat_images/${currentDepartment}/${selectedContact.id || selectedContact.idNumber}/${Date.now()}_${file.name}`);
        const snapshot = await imageRef.put(file);
        pendingImageUrl = await snapshot.ref.getDownloadURL();

        imagePreview.src = pendingImageUrl; // Display preview
        imagePreviewContainer.style.display = 'flex';
    } catch (error) {
        console.error("Error uploading image for preview:", error);
        alert("Failed to upload image for preview. Please try again.");
        removeImagePreview(); // Clear preview on error
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

// Remove image preview
function removeImagePreview() {
    pendingImageUrl = null;
    document.getElementById('image-input').value = ''; // Clear file input
    document.getElementById('image-preview').src = '';
    document.getElementById('image-preview-container').style.display = 'none';
}

function getMessagesCollection() {
    if (!selectedContact) return null;

    if (selectedContactType === 'student') {
        return db.collection("students").doc(currentDepartment).collection(selectedContact.section).doc(selectedContact.id).collection("messagechair");
    } else if (selectedContactType === 'adviser') {
        return db.collection("advisers").doc(currentDepartment).collection("sections").doc(selectedContact.section).collection("messagewithchair");
    }
    return null;
}

// Build a messages collection reference for any contact (does not rely on selectedContact)
function buildMessagesCollectionFor(contact, type) {
    if (!contact) return null;
    if (type === 'student') {
        return db.collection("students").doc(currentDepartment).collection(contact.section).doc(contact.id).collection("messagechair");
    } else if (type === 'adviser') {
        return db.collection("advisers").doc(currentDepartment).collection("sections").doc(contact.section).collection("messagewithchair");
    }
    return null;
}

// Fetch the number of unread messages for a contact. This is a best-effort client-side computation.
async function fetchUnreadCountForContact(contact, type) {
    try {
        const messagesCollection = buildMessagesCollectionFor(contact, type);
        if (!messagesCollection) return 0;

        // Query messages that are not from the chairperson. We treat any message with read !== true as unread.
        const snapshot = await messagesCollection.where('messagePerson', '!=', 'Chairperson').get();
        let count = 0;
        snapshot.forEach(doc => {
            const data = doc.data() || {};
            if (data.deleted) return; // ignore deleted messages
            if (data.read === true) return; // already read
            // Treat messages without explicit read flag as unread
            count++;
        });
        return count;
    } catch (error) {
        console.error('[Chat] fetchUnreadCountForContact error:', error);
        return 0;
    }
}

// Mark messages as read for a contact when the chairperson opens the chat
async function markMessagesAsReadForContact(contact, type) {
    try {
        const messagesCollection = buildMessagesCollectionFor(contact, type);
        if (!messagesCollection) return;

        // Firestore doesn't allow multiple '!=' filters. Query messages not from Chairperson,
        // then client-side filter for those that are not yet marked read and update them.
        const snapshot = await messagesCollection.where('messagePerson', '!=', 'Chairperson').get();
        const batchPromises = [];
        snapshot.forEach(doc => {
            const data = doc.data() || {};
            if (data.deleted) return;
            if (data.read === true) return; // already read
            batchPromises.push(messagesCollection.doc(doc.id).update({ read: true }));
        });
        await Promise.all(batchPromises);
    } catch (error) {
        // Don't block the UI on failures to mark read; log for debugging
        console.error('[Chat] markMessagesAsReadForContact error:', error);
    }
}

// Fetch a small preview for a contact: unread count, last message timestamp and text
async function fetchChatPreviewForContact(contact, type) {
    try {
        const messagesCollection = buildMessagesCollectionFor(contact, type);
        if (!messagesCollection) return { unreadCount: 0, lastMessageTime: null, lastMessageText: '' };

        // Get latest message
        const latestSnap = await messagesCollection.orderBy('messageDate', 'desc').limit(1).get();
        let lastMessageTime = null;
        let lastMessageText = '';
        if (!latestSnap.empty) {
            const data = latestSnap.docs[0].data() || {};
            lastMessageTime = data.messageDate ? (typeof data.messageDate.toDate === 'function' ? data.messageDate.toDate() : new Date(data.messageDate)) : null;
            lastMessageText = data.message || (data.imageUrl ? 'Image' : '');
        }

        // Compute unread count (messages not from Chairperson and not marked read)
        // Firestore forbids two '!=' queries. Query messages not from Chairperson and
        // count those where read !== true (or missing) on the client.
        const unreadSnap = await messagesCollection.where('messagePerson', '!=', 'Chairperson').get();
        let unreadCount = 0;
        unreadSnap.forEach(doc => {
            const d = doc.data() || {};
            if (d.deleted) return;
            if (d.read === true) return;
            unreadCount++;
        });

        return { unreadCount, lastMessageTime, lastMessageText };
    } catch (error) {
        console.error('[Chat] fetchChatPreviewForContact error:', error);
        return { unreadCount: 0, lastMessageTime: null, lastMessageText: '' };
    }
}

// Send message to selected contact
async function sendMessage() {
    if (!selectedContact) {
        alert("Please select a contact first!");
        return;
    }

    const messageInput = document.getElementById('message');
    const message = messageInput.value.trim();
    const imageUrlToSend = pendingImageUrl;
    
    if (!message && !imageUrlToSend && !editingMessageId) return;

    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const messagesCollection = getMessagesCollection();

        if (editingMessageId) {
            await messagesCollection.doc(editingMessageId).update({ 
                message: message,
                edited: true,
                editedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const messageData = {
                messagePerson: "Chairperson",
                messageDate: firebase.firestore.FieldValue.serverTimestamp(),
            };

            if (message) {
                messageData.message = message;
            }
            if (imageUrlToSend) {
                messageData.imageUrl = imageUrlToSend;
            }
            
            await messagesCollection.add(messageData);
        }

        messageInput.value = '';
        messageInput.focus();
        removeImagePreview();
        cancelEdit();

    } catch (error) {
        console.error("Error sending/updating message:", error);
        alert("Failed to send/update message. Please try again.");
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

// Fetch messages in real-time
function fetchMessages() {
    if (!selectedContact) return;

    const messagesContainer = document.getElementById("messages");
    messagesContainer.innerHTML = "";

    const messagesCollection = getMessagesCollection();

    if (messagesCollection) {
        unsubscribeFromMessages = messagesCollection.orderBy("messageDate")
            .onSnapshot(snapshot => {
                messagesContainer.innerHTML = "";

                if (snapshot.empty) {
                    messagesContainer.innerHTML = `<div class="welcome-message"><p>No messages yet. Start the conversation!</p></div>`;
                    return;
                }

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const messageDiv = document.createElement("div");
                    const time = data.messageDate ? new Date(data.messageDate.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now';

                    const isSentByChairperson = data.messagePerson === "Chairperson";
                    messageDiv.className = "message " + (isSentByChairperson ? "sent" : "received");
                    
                    let content = '';
                    if (data.deleted) {
                        content += `<div class="message-text deleted-message">Deleted message</div>`;
                    } else {
                        if (data.message) {
                            content += `<div class="message-text">${data.message}</div>`;
                        }
                        if (data.imageUrl) {
                            content += `<img src="${data.imageUrl}" alt="Image" class="chat-image">`;
                        }
                    }

                    let menu = '';
                    if (isSentByChairperson && !data.deleted) {
                        let editOption = '';
                        if (data.message) {
                            editOption = `<a href="#" onclick="editMessage('${doc.id}', this)">Edit</a>`;
                        }
                        menu = `
                            <div class="message-menu">
                                <button class="menu-btn"><i class="fas fa-ellipsis-v"></i></button>
                                <div class="menu-content">
                                    ${editOption}
                                    <a href="#" onclick="deleteMessage('${doc.id}')">Delete</a>
                                </div>
                            </div>
                        `;
                    }

                    const editedIndicator = data.edited ? ' <span class="edited-indicator">(edited)</span>' : '';

                    messageDiv.innerHTML = `
                                ${menu}
                                <div class="message-content-wrapper">
                                    ${content}
                                    <div class="message-time">${time}${editedIndicator} ${isSentByChairperson ? '<span>✓✓</span>' : ''}</div>
                                </div>
                            `;

                            messagesContainer.appendChild(messageDiv);
                        });

                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                messagesContainer.querySelectorAll('.chat-image').forEach(image => {
                    image.addEventListener('click', () => {
                        openImageModal(image.src);
                    });
                });
            }, error => {
                console.error("Error loading messages:", error);
                messagesContainer.innerHTML = `<div class="welcome-message" style="color: var(--danger-color);"><i class="fas fa-exclamation-triangle"></i><p>Error loading messages</p></div>`;
            });
    }
}

// --- Image Modal Logic ---
function openImageModal(src) {
    const modal = document.getElementById('image-viewer-modal');
    const modalImg = document.getElementById('modal-image');
    if (modal && modalImg) {
        modal.style.display = 'flex';
        modalImg.src = src;
    }
}

function closeImageModal() {
    const modal = document.getElementById('image-viewer-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Add event listeners for closing the modal
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('image-viewer-modal');
    const closeBtn = document.querySelector('.image-modal-close');

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { // Close if clicking on the background
                closeImageModal();
            }
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeImageModal);
    }

    // Event listeners for delete confirmation modal
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const deleteConfirmationModal = document.getElementById('delete-confirmation-modal');

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (deleteConfirmationModal.dataset.messageId) {
                await performDeleteMessage(deleteConfirmationModal.dataset.messageId);
                closeDeleteConfirmationModal();
            }
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteConfirmationModal);
    }

    if (deleteConfirmationModal) {
        deleteConfirmationModal.addEventListener('click', (e) => {
            if (e.target === deleteConfirmationModal) { // Close if clicking on the background
                closeDeleteConfirmationModal();
            }
        });
    }

    // Event listeners for success modal
    const successModalOkBtn = document.getElementById('success-modal-ok-btn');
    const successModal = document.getElementById('success-modal');

    if (successModalOkBtn) {
        successModalOkBtn.addEventListener('click', closeSuccessModal);
    }

    if (successModal) {
        successModal.addEventListener('click', (e) => {
            if (e.target === successModal) { // Close if clicking on the background
                closeSuccessModal();
            }
        });
    }
});

// Placeholder for call functionality
function startCall() {
    alert("Call functionality is not yet implemented.");
}

// --- Message Edit and Delete Logic ---
let messageToDeleteId = null; // Store the ID of the message to be deleted

async function deleteMessage(messageId) {
    if (!selectedContact) return;
    messageToDeleteId = messageId;
    openDeleteConfirmationModal();
}

async function performDeleteMessage(messageId) {
    if (!selectedContact || !messageId) return;

    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const originalBtnHtml = confirmDeleteBtn.innerHTML;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const messagesCollection = getMessagesCollection();

        await messagesCollection.doc(messageId).update({
            message: "",
            imageUrl: null,
            deleted: true,
            deletedBy: "Chairperson",
            deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showSuccessModal("Message deleted successfully.");

        if (editingMessageId === messageId) {
            cancelEdit();
        }

    } catch (error) {
        console.error("Error deleting message:", error);
        alert("Failed to delete message.");
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = originalBtnHtml;
    }
}

function openDeleteConfirmationModal() {
    const modal = document.getElementById('delete-confirmation-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.dataset.messageId = messageToDeleteId;
    }
}

function closeDeleteConfirmationModal() {
    const modal = document.getElementById('delete-confirmation-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.dataset.messageId = '';
        messageToDeleteId = null;
    }
}

function showSuccessModal(message) {
    const modal = document.getElementById('success-modal');
    const messageElement = document.getElementById('success-modal-message');
    if (modal && messageElement) {
        messageElement.textContent = message;
        modal.style.display = 'flex';
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function editMessage(messageId, element) {
    const messageDiv = element.closest('.message');
    const messageTextElement = messageDiv.querySelector('.message-text');
    const messageInput = document.getElementById('message');
    const sendBtn = document.getElementById('send-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    if (!messageTextElement || !messageInput || !sendBtn || !cancelEditBtn) {
        alert("Cannot enter edit mode. Required elements not found.");
        return;
    }

    const currentText = messageTextElement.textContent;
    
    messageInput.value = currentText;
    messageInput.focus();

    editingMessageId = messageId;

    sendBtn.innerHTML = '<i class="fas fa-check"></i>';
    sendBtn.classList.add('btn-update');

    cancelEditBtn.style.display = 'flex';

    document.getElementById('attach-image-btn').style.display = 'none';

    document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
}

function cancelEdit() {
    editingMessageId = null;
    document.getElementById('message').value = '';
    document.getElementById('send-btn').innerHTML = '<i class="fas fa-paper-plane"></i>';
    document.getElementById('send-btn').classList.remove('btn-update');
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('attach-image-btn').style.display = 'flex';
    removeImagePreview();
}