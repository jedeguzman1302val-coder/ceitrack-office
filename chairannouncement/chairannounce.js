// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyClpui-LDKc19-C0M1lR1O3fzf-wQp9jqw",
    authDomain: "project-6675709483481122019.firebaseapp.com",
    projectId: "project-6675709483481122019",
    storageBucket: "project-6675709483481122019.appspot.com",
    messagingSenderId: "1081665586576",
    appId: "1:1081665586576:web:5a00dba87ed0bfc9e8f6d1"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const storage = firebase.storage();

// API base: adjust for different ports
const API_BASE = (typeof window !== 'undefined' && window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';

let quill;
let deleteAnnouncementId = null;
let selectedImages = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Chair Announcement page loaded");

    // Initialize Quill rich text editor
    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Write your announcement content here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link'],
                ['clean']
            ]
        }
    });

    // Sidebar toggle
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (sidebar) sidebar.classList.toggle('active');
        });
    }

    // Get user info from session storage
    let currentUser = null;
    try {
        const currentUserRaw = sessionStorage.getItem('currentUser');
        if (currentUserRaw) {
            currentUser = JSON.parse(currentUserRaw);
            
            // Populate header
            if (currentUser.name) {
                document.getElementById('header-username').textContent = currentUser.name;
                const headerAvatar = document.querySelector('.user-profile img');
                if (headerAvatar) {
                    headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=3f37c9&color=fff`;
                }
            }
            
            if (currentUser.department) {
                document.getElementById('chairdepartment').textContent = currentUser.department;
            }
        }
    } catch (e) {
        console.warn('Failed to parse currentUser:', e);
    }

    // If no user found, redirect to login
    if (!currentUser || !currentUser.idNumber) {
        alert('Please login first');
        window.location.href = '/officelogin/officelogin.html';
        return;
    }

    // Image upload handler
    const imageInput = document.getElementById('announcementImages');
    imageInput.addEventListener('change', handleImageSelection);

    // Drag and drop handlers
    const uploadLabel = document.querySelector('.file-upload-label');
    if (uploadLabel) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadLabel.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadLabel.addEventListener(eventName, () => {
                uploadLabel.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadLabel.addEventListener(eventName, () => {
                uploadLabel.classList.remove('drag-over');
            }, false);
        });

        uploadLabel.addEventListener('drop', handleDrop, false);
    }

    // Form submission
    const form = document.getElementById('announcementForm');
    form.addEventListener('submit', handleSubmit);

    // Load existing announcements
    loadAnnouncements();
});

// Handle drag and drop
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    // Set the files to the input element
    document.getElementById('announcementImages').files = files;
    
    // Trigger the change event
    const event = new Event('change', { bubbles: true });
    document.getElementById('announcementImages').dispatchEvent(event);
}

// Handle image selection
function handleImageSelection(e) {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) {
        selectedImages = [];
        document.getElementById('imagePreview').innerHTML = '';
        return;
    }
    
    selectedImages = files;
    
    const previewContainer = document.getElementById('imagePreview');
    previewContainer.innerHTML = '';
    
    // Update upload label text
    const uploadLabel = document.querySelector('.file-upload-label .upload-text strong');
    if (uploadLabel) {
        uploadLabel.textContent = `${files.length} image${files.length > 1 ? 's' : ''} selected`;
    }
    
    // Show file count badge
    const badge = document.getElementById('fileCountBadge');
    if (badge) {
        badge.textContent = files.length;
        badge.style.display = 'flex';
    }
    
    files.forEach((file, index) => {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert(`${file.name} is too large. Maximum size is 10MB.`);
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert(`${file.name} is not an image file.`);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview ${index + 1}" title="${file.name}">
                <button type="button" class="remove-image" onclick="removeImage(${index})" title="Remove image">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

// Remove selected image
function removeImage(index) {
    selectedImages.splice(index, 1);
    const dataTransfer = new DataTransfer();
    selectedImages.forEach(file => dataTransfer.items.add(file));
    document.getElementById('announcementImages').files = dataTransfer.files;
    
    // Reset label text and hide badge if no images
    if (selectedImages.length === 0) {
        const uploadLabel = document.querySelector('.file-upload-label .upload-text strong');
        if (uploadLabel) {
            uploadLabel.textContent = 'Click to upload images';
        }
        const badge = document.getElementById('fileCountBadge');
        if (badge) {
            badge.style.display = 'none';
        }
    } else {
        // Update badge count
        const badge = document.getElementById('fileCountBadge');
        if (badge) {
            badge.textContent = selectedImages.length;
        }
    }
    
    // Update preview
    const event = { target: { files: selectedImages } };
    handleImageSelection(event);
}

async function handleSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('announcementTitle').value.trim();
    const content = quill.root.innerHTML.trim();

    // Validate
    if (!title) {
        showErrorMessage('Please enter a title');
        return;
    }

    if (content === '<p><br></p>' || content === '') {
        showErrorMessage('Please enter announcement content');
        return;
    }

    // Get current user info
    let currentUser = null;
    try {
        currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    } catch (e) {
        showErrorMessage('User information not found');
        return;
    }

    if (!currentUser.department) {
        showErrorMessage('Department information not found');
        return;
    }

    // Show ONE loading modal with generic message
    showLoadingModal('Posting announcement...', 'Please wait');

    // Disable submit button
    const submitBtn = document.querySelector('.btn-primary');
    submitBtn.disabled = true;

    try {
        // Upload images to Firebase Storage (silently without updating modal)
        const imageUrls = [];
        if (selectedImages.length > 0) {
            for (let i = 0; i < selectedImages.length; i++) {
                const file = selectedImages[i];
                const timestamp = Date.now();
                const fileName = `${timestamp}_${i}_${file.name}`;
                const storageRef = storage.ref(`announcements/${currentUser.department}/images/${fileName}`);
                
                // Upload file
                await storageRef.put(file);
                
                // Get download URL
                const downloadUrl = await storageRef.getDownloadURL();
                imageUrls.push(downloadUrl);
            }
        }

        // Create date string for document ID (YYYY-MM-DD_HH-mm-ss)
        const now = new Date();
        const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

        // Create announcement object
        const announcement = {
            title: title,
            content: content,
            images: imageUrls,
            author: {
                name: currentUser.name || 'Chairperson',
                department: currentUser.department,
                idNumber: currentUser.idNumber
            },
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: now.toISOString(),
            likes: 0,
            likedBy: [],
            comments: [],
            commentCount: 0
        };

        // Save to Firebase: announcements/{department}/announcebychair/{dateofannounce}
        await db.collection('announcements')
            .doc(currentUser.department)
            .collection('announcebychair')
            .doc(dateString)
            .set(announcement);

        console.log('Announcement saved successfully to Firebase');
        
        // Hide loading modal
        hideLoadingModal();
        
        // Show success modal
        showSuccessModal('Announcement posted successfully!');
        
        // Clear form
        clearForm();
        
        // Reload announcements
        setTimeout(() => {
            loadAnnouncements();
        }, 500);

    } catch (error) {
        console.error('Error posting announcement:', error);
        hideLoadingModal();
        showErrorMessage('Failed to post announcement: ' + error.message);
    } finally {
        submitBtn.disabled = false;
    }
}

function clearForm() {
    document.getElementById('announcementTitle').value = '';
    quill.setContents([]);
    document.getElementById('announcementImages').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    selectedImages = [];
    
    // Reset upload label text and badge
    const uploadLabel = document.querySelector('.file-upload-label .upload-text strong');
    if (uploadLabel) {
        uploadLabel.textContent = 'Click to upload images';
    }
    const badge = document.getElementById('fileCountBadge');
    if (badge) {
        badge.style.display = 'none';
    }
}

async function loadAnnouncements() {
    const listContainer = document.getElementById('announcementsList');
    
    try {
        // Get current user department
        let currentUser = null;
        try {
            currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        } catch (e) {
            console.warn('No current user found');
        }

        if (!currentUser || !currentUser.department) {
            listContainer.innerHTML = `
                <div class="no-announcements">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Unable to load announcements. Please login again.</p>
                </div>
            `;
            return;
        }

        // Load from Firebase: announcements/{department}/announcebychair
        const snapshot = await db.collection('announcements')
            .doc(currentUser.department)
            .collection('announcebychair')
            .orderBy('timestamp', 'desc')
            .get();

        const announcements = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            announcements.push({
                id: doc.id,
                ...data,
                // Convert Firestore timestamp to Date
                timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : data.createdAt || new Date().toISOString()
            });
        });

        if (announcements.length === 0) {
            listContainer.innerHTML = `
                <div class="no-announcements">
                    <i class="fas fa-inbox"></i>
                    <p>No announcements yet. Create your first announcement above!</p>
                </div>
            `;
            return;
        }

        // Render announcements
        listContainer.innerHTML = announcements.map(announcement => createAnnouncementHTML(announcement)).join('');

        // Set up event listeners using event delegation
        setupAnnouncementEventListeners();

    } catch (error) {
        console.error('Error loading announcements:', error);
        listContainer.innerHTML = `
            <div class="no-announcements">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load announcements: ${error.message}</p>
            </div>
        `;
    }
}

// Setup event listeners for announcements
function setupAnnouncementEventListeners() {
    const listContainer = document.getElementById('announcementsList');
    
    // Remove existing listeners by cloning and replacing
    const newListContainer = listContainer.cloneNode(true);
    listContainer.parentNode.replaceChild(newListContainer, listContainer);
    
    // Add event delegation for delete buttons
    newListContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            const announcementId = deleteBtn.getAttribute('data-announcement-id');
            console.log('Delete button clicked, ID:', announcementId);
            if (announcementId) {
                openDeleteModal(announcementId);
            }
        }
        
        // Like buttons
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            e.preventDefault();
            const announcementId = likeBtn.getAttribute('data-announcement-id');
            console.log('Like button clicked, ID:', announcementId);
            if (announcementId) {
                toggleLike(announcementId);
            }
        }
        
        // Comment toggle buttons
        const commentBtn = e.target.closest('.comment-btn');
        if (commentBtn) {
            e.preventDefault();
            const announcementId = commentBtn.getAttribute('data-announcement-id');
            console.log('Comment button clicked, ID:', announcementId);
            if (announcementId) {
                toggleComments(announcementId);
            }
        }
        
        // Comment submit buttons
        const submitBtn = e.target.closest('.comment-submit-btn');
        if (submitBtn) {
            e.preventDefault();
            const announcementId = submitBtn.getAttribute('data-announcement-id');
            console.log('Submit comment clicked, ID:', announcementId);
            if (announcementId) {
                postComment(announcementId);
            }
        }
    });
    
    // Add event delegation for comment input enter key
    newListContainer.addEventListener('keypress', (e) => {
        const commentInput = e.target.closest('.comment-input');
        if (commentInput && e.key === 'Enter') {
            e.preventDefault();
            const announcementId = commentInput.getAttribute('data-announcement-id');
            console.log('Enter pressed in comment input, ID:', announcementId);
            if (announcementId) {
                postComment(announcementId);
            }
        }
    });
}

function createAnnouncementHTML(announcement) {
    const date = new Date(announcement.timestamp);
    const formattedDate = formatDate(date);
    const timeAgo = getTimeAgo(date);
    
    // Get current user to check if they can delete
    let currentUser = null;
    try {
        currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    } catch (e) {}

    const canDelete = currentUser && currentUser.idNumber === announcement.author.idNumber;

    // Create images HTML if there are images
    let imagesHTML = '';
    if (announcement.images && announcement.images.length > 0) {
        imagesHTML = `
            <div class="post-images">
                ${announcement.images.map(imageUrl => `
                    <img src="${imageUrl}" alt="Announcement image" class="announcement-image" onclick="openImageModal('${imageUrl}')">
                `).join('')}
            </div>
        `;
    }

    // Get comments
    const comments = announcement.comments || [];
    const commentCount = announcement.commentCount || comments.length || 0;

    return `
        <div class="announcement-post" data-announcement-id="${announcement.id}">
            <div class="post-header">
                <div class="post-author">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(announcement.author.name)}&background=4A90E2&color=fff" 
                         alt="${announcement.author.name}" 
                         class="author-avatar">
                    <div class="author-info">
                        <h3>${announcement.author.name}</h3>
                        <p>${announcement.author.department} • ${timeAgo}</p>
                    </div>
                </div>
                ${canDelete ? `
                <div class="post-actions">
                    <button class="delete-btn" title="Delete" data-announcement-id="${announcement.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ` : ''}
            </div>
            <h2 class="post-title">${announcement.title}</h2>
            <div class="post-content">
                ${announcement.content}
            </div>
            ${imagesHTML}
            <div class="post-footer">
                <button class="like-btn ${announcement.likedBy && announcement.likedBy.includes(currentUser?.idNumber) ? 'liked' : ''}" 
                        data-announcement-id="${announcement.id}">
                    <i class="fas fa-heart"></i>
                    <span>${announcement.likes || 0}</span>
                </button>
                <button class="comment-btn" data-announcement-id="${announcement.id}">
                    <i class="fas fa-comment"></i>
                    <span>${commentCount}</span>
                </button>
                <div class="post-stat">
                    <i class="far fa-clock"></i>
                    <span>${formattedDate}</span>
                </div>
            </div>
            
            <!-- Comments Section -->
            <div class="comments-section" id="comments-${announcement.id}" style="display: none;">
                <div class="comments-list" id="comments-list-${announcement.id}">
                    ${comments.length > 0 ? comments.map(comment => createCommentHTML(comment)).join('') : '<p class="no-comments">No comments yet. Be the first to comment!</p>'}
                </div>
                <div class="comment-form">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=4A90E2&color=fff" 
                         alt="You" 
                         class="comment-avatar">
                    <input type="text" 
                           id="comment-input-${announcement.id}" 
                           class="comment-input"
                           placeholder="Write a comment..." 
                           data-announcement-id="${announcement.id}">
                    <button class="comment-submit-btn" data-announcement-id="${announcement.id}">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createCommentHTML(comment) {
    const commentDate = new Date(comment.timestamp);
    const timeAgo = getTimeAgo(commentDate);
    
    return `
        <div class="comment-item">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author.name)}&background=9B9B9B&color=fff" 
                 alt="${comment.author.name}" 
                 class="comment-avatar">
            <div class="comment-content">
                <div class="comment-header">
                    <strong>${comment.author.name}</strong>
                    <span class="comment-time">${timeAgo}</span>
                </div>
                <p class="comment-text">${comment.text}</p>
            </div>
        </div>
    `;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    
    return 'Just now';
}

async function toggleLike(announcementId) {
    try {
        let currentUser = null;
        try {
            currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        } catch (e) {
            alert('Please login to like announcements');
            return;
        }

        if (!currentUser || !currentUser.department || !currentUser.idNumber) {
            alert('User information not found. Please login again.');
            return;
        }

        const announcementRef = db.collection('announcements')
            .doc(currentUser.department)
            .collection('announcebychair')
            .doc(announcementId);

        const doc = await announcementRef.get();
        if (!doc.exists) {
            alert('Announcement not found');
            return;
        }

        const data = doc.data();
        const likedBy = data.likedBy || [];
        const likes = data.likes || 0;

        if (likedBy.includes(currentUser.idNumber)) {
            // Unlike
            await announcementRef.update({
                likes: likes - 1,
                likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.idNumber)
            });
        } else {
            // Like
            await announcementRef.update({
                likes: likes + 1,
                likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.idNumber)
            });
        }

        // Reload announcements
        loadAnnouncements();

    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Failed to update like: ' + error.message);
    }
}

function openDeleteModal(announcementId) {
    console.log('Opening delete modal for announcement:', announcementId);
    console.log('Type of announcementId:', typeof announcementId);
    
    if (!announcementId || announcementId === 'undefined' || announcementId === 'null' || announcementId === '') {
        console.error('Invalid announcement ID:', announcementId);
        showErrorMessage('Cannot delete: Invalid announcement ID');
        return;
    }
    
    deleteAnnouncementId = announcementId;
    console.log('Set deleteAnnouncementId to:', deleteAnnouncementId);
    const modal = document.getElementById('deleteModal');
    modal.classList.add('show');
}

function closeDeleteModal() {
    deleteAnnouncementId = null;
    const modal = document.getElementById('deleteModal');
    modal.classList.remove('show');
}

async function confirmDelete() {
    console.log('Confirming delete for ID:', deleteAnnouncementId);
    
    if (!deleteAnnouncementId) {
        console.error('No announcement ID to delete');
        showErrorMessage('Cannot delete: No announcement selected');
        return;
    }

    // SAVE the ID before closing modal (which sets it to null)
    const announcementIdToDelete = deleteAnnouncementId;
    console.log('Saved ID to delete:', announcementIdToDelete);
    
    // Close delete confirmation modal
    closeDeleteModal();
    
    // Show loading modal with single message
    showLoadingModal('Deleting announcement...', 'Please wait');

    try {
        let currentUser = null;
        try {
            currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        } catch (e) {
            hideLoadingModal();
            showErrorMessage('User information not found');
            return;
        }

        if (!currentUser || !currentUser.department) {
            hideLoadingModal();
            showErrorMessage('Department information not found');
            return;
        }

        console.log('Deleting from path:', `announcements/${currentUser.department}/announcebychair/${announcementIdToDelete}`);

        // Get the announcement to check for images
        const announcementRef = db.collection('announcements')
            .doc(currentUser.department)
            .collection('announcebychair')
            .doc(announcementIdToDelete);

        const doc = await announcementRef.get();
        if (doc.exists) {
            const data = doc.data();
            
            // Delete associated images from Storage (silently)
            if (data.images && data.images.length > 0) {
                for (const imageUrl of data.images) {
                    try {
                        const imageRef = storage.refFromURL(imageUrl);
                        await imageRef.delete();
                        console.log('Deleted image:', imageUrl);
                    } catch (imgError) {
                        console.warn('Failed to delete image:', imageUrl, imgError);
                        // Continue even if image deletion fails
                    }
                }
            }
        }

        // Delete the announcement document
        await announcementRef.delete();
        
        // Hide loading modal
        hideLoadingModal();
        
        // Show success modal
        showSuccessModal('Announcement deleted successfully!');
        
        // Reload announcements
        setTimeout(() => {
            loadAnnouncements();
        }, 500);

    } catch (error) {
        console.error('Error deleting announcement:', error);
        hideLoadingModal();
        showErrorMessage('Failed to delete announcement: ' + error.message);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = '/officelogin/officelogin.html';
    }
}

// Open image in modal
function openImageModal(imageUrl) {
    // Create modal dynamically
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-content">
            <span class="image-modal-close" onclick="closeImageModal()">&times;</span>
            <img src="${imageUrl}" alt="Full size image">
        </div>
    `;
    document.body.appendChild(modal);
    
    // Show modal with animation
    setTimeout(() => modal.classList.add('show'), 10);
}

// Close image modal
function closeImageModal() {
    const modal = document.querySelector('.image-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

// Loading Modal Functions
function showLoadingModal(text = 'Loading...', subtext = 'Please wait') {
    const modal = document.getElementById('loadingModal');
    const textElement = document.getElementById('loadingText');
    const subtextElement = document.getElementById('loadingSubtext');
    
    if (textElement) textElement.textContent = text;
    if (subtextElement) subtextElement.textContent = subtext;
    
    if (modal) {
        modal.classList.add('show');
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
}

function updateLoadingModal(text, subtext) {
    const textElement = document.getElementById('loadingText');
    const subtextElement = document.getElementById('loadingSubtext');
    
    if (textElement) textElement.textContent = text;
    if (subtextElement) subtextElement.textContent = subtext;
}

function hideLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        modal.classList.remove('show');
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

// Success Modal Functions
function showSuccessModal(message = 'Success!') {
    const modal = document.getElementById('successModal');
    const messageElement = document.getElementById('successMessage');
    
    if (messageElement) messageElement.textContent = message;
    
    if (modal) {
        modal.classList.add('show');
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
            hideSuccessModal();
        }, 2000);
    }
}

function hideSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('show');
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

// Error message function
function showErrorMessage(message) {
    // Use a simple alert for now, or you can create a custom error modal
    alert(message);
}

// Comment Functions
function toggleComments(announcementId) {
    const commentsSection = document.getElementById(`comments-${announcementId}`);
    if (commentsSection) {
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';
            // Focus on comment input
            const input = document.getElementById(`comment-input-${announcementId}`);
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
        } else {
            commentsSection.style.display = 'none';
        }
    }
}

async function postComment(announcementId) {
    const input = document.getElementById(`comment-input-${announcementId}`);
    if (!input) return;
    
    const commentText = input.value.trim();
    if (!commentText) {
        showErrorMessage('Please enter a comment');
        return;
    }

    let currentUser = null;
    try {
        currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    } catch (e) {
        showErrorMessage('User information not found');
        return;
    }

    if (!currentUser || !currentUser.department) {
        showErrorMessage('User information not found');
        return;
    }

    try {
        // Create comment object
        const comment = {
            text: commentText,
            author: {
                name: currentUser.name || 'User',
                idNumber: currentUser.idNumber,
                department: currentUser.department
            },
            timestamp: new Date().toISOString()
        };

        // Update announcement in Firebase
        const announcementRef = db.collection('announcements')
            .doc(currentUser.department)
            .collection('announcebychair')
            .doc(announcementId);

        await announcementRef.update({
            comments: firebase.firestore.FieldValue.arrayUnion(comment),
            commentCount: firebase.firestore.FieldValue.increment(1)
        });

        // Clear input
        input.value = '';

        // Reload announcements to show new comment
        loadAnnouncements();

    } catch (error) {
        console.error('Error posting comment:', error);
        showErrorMessage('Failed to post comment: ' + error.message);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const deleteModal = document.getElementById('deleteModal');
    if (event.target === deleteModal) {
        closeDeleteModal();
    }
    
    const imageModal = document.querySelector('.image-modal');
    if (event.target === imageModal) {
        closeImageModal();
    }
    
    const successModal = document.getElementById('successModal');
    if (event.target === successModal) {
        hideSuccessModal();
    }
}
