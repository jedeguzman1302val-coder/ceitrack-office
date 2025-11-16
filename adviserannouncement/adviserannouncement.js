document.addEventListener('DOMContentLoaded', () => {
    // 1. Kunin ang user data DIREKTA mula sa sessionStorage
    const currentUserJSON = sessionStorage.getItem('currentUser');
    const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;

    const API_BASE = (window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';
    const FIREBASE_DB_URL = (typeof window !== 'undefined' && window.FIREBASE_DB_URL) ? window.FIREBASE_DB_URL : null;

    // Global variables para sa adviser's scope
    let adviserId, adviserName, adviserDepartment, adviserSection;

    if (!currentUser || !currentUser.idNumber) {
        console.error('Adviser data not found in sessionStorage. Some features might not work.');
        const adviserNameEl = document.getElementById('adviser-name');
        if (adviserNameEl) adviserNameEl.textContent = 'Unknown User';
        return; // Itigil ang proseso kung walang user data
    }

    // Itakda ang global variables gamit ang data mula sa sessionStorage
    adviserId = currentUser.idNumber;
    adviserName = currentUser.name || 'Adviser';
    adviserDepartment = currentUser.department || '';
    adviserSection = currentUser.section || '';

    // 2. I-display AGAD ang header info (WALA NANG SEPARATE FETCH)
    function displayHeaderInfo() {
        const adviserNameEl = document.getElementById('adviser-name');
        const adviserAvatarEl = document.getElementById('adviser-avatar');
        const metaEl = document.getElementById('adviser-meta');

        if (adviserNameEl) adviserNameEl.textContent = adviserName;
        if (adviserAvatarEl) adviserAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adviserName)}&background=4361ee&color=fff`;
        if (metaEl) {
            if (adviserDepartment && adviserSection) {
                metaEl.textContent = `${adviserDepartment} • ${adviserSection}`;
            } else {
                metaEl.textContent = adviserDepartment || adviserSection || '';
            }
        }
    }

    // Announcement fetching + rendering
    function ensureAnnouncementsContainer() {
        let container = document.querySelector('.announcement-list-container');
        if (container) {
            let inner = container.querySelector('#announcements-list');
            if (!inner) {
                inner = document.createElement('div');
                inner.id = 'announcements-list';
                container.appendChild(inner);
            }
            const placeholder = container.querySelector('.announcement-placeholder');
            if (placeholder) placeholder.remove();
            return inner;
        }
        let fallback = document.getElementById('announcements-list');
        if (!fallback) {
            fallback = document.createElement('div');
            fallback.id = 'announcements-list';
            const main = document.querySelector('main') || document.body;
            main.appendChild(fallback);
        }
        return fallback;
    }

    function formatDateString(createdAt) {
        try {
            const d = new Date(createdAt);
            if (isNaN(d.getTime())) return createdAt;
            const datePart = new Intl.DateTimeFormat('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            }).format(d);
            const timePart = new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(d);
            return `${datePart} ${timePart}`;
        } catch (e) {
            return createdAt;
        }
    }

    function renderAnnouncements(items) {
        const container = ensureAnnouncementsContainer();
        container.innerHTML = '';
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="no-announcements">No announcements found.</p>';
            return;
        }
        items.sort((a, b) => {
            const da = new Date(a.createdAt);
            const db = new Date(b.createdAt);
            if (isNaN(da) || isNaN(db)) return 0;
            return db - da;
        });
        
        items.forEach(item => {
            const card = document.createElement('article');
            card.className = 'announcement-card';
            card.setAttribute('data-announcement-id', item.id || '');
            
            // Header with author info
            const header = document.createElement('header');
            header.className = 'announcement-card-header';
            
            const headerLeft = document.createElement('div');
            headerLeft.className = 'announcement-card-header-left';
            
            const avatar = document.createElement('img');
            avatar.className = 'announcement-author-avatar';
            avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adviserName)}&background=4361ee&color=fff`;
            avatar.alt = adviserName;
            
            const authorInfo = document.createElement('div');
            authorInfo.className = 'announcement-author-info';
            
            const authorName = document.createElement('div');
            authorName.className = 'announcement-author-name';
            authorName.textContent = adviserName;
            
            const date = document.createElement('time');
            date.className = 'announcement-date';
            date.textContent = formatDateString(item.createdAt || item.date || '');
            
            authorInfo.appendChild(authorName);
            authorInfo.appendChild(date);
            headerLeft.appendChild(avatar);
            headerLeft.appendChild(authorInfo);
            
            // Action buttons (Edit/Delete)
            const actions = document.createElement('div');
            actions.className = 'announcement-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-edit';
            editBtn.innerHTML = '<i class="fas fa-edit"></i><span class="sr-only">Edit</span>';
            editBtn.setAttribute('aria-label', 'Edit announcement');
            editBtn.addEventListener('click', () => openEditModal(item));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i><span class="sr-only">Delete</span>';
            deleteBtn.setAttribute('aria-label', 'Delete announcement');
            deleteBtn.addEventListener('click', () => confirmAndDelete(item));
            
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            
            header.appendChild(headerLeft);
            header.appendChild(actions);
            
            // Title
            const title = document.createElement('h3');
            title.className = 'announcement-title';
            title.textContent = item.title || 'Untitled';
            
            // Body with content
            const body = document.createElement('div');
            body.className = 'announcement-body';
            
            const textContainer = document.createElement('div');
            textContainer.className = 'announcement-text';
            textContainer.innerHTML = item.content || '';
            
            body.appendChild(textContainer);
            
            // Images section (if any)
            const images = item.images || [];
            if (images.length > 0) {
                const imagesContainer = document.createElement('div');
                imagesContainer.className = `announcement-images count-${Math.min(images.length, 5)}`;
                if (images.length > 5) imagesContainer.className = 'announcement-images count-more';
                
                images.slice(0, 6).forEach((imgUrl, idx) => {
                    const img = document.createElement('img');
                    img.className = 'announcement-image';
                    img.src = imgUrl;
                    img.alt = `Image ${idx + 1}`;
                    img.addEventListener('click', () => openImageViewer(imgUrl));
                    imagesContainer.appendChild(img);
                });
                
                body.appendChild(imagesContainer);
            }
            
            // Stats (likes count)
            const stats = document.createElement('div');
            stats.className = 'announcement-stats';
            
            const likesCount = document.createElement('div');
            likesCount.className = 'likes-count';
            const likeCount = item.likes ? Object.keys(item.likes).length : 0;
            likesCount.innerHTML = `<i class="fas fa-heart"></i> <span>${likeCount} ${likeCount === 1 ? 'like' : 'likes'}</span>`;
            
            const commentsCount = document.createElement('div');
            commentsCount.className = 'comments-count';
            const commentCount = item.comments ? Object.keys(item.comments).length : 0;
            commentsCount.textContent = `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`;
            commentsCount.addEventListener('click', () => toggleComments(card));
            
            stats.appendChild(likesCount);
            stats.appendChild(commentsCount);
            
            // Interactions (Like/Comment buttons)
            const interactions = document.createElement('div');
            interactions.className = 'announcement-interactions';
            
            const likeBtn = document.createElement('button');
            likeBtn.className = 'interaction-btn';
            const userLiked = item.likes && item.likes[adviserId];
            if (userLiked) likeBtn.classList.add('liked');
            likeBtn.innerHTML = `<i class="fa${userLiked ? 's' : 'r'} fa-heart"></i> Like`;
            likeBtn.addEventListener('click', () => toggleLike(item, card));
            
            const commentBtn = document.createElement('button');
            commentBtn.className = 'interaction-btn';
            commentBtn.innerHTML = '<i class="far fa-comment"></i> Comment';
            commentBtn.addEventListener('click', () => toggleComments(card));
            
            interactions.appendChild(likeBtn);
            interactions.appendChild(commentBtn);
            
            // Comments section
            const commentsSection = document.createElement('div');
            commentsSection.className = 'announcement-comments';
            commentsSection.style.display = 'none';
            renderComments(commentsSection, item.comments || {});
            
            // Comment input
            const commentInput = document.createElement('div');
            commentInput.className = 'comment-input-wrapper';
            commentInput.style.display = 'none';
            commentInput.innerHTML = `
                <img class="comment-input-avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(adviserName)}&background=4361ee&color=fff" alt="${adviserName}">
                <div class="comment-input-container">
                    <input type="text" class="comment-input" placeholder="Write a comment..." data-announcement-id="${item.id || ''}">
                    <button class="comment-submit-btn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            `;
            
            // Add event listeners for comment input
            const commentInputField = commentInput.querySelector('.comment-input');
            const commentSubmitBtn = commentInput.querySelector('.comment-submit-btn');
            
            commentInputField.addEventListener('input', (e) => {
                commentSubmitBtn.disabled = !e.target.value.trim();
            });
            
            commentInputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !commentSubmitBtn.disabled) {
                    submitComment(item, commentInputField.value, card);
                }
            });
            
            commentSubmitBtn.addEventListener('click', () => {
                if (!commentSubmitBtn.disabled) {
                    submitComment(item, commentInputField.value, card);
                }
            });
            
            // Assemble card
            card.appendChild(header);
            card.appendChild(title);
            card.appendChild(body);
            card.appendChild(stats);
            card.appendChild(interactions);
            card.appendChild(commentsSection);
            card.appendChild(commentInput);
            
            container.appendChild(card);
        });
    }
    
    function renderComments(container, comments) {
        container.innerHTML = '';
        const commentArray = Object.entries(comments || {}).map(([id, data]) => ({id, ...data}));
        
        if (commentArray.length === 0) {
            container.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
            return;
        }
        
        commentArray.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        
        commentArray.forEach(comment => {
            const commentItem = document.createElement('div');
            commentItem.className = 'comment-item';
            
            const isOwner = currentUser && comment.authorId === currentUser.idNumber;
            
            commentItem.innerHTML = `
                <img class="comment-avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName || 'User')}&background=random" alt="${comment.authorName}">
                <div class="comment-content">
                    <div class="comment-header">
                        <div class="comment-author">${comment.authorName || 'Unknown'}</div>
                        ${isOwner ? `
                            <div class="comment-actions">
                                <button class="comment-action-btn edit-comment-btn" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="comment-action-btn delete-comment-btn" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="comment-text" data-comment-id="${comment.id}">${escapeHtml(comment.text || '')}</div>
                    <div class="comment-time">${formatDateString(comment.createdAt || '')}${comment.editedAt ? ' (edited)' : ''}</div>
                </div>
            `;
            
            if (isOwner) {
                const editBtn = commentItem.querySelector('.edit-comment-btn');
                const deleteBtn = commentItem.querySelector('.delete-comment-btn');
                
                editBtn.addEventListener('click', () => editComment(commentItem, comment.id, comment.text));
                deleteBtn.addEventListener('click', () => deleteComment(commentItem, comment.id));
            }
            
            container.appendChild(commentItem);
        });
    }
    
    function toggleComments(card) {
        const commentsSection = card.querySelector('.announcement-comments');
        const commentInput = card.querySelector('.comment-input-wrapper');
        
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';
            commentInput.style.display = 'flex';
            commentInput.querySelector('.comment-input').focus();
        } else {
            commentsSection.style.display = 'none';
            commentInput.style.display = 'none';
        }
    }
    
    function editComment(commentItem, commentId, currentText) {
        const commentTextEl = commentItem.querySelector('.comment-text');
        const commentTimeEl = commentItem.querySelector('.comment-time');
        const commentActionsEl = commentItem.querySelector('.comment-actions');
        const originalText = currentText;
        
        // Create edit textarea
        const editTextarea = document.createElement('textarea');
        editTextarea.className = 'edit-comment-textarea';
        editTextarea.value = originalText;
        editTextarea.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 60px; font-family: inherit; margin-top: 8px;';
        
        // Create action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'edit-comment-actions';
        actionsDiv.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';
        actionsDiv.innerHTML = `
            <button class="save-edit-btn" style="padding: 6px 16px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Save</button>
            <button class="cancel-edit-btn" style="padding: 6px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
        `;
        
        // Hide original text and actions
        commentTextEl.style.display = 'none';
        if (commentActionsEl) commentActionsEl.style.display = 'none';
        
        // Insert edit UI
        commentTextEl.after(editTextarea);
        editTextarea.after(actionsDiv);
        editTextarea.focus();
        
        // Cancel handler
        actionsDiv.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            editTextarea.remove();
            actionsDiv.remove();
            commentTextEl.style.display = 'block';
            if (commentActionsEl) commentActionsEl.style.display = 'flex';
        });
        
        // Save handler
        actionsDiv.querySelector('.save-edit-btn').addEventListener('click', async () => {
            const newText = editTextarea.value.trim();
            if (!newText) {
                alert('Comment cannot be empty');
                return;
            }
            
            if (newText === originalText) {
                // No changes, just cancel
                editTextarea.remove();
                actionsDiv.remove();
                commentTextEl.style.display = 'block';
                if (commentActionsEl) commentActionsEl.style.display = 'flex';
                return;
            }
            
            try {
                const dept = adviserDepartment;
                const section = adviserSection;
                
                const announcementRef = db.collection('announcements')
                    .doc(dept)
                    .collection('announcementbyadviser')
                    .doc(section);
                
                await announcementRef.update({
                    [`comments.${commentId}.text`]: newText,
                    [`comments.${commentId}.editedAt`]: new Date().toISOString()
                });
                
                // Update UI
                commentTextEl.textContent = newText;
                commentTextEl.style.display = 'block';
                if (commentActionsEl) commentActionsEl.style.display = 'flex';
                editTextarea.remove();
                actionsDiv.remove();
                
                // Update timestamp to show edited
                const timeText = commentTimeEl.textContent;
                if (!timeText.includes('(edited)')) {
                    commentTimeEl.textContent = timeText.replace(/\)$/, '') + ' (edited)';
                    if (!timeText.includes('(edited)') && !timeText.includes(')')) {
                        commentTimeEl.textContent = timeText + ' (edited)';
                    }
                }
            } catch (error) {
                console.error('Error updating comment:', error);
                alert('Failed to update comment. Please try again.');
            }
        });
    }
    
    async function deleteComment(commentItem, commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) {
            return;
        }
        
        try {
            const dept = adviserDepartment;
            const section = adviserSection;
            
            const announcementRef = db.collection('announcements')
                .doc(dept)
                .collection('announcementbyadviser')
                .doc(section);
            
            await announcementRef.update({
                [`comments.${commentId}`]: firebase.firestore.FieldValue.delete()
            });
            
            // Remove from UI
            commentItem.style.transition = 'opacity 0.3s, transform 0.3s';
            commentItem.style.opacity = '0';
            commentItem.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                commentItem.remove();
                
                // Check if no comments left
                const commentsContainer = commentItem.parentElement;
                if (commentsContainer && commentsContainer.children.length === 0) {
                    commentsContainer.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
                }
            }, 300);
        } catch (error) {
            console.error('Error deleting comment:', error);
            alert('Failed to delete comment. Please try again.');
        }
    }
    
    async function toggleLike(item, card) {
        const likeBtn = card.querySelector('.interaction-btn:has(i.fa-heart)');
        if (!likeBtn) return;
        
        const isLiked = likeBtn.classList.contains('liked');
        
        try {
            const dept = adviserDepartment || item.department;
            const section = adviserSection || item.section;
            
            if (!dept || !section) {
                console.error('Missing department or section');
                return;
            }
            
            // Firebase path: announcements/{department}/announcementbyadviser/{section}
            const announcementRef = db.collection('announcements')
                .doc(dept)
                .collection('announcementbyadviser')
                .doc(section);
            
            if (isLiked) {
                // Unlike
                await announcementRef.update({
                    [`likes.${adviserId}`]: firebase.firestore.FieldValue.delete()
                });
            } else {
                // Like
                await announcementRef.update({
                    [`likes.${adviserId}`]: true
                });
            }
            
            // Refresh to show updated likes
            await fetchAnnouncements();
        } catch (error) {
            console.error('Error toggling like:', error);
            alert('Failed to update like. Please try again.');
        }
    }
    
    async function submitComment(item, commentText, card) {
        if (!commentText.trim()) return;
        
        const commentInput = card.querySelector('.comment-input');
        const submitBtn = card.querySelector('.comment-submit-btn');
        
        if (!commentInput || !submitBtn) return;
        
        commentInput.disabled = true;
        submitBtn.disabled = true;
        
        try {
            const dept = adviserDepartment || item.department;
            const section = adviserSection || item.section;
            
            if (!dept || !section) {
                console.error('Missing department or section');
                return;
            }
            
            // Firebase path: announcements/{department}/announcementbyadviser/{section}
            const announcementRef = db.collection('announcements')
                .doc(dept)
                .collection('announcementbyadviser')
                .doc(section);
            
            // Generate a unique comment ID
            const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Add comment to Firebase
            await announcementRef.update({
                [`comments.${commentId}`]: {
                    authorId: adviserId,
                    authorName: adviserName,
                    text: commentText.trim(),
                    createdAt: new Date().toISOString()
                }
            });
            
            commentInput.value = '';
            await fetchAnnouncements();
        } catch (error) {
            console.error('Error submitting comment:', error);
            alert('Failed to post comment. Please try again.');
        } finally {
            commentInput.disabled = false;
            submitBtn.disabled = false;
        }
    }
    
    function openImageViewer(imageUrl) {
        const viewer = document.createElement('div');
        viewer.className = 'image-viewer-modal';
        viewer.innerHTML = `
            <div class="image-viewer-backdrop"></div>
            <div class="image-viewer-content">
                <button class="image-viewer-close">&times;</button>
                <img src="${imageUrl}" alt="Full size image">
            </div>
        `;
        
        viewer.addEventListener('click', (e) => {
            if (e.target.classList.contains('image-viewer-backdrop') || e.target.classList.contains('image-viewer-close')) {
                viewer.remove();
            }
        });
        
        document.body.appendChild(viewer);
    }

    async function fetchAnnouncements() {
        const dept = adviserDepartment;
        const section = adviserSection;
        
        if (!dept || !section) {
            console.warn('Department or section not set');
            renderAnnouncements([]);
            return [];
        }
        
        try {
            // Use Firestore to fetch announcements
            const announcementRef = db.collection('announcements')
                .doc(dept)
                .collection('announcementbyadviser')
                .doc(section);
            
            const doc = await announcementRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                // The announcement data is stored directly in the document
                const announcement = {
                    id: doc.id,
                    department: dept,
                    section: section,
                    ...data
                };
                renderAnnouncements([announcement]);
                return [announcement];
            } else {
                // No announcement found
                renderAnnouncements([]);
                return [];
            }
        } catch (err) {
            console.error('Failed to fetch announcements from Firebase:', err);
            renderAnnouncements([]);
            return [];
        }
    }

    // Modal and Rich Text Editor (RTE) Logic
    const createBtn = document.querySelector('.create-announcement-btn');
    const modal = document.getElementById('create-announcement-modal');
    const modalCloseTriggers = modal ? modal.querySelectorAll('[data-close-modal]') : [];
    const saveBtn = document.getElementById('save-announcement');
    const cancelBtn = document.getElementById('cancel-announcement');
    const titleInput = document.getElementById('announcement-title');
    const rte = document.getElementById('announcement-content');
    const toolbar = document.querySelector('.rte-toolbar');
    let savedRange = null;

    function openModal() {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => titleInput.focus(), 50);
    }

    function closeModal() {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        titleInput.value = '';
        if (rte) rte.innerHTML = '';
    }

    if (createBtn) createBtn.addEventListener('click', openModal);
    modalCloseTriggers.forEach(el => el.addEventListener('click', closeModal));
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    function saveSelection() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            if (r && rte.contains(r.commonAncestorContainer)) {
                savedRange = r.cloneRange();
            } else {
                const range = document.createRange();
                range.selectNodeContents(rte);
                range.collapse(false);
                savedRange = range;
                sel.removeAllRanges();
                sel.addRange(savedRange);
            }
        } else {
            const range = document.createRange();
            range.selectNodeContents(rte);
            range.collapse(false);
            savedRange = range;
            const s2 = window.getSelection();
            s2.removeAllRanges();
            s2.addRange(savedRange);
        }
    }

    function restoreSelection() {
        const sel = window.getSelection();
        sel.removeAllRanges();
        if (savedRange) sel.addRange(savedRange);
    }

    if (toolbar && rte) {
        toolbar.addEventListener('mousedown', (ev) => {
            const btn = ev.target.closest('button');
            if (!btn) return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) {
                saveSelection();
                return;
            }
            const r = sel.getRangeAt(0);
            if (r.collapsed && rte.contains(r.commonAncestorContainer)) {
                const marker = document.createElement('span');
                marker.className = 'rte-marker';
                r.insertNode(marker);
                const after = document.createRange();
                after.setStartAfter(marker);
                after.collapse(true);
                sel.removeAllRanges();
                sel.addRange(after);
                savedRange = after.cloneRange();
            } else {
                saveSelection();
            }
        });
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const cmd = btn.getAttribute('data-cmd');
            if (!cmd) return;
            if (cmd === 'createLink') {
                openModalById('link-modal');
            } else if (cmd === 'insertImage') {
                openModalById('image-modal');
            } else {
                document.execCommand(cmd, false, null);
            }
        });
    }

    function isNodeInsideRte(node) {
        if (!node) return false;
        return rte.contains(node.nodeType === Node.TEXT_NODE ? node.parentNode : node);
    }

    function ensureSavedRangeInRte() {
        if (!savedRange || !isNodeInsideRte(savedRange.startContainer)) {
            const range = document.createRange();
            range.selectNodeContents(rte);
            range.collapse(false);
            savedRange = range;
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    }

    function escapeHtml(str) {
        return (str + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function openModalById(id) {
        const m = document.getElementById(id);
        if (!m) return;
        m.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
            const firstInput = m.querySelector('input[type="text"], input[type="file"]');
            if (firstInput) firstInput.focus();
        }, 50);
    }

    function closeModalById(id) {
        const m = document.getElementById(id);
        if (!m) return;
        m.setAttribute('aria-hidden', 'true');
        const inputs = m.querySelectorAll('input');
        inputs.forEach(i => {
            i.value = '';
        });
    }

    document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', (evt) => {
        let parent = el.closest('.modal');
        if (parent) parent.setAttribute('aria-hidden', 'true');
    }));

    const linkModal = document.getElementById('link-modal');
    const insertLinkBtn = document.getElementById('insert-link-btn');
    if (insertLinkBtn && linkModal) {
        insertLinkBtn.addEventListener('click', () => {
            const urlInput = document.getElementById('link-url');
            const textInput = document.getElementById('link-text');
            const url = urlInput ? urlInput.value.trim() : '';
            const text = textInput ? textInput.value.trim() : '';
            if (!url) {
                alert('URL is required');
                urlInput.focus();
                return;
            }
            restoreSelection();
            ensureSavedRangeInRte();
            rte.focus();
            const sel = window.getSelection();
            const selectedText = sel ? sel.toString().trim() : '';
            if (selectedText) {
                document.execCommand('createLink', false, url);
            } else {
                const display = text || url;
                const html = `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(display)}</a>`;
                restoreSelection();
                ensureSavedRangeInRte();
                const range = savedRange.cloneRange();
                range.deleteContents();
                const frag = range.createContextualFragment(html);
                const lastNode = frag.lastChild;
                range.insertNode(frag);
                const afterRange = document.createRange();
                afterRange.setStartAfter(lastNode || range.startContainer);
                afterRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(afterRange);
            }
            closeModalById('link-modal');
            savedRange = null;
        });
    }

    function isNodeInsideTag(node, tagNames) {
        if (!node) return false;
        let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        while (el && el !== rte && el !== document.body) {
            if (!el.tagName) break;
            if (tagNames.includes(el.tagName.toLowerCase())) return true;
            el = el.parentElement;
        }
        return false;
    }

    function updateToolbarState() {
        if (!toolbar || !rte) return;
        const states = {
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            insertUnorderedList: document.queryCommandState('insertUnorderedList'),
            insertOrderedList: document.queryCommandState('insertOrderedList')
        };
        const sel = window.getSelection();
        let focusNode = sel && sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
        states.insertUnorderedList = isNodeInsideTag(focusNode, ['ul']);
        states.insertOrderedList = isNodeInsideTag(focusNode, ['ol']);
        toolbar.querySelectorAll('button').forEach(btn => {
            const cmd = btn.getAttribute('data-cmd');
            if (!cmd) return;
            const isActive = !!states[cmd];
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });
    }

    document.addEventListener('selectionchange', () => setTimeout(updateToolbarState, 0));
    rte.addEventListener('keyup', updateToolbarState);
    rte.addEventListener('mouseup', updateToolbarState);
    rte.addEventListener('input', updateToolbarState);
    rte.addEventListener('paste', () => setTimeout(updateToolbarState, 0));

    try {
        const mo = new MutationObserver(() => setTimeout(updateToolbarState, 0));
        mo.observe(rte, {
            childList: true,
            subtree: true,
            characterData: true
        });
    } catch (e) {
        setInterval(updateToolbarState, 1000);
    }

    const imageModal = document.getElementById('image-modal');
    const insertImageBtn = document.getElementById('insert-image-btn');
    const imageUrlInput = document.getElementById('image-url');
    const imageFileInput = document.getElementById('image-file');
    const imagePreviewWrap = document.getElementById('image-preview');
    const imageCountLabel = document.getElementById('image-count');

    if (insertImageBtn && imageModal) {
        insertImageBtn.addEventListener('click', async () => {
            const rawUrls = imageUrlInput ? imageUrlInput.value.trim() : '';
            const files = imageFileInput && imageFileInput.files ? Array.from(imageFileInput.files) : [];
            const urls = rawUrls ? rawUrls.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
            if (files.length === 0 && urls.length === 0) {
                alert('Please provide one or more image URLs or choose one or more files.');
                return;
            }
            try {
                const uploadedUrls = [];
                for (const file of files) {
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    try {
                        const upl = await fetch(`${API_BASE}/api/upload-image`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                dataUri: dataUrl
                            })
                        });
                        if (!upl.ok) throw new Error(await upl.text().catch(() => 'Upload failed'));
                        const json = await upl.json();
                        if (json && json.url) uploadedUrls.push(json.url);
                    } catch (uploadErr) {
                        console.error('Upload failed for file', file.name, uploadErr);
                        alert('One or more image uploads failed. Check console for details.');
                    }
                }
                const srcs = [...uploadedUrls, ...urls];
                for (const src of srcs) {
                    restoreSelection();
                    ensureSavedRangeInRte();
                    const imgHtml = `<img class="rte-img" src="${escapeHtml(src)}" alt=""/>`;
                    const range = savedRange.cloneRange();
                    range.deleteContents();
                    const frag = range.createContextualFragment(imgHtml);
                    const lastInserted = frag.lastChild;
                    range.insertNode(frag);
                    if (lastInserted) {
                        const afterRange = document.createRange();
                        afterRange.setStartAfter(lastInserted);
                        afterRange.collapse(true);
                        const s = window.getSelection();
                        s.removeAllRanges();
                        s.addRange(afterRange);
                        savedRange = afterRange.cloneRange();
                    }
                }
                closeModalById('image-modal');
                savedRange = null;
            } catch (err) {
                console.error('Failed to insert/upload images', err);
                alert('Failed to insert or upload images. Check console for details.');
            }
        });
    }

    function updateImagePreview() {
        if (!imagePreviewWrap) return;
        const files = imageFileInput && imageFileInput.files ? Array.from(imageFileInput.files) : [];
        const rawUrls = imageUrlInput ? imageUrlInput.value.trim() : '';
        const urls = rawUrls ? rawUrls.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
        const total = files.length + urls.length;
        imagePreviewWrap.innerHTML = '';
        if (total === 0) return;
        const labelText = (total > 1) ? `+${total - 1}` : '';

        function appendPreviewImg(src) {
            const wrapper = document.createElement('div');
            const img = document.createElement('img');
            img.className = 'preview-img';
            img.src = src;
            wrapper.appendChild(img);
            if (labelText) {
                const lbl = document.createElement('div');
                lbl.className = 'preview-count-label';
                lbl.textContent = labelText;
                wrapper.appendChild(lbl);
            }
            imagePreviewWrap.appendChild(wrapper);
        }
        if (files.length) {
            const reader = new FileReader();
            reader.onload = () => appendPreviewImg(reader.result);
            reader.readAsDataURL(files[0]);
        } else if (urls.length) {
            appendPreviewImg(urls[0]);
        }
    }

    if (imageFileInput) imageFileInput.addEventListener('change', updateImagePreview);
    if (imageUrlInput) imageUrlInput.addEventListener('input', updateImagePreview);

    // Handle image preview
    const announcementImagesInput = document.getElementById('announcement-images');
    const imagePreviewGrid = document.getElementById('image-preview-grid');
    let selectedImageFiles = [];
    
    if (announcementImagesInput) {
        announcementImagesInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            selectedImageFiles = [...selectedImageFiles, ...files];
            updateImagePreviewGrid();
        });
    }
    
    function updateImagePreviewGrid() {
        if (!imagePreviewGrid) return;
        imagePreviewGrid.innerHTML = '';
        
        selectedImageFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-image-item';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${index + 1}">
                    <button type="button" class="preview-image-remove" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                
                previewItem.querySelector('.preview-image-remove').addEventListener('click', () => {
                    selectedImageFiles.splice(index, 1);
                    updateImagePreviewGrid();
                });
                
                imagePreviewGrid.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const title = titleInput.value.trim();
            const content = rte ? rte.innerHTML.trim() : '';
            if (!title) {
                alert('Title is required');
                titleInput.focus();
                return;
            }
            setButtonLoading(saveBtn, true, 'Saving...');
            try {
                // Upload images to Firebase Storage
                const imageUrls = [];
                for (const file of selectedImageFiles) {
                    try {
                        const storageRef = storage.ref();
                        const imageRef = storageRef.child(`announcements/${adviserDepartment}/${adviserSection}/${Date.now()}_${file.name}`);
                        const snapshot = await imageRef.put(file);
                        const downloadUrl = await snapshot.ref.getDownloadURL();
                        imageUrls.push(downloadUrl);
                    } catch (uploadErr) {
                        console.error('Image upload failed:', uploadErr);
                    }
                }
                
                // Save to Firebase Firestore
                const announcementRef = db.collection('announcements')
                    .doc(adviserDepartment)
                    .collection('announcementbyadviser')
                    .doc(adviserSection);
                
                const announcementData = {
                    title,
                    content,
                    images: imageUrls,
                    department: adviserDepartment,
                    section: adviserSection,
                    adviserId: adviserId,
                    adviserName: adviserName,
                    createdBy: adviserId,
                    createdAt: new Date().toISOString(),
                    likes: {},
                    comments: {}
                };
                
                await announcementRef.set(announcementData, { merge: false });
                
                // Reset form
                selectedImageFiles = [];
                if (announcementImagesInput) announcementImagesInput.value = '';
                updateImagePreviewGrid();
                
                closeModal();
                await fetchAnnouncements();
                showSuccessModal('Announcement created');
            } catch (err) {
                console.error('Error saving announcement', err);
                alert('Failed to save announcement. Check console for details.');
            } finally {
                setButtonLoading(saveBtn, false);
            }
        });
    }

    function openEditModal(item) {
        if (!modal) return;
        titleInput.value = item.title || '';
        if (rte) rte.innerHTML = item.content || '';
        modal.setAttribute('data-editing-id', item.id || '');
        openModal();
        attachEditSaveHandler(item);
    }

    function attachEditSaveHandler(item) {
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        newSave.addEventListener('click', async () => {
            const title = titleInput.value.trim();
            const content = rte ? rte.innerHTML.trim() : '';
            if (!title) {
                alert('Title is required');
                titleInput.focus();
                return;
            }
            setButtonLoading(newSave, true, 'Updating...');
            try {
                const dept = adviserDepartment || (item.department || '');
                const section = adviserSection || (item.section || '');
                if (!dept || !section) {
                    alert('Missing department/section. Cannot update.');
                    return;
                }
                
                // Update in Firebase Firestore
                const announcementRef = db.collection('announcements')
                    .doc(dept)
                    .collection('announcementbyadviser')
                    .doc(section);
                
                await announcementRef.update({
                    title,
                    content,
                    updatedAt: new Date().toISOString()
                });
                
                closeModal();
                await fetchAnnouncements();
                showSuccessModal('Announcement updated');
            } catch (err) {
                console.error('Failed to update announcement', err);
                alert('Failed to update announcement. See console for details.');
            } finally {
                setButtonLoading(newSave, false);
            }
        });
    }

    function ensureDeleteModal() {
        let modal = document.getElementById('delete-confirm-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'delete-confirm-modal';
        modal.className = 'modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-dialog" role="dialog" aria-modal="true">
                <div class="modal-header"><h3>Confirm delete</h3><button class="modal-close" data-close-modal>&times;</button></div>
                <div class="modal-body"><p>Are you sure you want to delete this announcement? This action cannot be undone.</p></div>
                <div class="modal-footer">
                    <button class="btn-secondary" data-close-modal>Cancel</button>
                    <button id="confirm-delete-btn" class="btn-primary">Delete</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => modal.setAttribute('aria-hidden', 'true')));
        return modal;
    }

    function openDeleteModal(item) {
        const modal = ensureDeleteModal();
        modal.setAttribute('aria-hidden', 'false');
        const confirmBtn = modal.querySelector('#confirm-delete-btn');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', async () => {
            setButtonLoading(newBtn, true, 'Deleting...');
            try {
                const dept = adviserDepartment || (item.department || '');
                const section = adviserSection || (item.section || '');
                if (!dept || !section) {
                    alert('Missing department/section. Cannot delete.');
                    return;
                }
                
                // Delete from Firebase Firestore
                const announcementRef = db.collection('announcements')
                    .doc(dept)
                    .collection('announcementbyadviser')
                    .doc(section);
                
                await announcementRef.delete();
                
                modal.setAttribute('aria-hidden', 'true');
                await fetchAnnouncements();
                showSuccessModal('Announcement deleted');
            } catch (err) {
                console.error('Failed to delete announcement', err);
                alert('Failed to delete announcement. See console for details.');
            } finally {
                setButtonLoading(newBtn, false);
            }
        });
    }

    function ensureSuccessModal() {
        let modal = document.getElementById('success-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'success-modal';
        modal.className = 'modal success-modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-dialog" role="dialog" aria-modal="true">
                <div class="modal-body">
                    <div class="success-icon">✓</div>
                    <div id="success-message"></div>
                </div>
                <div class="modal-footer"><button class="btn-primary" data-close-modal>OK</button></div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => modal.setAttribute('aria-hidden', 'true')));
        return modal;
    }

    function showSuccessModal(message) {
        const modal = ensureSuccessModal();
        modal.querySelector('#success-message').textContent = message || '';
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => modal.setAttribute('aria-hidden', 'true'), 1700);
    }

    function ensureErrorModal() {
        let modal = document.getElementById('error-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'error-modal';
        modal.className = 'modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-dialog" role="dialog" aria-modal="true">
                <div class="modal-header"><h3>Error</h3><button class="modal-close" data-close-modal>&times;</button></div>
                <div class="modal-body"><div id="error-message" style="color:#b91c1c"></div></div>
                <div class="modal-footer"><button class="btn-primary" data-close-modal>OK</button></div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => modal.setAttribute('aria-hidden', 'true')));
        return modal;
    }

    function showErrorModal(message) {
        const modal = ensureErrorModal();
        modal.querySelector('#error-message').textContent = message || '';
        modal.setAttribute('aria-hidden', 'false');
    }

    function setButtonLoading(btn, isLoading, label) {
        if (!btn) return;
        try {
            if (isLoading) {
                if (!btn.dataset.originalContent) btn.dataset.originalContent = btn.innerHTML;
                btn.disabled = true;
                btn.classList.add('btn-spinner');
                btn.innerHTML = `<span class="spinner-text">${escapeHtml(label || 'Saving...')}</span>`;
            } else {
                if (btn.dataset.originalContent) {
                    btn.innerHTML = btn.dataset.originalContent;
                    delete btn.dataset.originalContent;
                }
                btn.disabled = false;
                btn.classList.remove('btn-spinner');
            }
        } catch (e) {
            btn.disabled = isLoading;
            if (!isLoading) btn.classList.remove('btn-spinner');
        }
    }

    async function replaceDataUrisWithUploads(html) {
        if (!html || typeof html !== 'string') return html;
        const container = document.createElement('div');
        container.innerHTML = html;
        const imgs = Array.from(container.querySelectorAll('img'));
        for (const img of imgs) {
            const src = img.src || '';
            if (src.startsWith('data:image/')) {
                try {
                    const res = await fetch(`${API_BASE}/api/upload-image`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            dataUri: src
                        })
                    });
                    if (!res.ok) {
                        console.error('Upload returned non-ok', res.status);
                        continue;
                    }
                    const json = await res.json();
                    if (json && json.url) {
                        img.src = json.url;
                    }
                } catch (err) {
                    console.error('Failed to upload inline image', err);
                }
            }
        }
        return container.innerHTML;
    }

    async function confirmAndDelete(item) {
        openDeleteModal(item);
    }

    // Sidebar toggle behavior
    const sidebarToggleBtn = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.setAttribute('aria-expanded', sidebar.classList.contains('active'));
        sidebarToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            const expanded = sidebar.classList.contains('active');
            sidebarToggleBtn.setAttribute('aria-expanded', expanded);
            document.body.classList.toggle('sidebar-open', expanded && window.innerWidth <= 768);
        });
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
                const clickedInsideSidebar = sidebar.contains(e.target) || sidebarToggleBtn.contains(e.target);
                if (!clickedInsideSidebar) {
                    sidebar.classList.remove('active');
                    sidebarToggleBtn.setAttribute('aria-expanded', 'false');
                    document.body.classList.remove('sidebar-open');
                }
            }
        });
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

    // Initialize page
    displayHeaderInfo();
    fetchAnnouncements();
});