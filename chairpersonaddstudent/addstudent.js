let chairpersonDepartment = '';
const API_BASE = (typeof window !== 'undefined' && window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';

// Function to check if student number exists
async function checkStudentNumberExists(studentNumber) {
    try {
    const response = await fetch(`${API_BASE}/api/check-student/${chairpersonDepartment}/${studentNumber}`);
        if (!response.ok) {
            throw new Error('Failed to check student number');
        }
        const data = await response.json();
        return data.exists;
    } catch (error) {
        console.error('Error checking student number:', error);
        throw error; // Propagate the error to show proper feedback
    }
}

// Function to fetch and populate sections for bulk add
async function fetchAndPopulateSections(department, schoolYear) {
    try {
        console.log(`Fetching sections for ${department} - ${schoolYear}`);
    const response = await fetch(`${API_BASE}/api/sections/${department}/${schoolYear}`);
        if (!response.ok) {
            throw new Error('Failed to fetch sections');
        }
        const sections = await response.json();
        console.log('Received sections:', sections);
        
        const sectionSelect = document.getElementById('section');
        const sectionAdviserText = document.getElementById('sectionAdviser');
        
        // Clear existing options except the first one
        while (sectionSelect.options.length > 1) {
            sectionSelect.remove(1);
        }
        
        // Sort sections by section number
        sections.sort((a, b) => {
            const [yearA, secA] = a.section.split('-').map(Number);
            const [yearB, secB] = b.section.split('-').map(Number);
            return yearA === yearB ? secA - secB : yearA - yearB;
        });
        
        // Add new options
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section.section;
            option.textContent = `${section.section} (${section.adviserName})`;
            option.dataset.adviserId = section.adviserId;
            option.dataset.adviserName = section.adviserName;
            sectionSelect.appendChild(option);
        });

        // Add change event listener to show adviser info
        sectionSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                sectionAdviserText.textContent = `Adviser: ${selectedOption.dataset.adviserName}`;
            } else {
                sectionAdviserText.textContent = '';
            }
        });
        // Update management sections dropdown to stay in sync
        try { populateManagementSections(); } catch (e) { /* ignore */ }
    } catch (error) {
        console.error('Error fetching sections:', error);
        showAlert('Failed to load sections. Please try again.', 'error');
    }
}

// Function to handle school year input formatting and validation
function setupSchoolYearInput(inputElement) {
    inputElement.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
        let formattedValue = '';

        if (value.length > 0) {
            formattedValue = value.substring(0, 4);
        }
        if (value.length > 4) {
            formattedValue += '-' + value.substring(4, 8);
        }

        e.target.value = formattedValue;
        
        // Validate year if 4 digits are entered
        if (value.length >= 4) {
            const enteredYear = parseInt(value.substring(0, 4));
            const currentYear = new Date().getFullYear();
            
            if (enteredYear < currentYear) {
                showAddStudentResultModal("Input Error", `School year cannot start before the current year (${currentYear}).`, 'error');
                e.target.value = ''; // Clear the input
                return;
            }
        }
    });

    // Prevent non-numeric input
    inputElement.addEventListener('keydown', function(e) {
        if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
            return;
        }
        if (!(e.key >= '0' && e.key <= '9')) {
            e.preventDefault();
        }
    });
}

// Keep track of validation states
const validationStates = new Map();

// Function to validate and show student number status
async function validateStudentNumber(input, feedbackElement) {
    const studentNumber = input.value.trim();
    
    // Clear the state when input is not complete
    if (studentNumber.length < 7) {
        feedbackElement.textContent = '';
        input.setCustomValidity('');
        validationStates.delete(input.id);
        return;
    }

    // Regular expression for student number format XX-XXXX
    const studentNumberRegex = /^\d{2}-\d{4}$/;
    if (!studentNumberRegex.test(studentNumber)) {
        feedbackElement.textContent = '⚠️ Invalid format. Use XX-XXXX';
        feedbackElement.style.color = 'var(--warning-color)';
        input.setCustomValidity('Invalid student number format');
        validationStates.set(input.id, false);
        return;
    }

    try {
        const exists = await checkStudentNumberExists(studentNumber);
        if (exists) {
            feedbackElement.textContent = '❌ This student number is already registered';
            feedbackElement.style.color = 'var(--danger-color)';
            input.setCustomValidity('This student number is already registered');
            validationStates.set(input.id, false);
        } else {
            feedbackElement.textContent = '✓ Student number is available';
            feedbackElement.style.color = 'var(--success-color)';
            input.setCustomValidity('');
            validationStates.set(input.id, true);
        }
    } catch (error) {
        console.error('Validation error:', error);
        feedbackElement.textContent = '⚠️ Could not verify student number';
        feedbackElement.style.color = 'var(--warning-color)';
        validationStates.delete(input.id);
    }
}

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to fetch and populate sections
async function fetchAndPopulateSections(department, schoolYear) {
    try {
        console.log(`Fetching sections for ${department} - ${schoolYear}`);
    const response = await fetch(`${API_BASE}/api/sections/${department}/${schoolYear}`);
        if (!response.ok) {
            throw new Error('Failed to fetch sections');
        }
        const sections = await response.json();
        console.log('Received sections:', sections);
        
        const sectionSelect = document.getElementById('section');
        const sectionAdviserText = document.getElementById('sectionAdviser');
        
        // Clear existing options except the first one
        while (sectionSelect.options.length > 1) {
            sectionSelect.remove(1);
        }
        
        // Sort sections by section number
        sections.sort((a, b) => {
            const [yearA, secA] = a.section.split('-').map(Number);
            const [yearB, secB] = b.section.split('-').map(Number);
            return yearA === yearB ? secA - secB : yearA - yearB;
        });
        
        // Add new options
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section.section;
            option.textContent = `${section.section} (${section.adviserName})`;
            option.dataset.adviserId = section.adviserId;
            option.dataset.adviserName = section.adviserName;
            sectionSelect.appendChild(option);
        });

        // Add change event listener to show adviser info
        sectionSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                sectionAdviserText.textContent = `Adviser: ${selectedOption.dataset.adviserName}`;
            } else {
                sectionAdviserText.textContent = '';
            }
        });
    } catch (error) {
        console.error('Error fetching sections:', error);
        showAlert('Failed to load sections. Please try again.', 'error');
    }
}

// Function to handle school year input formatting and validation
function setupSchoolYearInput(inputElement) {
    // Add input handler for auto-dash
    inputElement.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
        let formattedValue = '';

        if (value.length > 0) {
            formattedValue = value.substring(0, 4);
        }
        if (value.length > 4) {
            formattedValue += '-' + value.substring(4, 8);
        }

        e.target.value = formattedValue;
        
        // Validate year if 4 digits are entered
        if (value.length >= 4) {
            const enteredYear = parseInt(value.substring(0, 4));
            const currentYear = new Date().getFullYear();
            
            if (enteredYear < currentYear) {
                showAddStudentResultModal("Input Error", `School year cannot start before the current year (${currentYear}).`, 'error');
                e.target.value = ''; // Clear the input
                return;
            }
        }
    });

    // Prevent non-numeric input
    inputElement.addEventListener('keydown', function(e) {
        if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
            return;
        }
        if (!(e.key >= '0' && e.key <= '9')) {
            e.preventDefault();
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed");

    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Prefer sessionStorage.currentUser (new login flow), fall back to localStorage
    let idNumber = null;
    try {
        const cur = sessionStorage.getItem('currentUser');
        if (cur) {
            const obj = JSON.parse(cur);
            if (obj && obj.idNumber) {
                idNumber = obj.idNumber;
                chairpersonDepartment = obj.department || chairpersonDepartment;
                if (obj.name) {
                    const headerName = document.getElementById('header-username');
                    if (headerName) headerName.textContent = obj.name;
                    const headerAvatar = document.querySelector('.user-profile img');
                    if (headerAvatar) headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(obj.name)}&background=3f37c9&color=fff`;
                }
            }
        }
    } catch (e) { console.warn('Failed to parse sessionStorage.currentUser', e); }

    if (!idNumber) idNumber = localStorage.getItem('idNumber');
    if (!idNumber) {
        alert('No ID number found in storage. Please log in first.');
        window.location.href = '/officelogin/officelogin.html';
        return;
    }

    try {
    const response = await fetch(`${API_BASE}/api/user-info/${idNumber}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Set up school year change handler
        document.getElementById('schoolYear').addEventListener('change', function() {
            const schoolYear = this.value.trim();
            if (schoolYear.match(/^\d{4}-\d{4}$/)) {
                console.log('School year changed, fetching sections...');
                fetchAndPopulateSections(chairpersonDepartment, schoolYear);
            }
        });
        const userData = await response.json();

        if (userData.name) {
            document.getElementById('header-username').textContent = userData.name;
            const headerAvatar = document.querySelector('.user-profile img');
            if (headerAvatar) {
                headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=3f37c9&color=fff`;
            }
        }

        if (userData.department) {
            chairpersonDepartment = userData.department;
            document.getElementById('course').value = chairpersonDepartment;

            // Set up school year inputs with formatting and validation
            setupSchoolYearInput(document.getElementById('schoolYear'));
            setupSchoolYearInput(document.getElementById('bulkSchoolYear'));
        } else {
            showAlert("Could not determine chairperson's department.", "error");
        }
        // After department is known, fetch sections for the management dropdown and load management list
        try {
            await fetchSectionsForDepartment();
        } catch (e) {
            console.error('Error fetching sections for management dropdown:', e);
        }
        try {
            await fetchManagementStudents();
        } catch (e) {
            console.error('Error loading management students:', e);
        }
    } catch (error) {
        console.error("Error fetching user info:", error);
        showAlert("Failed to fetch user information.", "error");
    }
});

// Fetch students for the management panel. Optionally pass a section string.
async function fetchManagementStudents(section = 'all') {
    try {
        const listEl = document.getElementById('management-list');
        if (!listEl) return;
        listEl.innerHTML = `<div class="management-item">Loading...</div>`;

        const url = section === 'all' ? `${API_BASE}/api/students/${chairpersonDepartment}` : `${API_BASE}/api/students/${chairpersonDepartment}?section=${encodeURIComponent(section)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch students');
        const students = await response.json();
        renderManagementList(students);
    } catch (error) {
        console.error('fetchManagementStudents error:', error);
        const listEl = document.getElementById('management-list');
        if (listEl) listEl.innerHTML = `<div class="management-item">Failed to load students.</div>`;
    }
}

// Populate the management section dropdown from the main #section select.
function populateManagementSections() {
    const mainSection = document.getElementById('section');
    const mgmtSelect = document.getElementById('management-section');
    if (!mgmtSelect) return;

    // Clear existing except 'all'
    while (mgmtSelect.options.length > 1) mgmtSelect.remove(1);

    if (mainSection && mainSection.options.length > 1) {
        // Copy options from main section select
        for (let i = 1; i < mainSection.options.length; i++) {
            const opt = mainSection.options[i];
            const newOpt = document.createElement('option');
            newOpt.value = opt.value;
            newOpt.textContent = opt.textContent;
            mgmtSelect.appendChild(newOpt);
        }
    } else if (chairpersonDepartment) {
        // If main sections not loaded yet, try fetching for current schoolYear value or fetch all sections for department
        const schoolYear = document.getElementById('schoolYear') ? document.getElementById('schoolYear').value.trim() : '';
        if (schoolYear.match(/\d{4}-\d{4}/)) {
            fetchAndPopulateSections(chairpersonDepartment, schoolYear).then(() => {
                // copy after populate
                populateManagementSections();
            }).catch(err => console.warn('Failed to populate sections for management:', err));
        }
    }
}

// Wire management section change to refetch the list
const mgmtSectionEl = document.getElementById('management-section');
if (mgmtSectionEl) {
    mgmtSectionEl.addEventListener('change', function() {
        const val = this.value;
        if (val === 'all') {
            fetchManagementStudents();
        } else {
            fetchManagementStudents(val);
        }
    });
}

// Fetch sections directly from the server for the department and populate management dropdown
async function fetchSectionsForDepartment() {
    if (!chairpersonDepartment) return;
    try {
        const resp = await fetch(`${API_BASE}/api/sections/${chairpersonDepartment}`);
        if (!resp.ok) throw new Error('Failed to fetch department sections');
        const sections = await resp.json();
        const mgmtSelect = document.getElementById('management-section');
        if (!mgmtSelect) return;

        // Clear existing except 'all'
        while (mgmtSelect.options.length > 1) mgmtSelect.remove(1);

        // The server returns an array of section ids (strings). Add them as options.
        sections.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec;
            opt.textContent = sec;
            mgmtSelect.appendChild(opt);
        });
    } catch (error) {
        console.error('fetchSectionsForDepartment error:', error);
        // Fall back to copying from main #section if available
        try { populateManagementSections(); } catch (e) {}
    }
}

// Render management list into the panel
function renderManagementList(students) {
    const listEl = document.getElementById('management-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    // Filter out students who have already started OJT (protect from deletion)
    const visibleStudents = (students || []).filter(s => !(s.hteStatus === 'Approved' || s.status === 'Completed'));

    if (!visibleStudents || visibleStudents.length === 0) {
        listEl.innerHTML = `<div class="management-item">No students available for management</div>`;
        return;
    }

    visibleStudents.forEach(s => {
        const item = document.createElement('div');
    item.className = 'management-item';
    item.dataset.studentId = s.id;
    item.dataset.section = s.section || '';
    item.dataset.studentNumber = s.studentNumber || s.id;
    item.dataset.studentName = s.name || '';

        item.innerHTML = `
            <div class="meta">
                <div style="font-weight:600">${escapeHtml(s.name || s.studentNumber)}</div>
                <div style="font-size:12px;color:var(--gray-color)">${escapeHtml(s.studentNumber)} ${s.section ? '• ' + escapeHtml(s.section) : ''}</div>
            </div>
            <div class="actions">
                ${ (s.hteStatus === 'Approved' || s.status === 'Completed')
                    ? `<button class="btn btn-secondary" disabled>OJT Started</button>`
                    : `<button class="btn btn-danger" onclick="confirmDeleteStudent('${encodeURIComponent(s.id)}','${encodeURIComponent(s.section || '')}')">Delete</button>` }
            </div>
        `;
        listEl.appendChild(item);
    });
}

// Simple HTML escape
function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"]+/g, function(match) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[match]);
    });
}

// Confirm delete with native confirm (can be replaced with modal)
// Modal-based confirmation flow
function confirmDeleteStudent(studentId, section) {
    const decodedId = decodeURIComponent(studentId);
    const decodedSection = decodeURIComponent(section);
    const modal = document.getElementById('deleteConfirmModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const closeX = document.getElementById('deleteConfirmClose');
    const textEl = document.getElementById('deleteConfirmText');

    if (!modal || !confirmBtn) {
        // fallback to native confirm
        if (confirm('Are you sure you want to delete this student? This cannot be undone.')) {
            deleteStudent(decodedId, decodedSection).catch(err => console.error(err));
        }
        return;
    }

    // Set up modal (let CSS handle display via .active)
    modal.removeAttribute('style');
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    modal.dataset.studentId = decodedId;
    modal.dataset.section = decodedSection;
    // Try to get the student's displayed name/number from the dataset if possible
    const sourceEl = document.querySelector(`#management-list .management-item[data-student-id="${decodedId}"]`);
    const displayName = (sourceEl && sourceEl.dataset && (sourceEl.dataset.studentName || sourceEl.dataset.studentNumber)) ? `${sourceEl.dataset.studentName || ''} (${sourceEl.dataset.studentNumber || decodedId})` : decodedId;
    textEl.textContent = `Are you sure you want to delete ${displayName} from section ${decodedSection}? This action cannot be undone.`;

    // Ensure any previous listeners are removed by cloning
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    const newCloseX = closeX.cloneNode(true);
    closeX.parentNode.replaceChild(newCloseX, closeX);

    // Wire actions
    newCancel.addEventListener('click', () => closeDeleteModal());
    newCloseX.addEventListener('click', () => closeDeleteModal());
    newConfirm.addEventListener('click', async () => {
        // show loading state
        newConfirm.disabled = true;
        const originalHTML = newConfirm.innerHTML;
        newConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        let result = { ok: false, status: undefined, message: 'An error occurred' };
        try {
            // Run deletion silently so result modal doesn't show yet
            result = await deleteStudent(decodedId, decodedSection, { silent: true });
        } catch (err) {
            console.error('Error deleting from modal confirm:', err);
            result = { ok: false, status: err && err.status, message: (err && err.message) || 'An error occurred' };
        } finally {
            newConfirm.disabled = false;
            newConfirm.innerHTML = originalHTML;
            // Close the confirm modal before showing result
            closeDeleteModal();
            // Now show the result and refresh list if needed
            if (result.ok) {
                showDeleteResult(result.message || 'Student deleted successfully', result.status);
                try { await fetchManagementStudents(); } catch (e) { console.warn('Refresh list failed:', e); }
            } else {
                showDeleteResult(result.message || 'Failed to delete student', result.status);
            }
        }
    });
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (!modal) return;
    modal.classList.remove('active');
    // Remove inline styles so CSS display rules take effect next open
    modal.removeAttribute('style');
    document.body.classList.remove('modal-open');
    delete modal.dataset.studentId;
    delete modal.dataset.section;
}

// Delete student via API then refresh list
async function deleteStudent(studentId, section, options = {}) {
    try {
        const silent = !!options.silent;
        // Preflight: ensure the student document exists at the expected path
        try {
            const preflightUrl = `${API_BASE}/api/student-details/${chairpersonDepartment}/${encodeURIComponent(section)}/${encodeURIComponent(studentId)}`;
            console.log('Preflight GET:', preflightUrl);
            const checkResp = await fetch(preflightUrl);
            console.log('Preflight status:', checkResp.status);
            if (!checkResp.ok) {
                // read body once
                const body = await checkResp.text();
                let parsed = body;
                try { parsed = JSON.parse(body); parsed = parsed.message || JSON.stringify(parsed); } catch(e) {}
                if (!silent) showDeleteResult(`Student not found (preflight): ${parsed}`, checkResp.status);
                return { ok: false, status: checkResp.status, message: `Student not found (preflight): ${parsed}` };
            }
        } catch (e) {
            // network error on preflight — continue and let DELETE surface error
            console.warn('Preflight check failed, proceeding to DELETE:', e);
        }

        const deleteUrl = `${API_BASE}/api/students/${chairpersonDepartment}/${encodeURIComponent(section)}/${encodeURIComponent(studentId)}`;
        console.log('DELETE URL:', deleteUrl);
        const response = await fetch(deleteUrl, { method: 'DELETE' });
        console.log('DELETE status:', response.status);
        if (!response.ok) {
            // Read body once as text, then try to parse JSON from it
            const bodyText = await response.text();
            let errText = bodyText;
            try {
                const data = JSON.parse(bodyText);
                errText = (data && data.message) ? data.message : JSON.stringify(data);
            } catch (e) {
                // bodyText is not JSON; keep raw text
            }
            // If 404, try fallback POST delete endpoint
            if (response.status === 404) {
                console.warn('DELETE returned 404, attempting fallback POST delete');
                try {
                    const fallbackResp = await fetch(`${API_BASE}/api/students/delete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ department: chairpersonDepartment, section, studentId: studentId })
                    });
                    const fallbackText = await fallbackResp.text();
                    if (fallbackResp.ok) {
                        if (!silent) showDeleteResult(fallbackText || 'Student deleted successfully (fallback)', fallbackResp.status);
                        return { ok: true, status: fallbackResp.status, message: fallbackText || 'Student deleted successfully (fallback)' };
                    } else {
                        throw { message: fallbackText || 'Fallback delete failed', status: fallbackResp.status };
                    }
                } catch (fbErr) {
                    console.error('Fallback delete error:', fbErr);
                    throw { message: errText || 'Failed to delete student', status: response.status };
                }
            }
            // Surface status code in the modal
            throw { message: errText || 'Failed to delete student', status: response.status };
        }
        // Return success instead of showing result here
        return { ok: true, status: 200, message: 'Student deleted successfully' };
    } catch (error) {
        console.error('deleteStudent error:', error);
        const msg = (error && error.message) ? error.message : String(error);
        const status = (error && error.status) ? error.status : undefined;
        if (!options.silent) showDeleteResult(msg || 'An error occurred', status);
        return { ok: false, status, message: msg || 'An error occurred' };
    }
}

// Show the delete result modal (title, message)
function showDeleteResult(message, status) {
    const modal = document.getElementById('deleteResultModal');
    if (!modal) return;
    const msgEl = document.getElementById('deleteResultMessage');
    msgEl.textContent = message + (status && status !== 200 ? ` (HTTP ${status})` : '');
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    // Wire close handler (OK only)
    const okBtn = document.getElementById('deleteResultOk');
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    newOk.addEventListener('click', () => closeDeleteResult());
}

function closeDeleteResult() {
    const modal = document.getElementById('deleteResultModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.removeAttribute('style');
    document.body.classList.remove('modal-open');
}

// Filter management list based on search input
function filterManagementList() {
    const q = document.getElementById('management-search').value.toLowerCase();
    const items = document.querySelectorAll('#management-list .management-item');
    items.forEach(it => {
        const text = it.textContent.toLowerCase();
        it.style.display = text.includes(q) ? 'flex' : 'none';
    });
}

function showAlert(message, type = 'success', containerId = 'alertContainer') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertEl);
    
    // Only auto-hide if it's the main alert container and it's a success message
    if (type === 'success' && containerId === 'alertContainer') {
      setTimeout(() => {
        alertEl.style.opacity = '0';
        setTimeout(() => alertEl.remove(), 300);
      }, 5000);
    }
}

// Show the single student add result modal
function showAddStudentResultModal(title, message, type = 'success') {
    const modal = document.getElementById('addStudentResultModal');
    if (!modal) return;
    const msgEl = document.getElementById('addStudentResultMessage');
    const okBtn = document.getElementById('addStudentResultOk');

    // Plain message only (no header/icons). Preserve basic HTML if provided (e.g., batch summary with <br>).
    const msg = String(message || '');
    if (/[<][a-zA-Z!/]/.test(msg)) {
        msgEl.innerHTML = msg;
    } else {
        msgEl.textContent = msg;
    }
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Clone buttons to remove existing event listeners
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    newOkBtn.addEventListener('click', () => closeAddStudentResultModal());
}

function closeAddStudentResultModal() {
    const modal = document.getElementById('addStudentResultModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.removeAttribute('style');
    document.body.classList.remove('modal-open');

    // Check if bulkAddModal is open and close it as well
    const bulkAddModal = document.getElementById('bulkAddModal');
    if (bulkAddModal && bulkAddModal.classList.contains('active')) {
        bulkAddModal.classList.remove('active');
        // Also clear the bulk add form entries when the bulk modal is closed
        document.getElementById('studentEntriesContainer').innerHTML = '';
        studentEntryCounter = 0;
    }
}

document.getElementById('section').addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    let formattedValue = value;

    if (value.length > 1) {
        formattedValue = value.substring(0, 1) + '-' + value.substring(1);
    }

    e.target.value = formattedValue;
});

document.getElementById('birthday').addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, '');
    let formattedValue = '';

    if (value.length > 0) {
        formattedValue += value.substring(0, 2);
    }
    if (value.length > 2) {
        formattedValue += '/' + value.substring(2, 4);
    }
    if (value.length > 4) {
        formattedValue += '/' + value.substring(4, 8);
    }

    e.target.value = formattedValue;
});

// Create a debounced version of validateStudentNumber
const debouncedValidate = debounce(async (input, feedbackElement) => {
    if (input.value.length === 7) {
        await validateStudentNumber(input, feedbackElement);
    }
}, 300); // Wait 300ms after user stops typing

document.getElementById('studentNumber').addEventListener('input', async function (e) {
    let value = e.target.value.replace(/[^0-9-]/g, ''); // Allow numbers and dash
    let formattedValue = value;

    // Handle formatting
    if (!value.includes('-')) {
        if (value.length > 2) {
            formattedValue = value.substring(0, 2) + '-' + value.substring(2);
        }
    }

    e.target.value = formattedValue.substring(0, 7); // Limit to XX-XXXX format
    
    // Get or create feedback element
    let feedbackElement = document.getElementById('studentNumber-feedback');
    if (!feedbackElement) {
        feedbackElement = document.createElement('div');
        feedbackElement.id = 'studentNumber-feedback';
        feedbackElement.style.fontSize = '0.85em';
        feedbackElement.style.marginTop = '4px';
        e.target.parentNode.appendChild(feedbackElement);
    }

    // Clear feedback if incomplete
    if (formattedValue.length < 7) {
        feedbackElement.textContent = '';
        validationStates.delete(e.target.id);
    }
    
    // Use debounced validation
    debouncedValidate(e.target, feedbackElement);
});

document.getElementById('schoolYear').addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits for processing
    let currentYear = new Date().getFullYear();
    let formattedValue = '';

    // Validate against past years (only if enough digits are typed for a year)
    if (value.length >= 4) {
        const enteredStartYear = parseInt(value.substring(0, 4), 10);
        if (enteredStartYear < currentYear) {
            alert(`School year cannot start before the current year (${currentYear}).`);
            e.target.value = ''; // Clear the input
            return;
        }
    }

    if (value.length > 0) {
        formattedValue += value.substring(0, 4);
    }
    if (value.length > 4) {
        formattedValue += '-' + value.substring(4, 8);
    }

    e.target.value = formattedValue.slice(0, 9); // Enforce max length YYYY-YYYY (9 characters)
});

// Prevent non-numeric input for schoolYear
document.getElementById('schoolYear').addEventListener('keydown', function(e) {
    // Allow navigation keys, backspace, delete, tab
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        return; // Allow the default action
    }

    // Allow digits and a single dash at the correct position
    // We'll let the 'input' event handle the formatting, just prevent unwanted characters.
    // Only allow digits for now, the 'input' event will re-add the dash if needed.
    if (!(e.key >= '0' && e.key <= '9')) {
        e.preventDefault();
    }
});

document.getElementById('studentForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    
    if (!chairpersonDepartment) {
        showAddStudentResultModal("Error", "Cannot register student: Chairperson's department is unknown.", 'error');
        return;
    }

    // Get the student number input and check its validation state
    const studentNumberInput = document.getElementById('studentNumber');
    const studentNumber = studentNumberInput.value.trim();
    
    // Revalidate before submission
    const feedbackElement = document.getElementById('studentNumber-feedback');
    if (feedbackElement) {
        await validateStudentNumber(studentNumberInput, feedbackElement);
        
        // Check if the validation failed
        if (!validationStates.get(studentNumberInput.id)) {
            showAddStudentResultModal("Error", "Please correct the student number issues before submitting.", 'error');
            return;
        }
    }

    const sectionSelect = document.getElementById('section');
    const selectedOption = sectionSelect.options[sectionSelect.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
        showAddStudentResultModal("Error", "Please select a section.", 'error');
        return;
    }

    // Log the data we're about to send to help debug
    console.log('Selected section value:', selectedOption.value);
    console.log('Selected adviser ID:', selectedOption.dataset.adviserId);

    const studentData = {
        course: chairpersonDepartment,
        section: selectedOption.value.trim(), // This will only contain the section number, not the adviser name
        adviserId: selectedOption.dataset.adviserId,
        adviserName: selectedOption.dataset.adviserName, // Add the adviser name
        name: document.getElementById('name').value.trim(),
        studentNumber: document.getElementById('studentNumber').value.trim(),
        birthday: document.getElementById('birthday').value.trim(),
        schoolYear: document.getElementById('schoolYear').value.trim(),
        univEmail: document.getElementById('univEmail').value.trim()
    };
    
    // Log the complete student data
    console.log('Submitting student data:', studentData);


    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnDisabled = submitBtn.disabled;
    submitBtn.disabled = true;
    // Show global loader
    try { showLoader('Registering student...'); } catch (e) {}

    try {
    const response = await fetch(`${API_BASE}/api/students/add-single`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(studentData)
        });

        const result = await response.text();

        if (!response.ok) {
            throw new Error(result || 'Failed to add student. Please try again.');
        }

    // Hide loader first, then show a plain success message
    try { hideLoader(); } catch (e) {}
    showSuccessModal('Student added successfully!');
        document.getElementById('studentForm').reset();
        document.getElementById('course').value = chairpersonDepartment;
        // Clear the student number validation feedback
        document.getElementById('studentNumber-feedback').textContent = '';
        validationStates.delete(studentNumberInput.id);
        // Refresh the management list to show the new student
        await fetchManagementStudents(document.getElementById('management-section').value);

    } catch (error) {
        console.error("Error adding student:", error);
        try { hideLoader(); } catch (e) {}
        showAddStudentResultModal("Error", error.message, 'error');
    } finally {
        // Hide loader (if still visible)
        try { hideLoader(); } catch (e) {}
        submitBtn.disabled = originalBtnDisabled;
    }
});

const bulkAddModal = document.getElementById('bulkAddModal');
const openBulkAddModalBtn = document.getElementById('openBulkAddModalBtn');
const closeBulkAddModalBtn = document.getElementById('closeBulkAddModalBtn');
const addStudentEntryBtn = document.getElementById('addStudentEntryBtn');
const studentEntriesContainer = document.getElementById('studentEntriesContainer');
const submitBulkAddBtn = document.getElementById('submitBulkAddBtn');
const bulkSectionSelect = document.getElementById('bulkSection');

// New elements for the pre-bulk add modal
const preBulkAddModal = document.getElementById('preBulkAddModal');
const closePreBulkAddModalBtn = document.getElementById('closePreBulkAddModalBtn');
const continueToBulkAddBtn = document.getElementById('continueToBulkAddBtn');
const numStudentsInput = document.getElementById('numStudents');
const bulkSectionSelector = document.getElementById('bulkSectionSelector');

// Add event listener for adding another student entry
addStudentEntryBtn.addEventListener('click', () => {
    addNewStudentEntryForm();
});

// Add section formatting for bulkSectionSelector in pre-bulk add modal
bulkSectionSelector.addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    let formattedValue = value;

    if (value.length > 1) {
        formattedValue = value.substring(0, 1) + '-' + value.substring(1);
    }

    e.target.value = formattedValue;
});

bulkSectionSelector.addEventListener('keydown', function(e) {
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        return;
    }
    if (!(e.key >= '0' && e.key <= '9')) {
        e.preventDefault();
    }
});

// Add auto-dash for bulkSchoolYear in pre-bulk add modal
document.getElementById('bulkSchoolYear').addEventListener('input', async function(e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits for processing
    let formattedValue = '';
    let currentYear = new Date().getFullYear();

    // Validate against past years (only if enough digits are typed for a year)
    if (value.length >= 4) {
        const enteredStartYear = parseInt(value.substring(0, 4), 10);
        if (enteredStartYear < currentYear) {
            alert(`School year cannot start before the current year (${currentYear}).`);
            e.target.value = ''; // Clear the input
            return;
        }
    }

    if (value.length > 0) {
        formattedValue += value.substring(0, 4);
    }
    if (value.length > 4) {
        formattedValue += '-' + value.substring(4, 8);
    }

    e.target.value = formattedValue.slice(0, 9); // Enforce max length YYYY-YYYY (9 characters)
    
    // Fetch sections when a valid school year is entered
    if (formattedValue.match(/^\d{4}-\d{4}$/)) {
        console.log('Bulk add: School year changed, fetching sections...');
        try {
            const response = await fetch(`${API_BASE}/api/sections/${chairpersonDepartment}/${formattedValue}`);
            if (!response.ok) {
                throw new Error('Failed to fetch sections');
            }
            const sections = await response.json();
            console.log('Received sections for bulk add:', sections);
            
            const sectionSelect = document.getElementById('bulkSectionSelector');
            
            // Clear existing options except the first one
            while (sectionSelect.options.length > 0) {
                sectionSelect.remove(0);
            }
            
            // Add a default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select Section';
            sectionSelect.appendChild(defaultOption);
            
            // Sort sections by section number
            sections.sort((a, b) => {
                const [yearA, secA] = a.section.split('-').map(Number);
                const [yearB, secB] = b.section.split('-').map(Number);
                return yearA === yearB ? secA - secB : yearA - yearB;
            });
            
            // Add new options
            sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section.section;
                option.textContent = `${section.section} (${section.adviserName})`;
                option.dataset.adviserId = section.adviserId;
                option.dataset.adviserName = section.adviserName;
                sectionSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching sections:', error);
            showAlert('Failed to load sections. Please try again.', 'error', 'bulkAddAlertContainer');
        }
    }
});

let studentEntryCounter = 0;

function addNewStudentEntryForm() {
    studentEntryCounter++;
    const entryDiv = document.createElement('div');
    entryDiv.className = 'student-entry-form';
    entryDiv.id = `student_entry_${studentEntryCounter}`;
    entryDiv.innerHTML = `
      <div class="form-group">
          <label for="bulk_name_${studentEntryCounter}">Full Name</label>
          <input type="text" id="bulk_name_${studentEntryCounter}" class="form-control" placeholder="Last Name, First Name MI" required maxlength="50">
      </div>
      <div class="form-group">
          <label for="bulk_studentNumber_${studentEntryCounter}">Student Number</label>
          <input type="text" id="bulk_studentNumber_${studentEntryCounter}" class="form-control bulk-student-number" placeholder="XX-XXXX" required maxlength="7">
      </div>
      <div class="form-group">
          <label for="bulk_birthday_${studentEntryCounter}">Birthday (MM/DD/YYYY)</label>
          <input type="text" id="bulk_birthday_${studentEntryCounter}" class="form-control bulk-birthday" placeholder="MM/DD/YYYY" required maxlength="10">
      </div>
      <div class="form-group">
          <label for="bulk_univEmail_${studentEntryCounter}">University Email</label>
          <input type="email" id="bulk_univEmail_${studentEntryCounter}" class="form-control bulk-univ-email" placeholder="Enter student's university email" required>
      </div>
      ${studentEntryCounter > 1 ? `<button type="button" class="remove-entry-button" data-entry-id="student_entry_${studentEntryCounter}"><i class="fas fa-times-circle"></i> Remove</button>` : ''}
    `;
    studentEntriesContainer.appendChild(entryDiv);

    // Add student number validation
    const studentNumberInput = entryDiv.querySelector(`#bulk_studentNumber_${studentEntryCounter}`);
    const feedbackDiv = document.createElement('div');
    feedbackDiv.id = `bulk_studentNumber_feedback_${studentEntryCounter}`;
    feedbackDiv.style.fontSize = '0.85em';
    feedbackDiv.style.marginTop = '4px';
    studentNumberInput.parentNode.appendChild(feedbackDiv);

    studentNumberInput.addEventListener('input', async function(e) {
        let value = e.target.value.replace(/\D/g, '');
        let formattedValue = value;

        if (value.length > 2) {
            formattedValue = value.substring(0, 2) + '-' + value.substring(2);
        }

        e.target.value = formattedValue;
        await validateStudentNumber(e.target, feedbackDiv);
    });

    // Add birthday auto-formatting
    const birthdayInput = entryDiv.querySelector(`#bulk_birthday_${studentEntryCounter}`);
    birthdayInput.addEventListener('input', function (e) {
        let value = e.target.value.replace(/\D/g, '');
        let formattedValue = '';

        if (value.length > 0) {
            formattedValue += value.substring(0, 2);
        }
        if (value.length > 2) {
            formattedValue += '/' + value.substring(2, 4);
        }
        if (value.length > 4) {
            formattedValue += '/' + value.substring(4, 8);
        }

        e.target.value = formattedValue;
    });

    const removeBtn = entryDiv.querySelector('.remove-entry-button');
    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
          const entryIdToRemove = this.dataset.entryId;
          const entryDivToRemove = document.getElementById(entryIdToRemove);
          if (entryDivToRemove) {
              entryDivToRemove.remove();
          }
      });
    }

    // Add section formatting for dynamically added fields
    const bulkSectionInput = entryDiv.querySelector(`#bulk_section_${studentEntryCounter}`);
    if (bulkSectionInput) {
        bulkSectionInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
            let formattedValue = value;

            if (value.length > 1) {
                formattedValue = value.substring(0, 1) + '-' + value.substring(1);
            }

            e.target.value = formattedValue;
        });

        // Prevent non-numeric input for dynamically added section fields
        bulkSectionInput.addEventListener('keydown', function(e) {
            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                return;
            }
            if (!(e.key >= '0' && e.key <= '9')) {
                e.preventDefault();
            }
        });
    }

    // Add student number formatting for dynamically added fields
    const bulkStudentNumberInput = entryDiv.querySelector(`#bulk_studentNumber_${studentEntryCounter}`);
    if (bulkStudentNumberInput) {
        bulkStudentNumberInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
            let formattedValue = value;

            if (value.length > 2) {
                formattedValue = value.substring(0, 2) + '-' + value.substring(2);
            }

            e.target.value = formattedValue;
        });

        // Prevent non-numeric input for dynamically added studentNumber fields
        bulkStudentNumberInput.addEventListener('keydown', function(e) {
            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                return;
            }
            if (!(e.key >= '0' && e.key <= '9')) {
                e.preventDefault();
            }
        });
    }

    // Add school year validation for dynamically added fields
    const bulkSchoolYearInput = entryDiv.querySelector(`#bulk_schoolYear_${studentEntryCounter}`);
    if (bulkSchoolYearInput) {
        bulkSchoolYearInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits for processing
            let currentYear = new Date().getFullYear();
            let formattedValue = '';

            // Validate against past years
            if (value.length >= 4) {
                const enteredStartYear = parseInt(value.substring(0, 4), 10);
                if (enteredStartYear < currentYear) {
                    alert(`School year cannot start before the current year (${currentYear}).`);
                    e.target.value = ''; // Clear the input
                    return;
                }
            }

            if (value.length > 0) {
                formattedValue += value.substring(0, 4);
            }
            if (value.length > 4) {
                formattedValue += '-' + value.substring(4, 8);
            }

            e.target.value = formattedValue.slice(0, 9); // Enforce max length YYYY-YYYY (9 characters)
        });

        // Prevent non-numeric input for dynamically added schoolYear fields
        bulkSchoolYearInput.addEventListener('keydown', function(e) {
            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                return;
            }
            if (!(e.key >= '0' && e.key <= '9')) {
                e.preventDefault();
            }
        });
    }
}

openBulkAddModalBtn.addEventListener('click', () => {
    preBulkAddModal.classList.add('active');
    document.body.classList.add('modal-open');
    numStudentsInput.value = '1';
    // Ensure the bulkSchoolYear and bulkSectionSelector are cleared or reset
    document.getElementById('bulkSchoolYear').value = '';
    bulkSectionSelector.innerHTML = '<option value="">Select a section</option>'; // Reset sections
    document.getElementById('bulkSectionAdviser').textContent = ''; // Clear adviser text
});

closePreBulkAddModalBtn.addEventListener('click', () => {
    preBulkAddModal.classList.remove('active');
    document.body.classList.remove('modal-open');
});

continueToBulkAddBtn.addEventListener('click', () => {
    const numStudents = parseInt(numStudentsInput.value, 10);
    const selectedSection = document.getElementById('bulkSectionSelector').value.trim();
    const schoolYear = document.getElementById('bulkSchoolYear').value.trim();
    let currentYear = new Date().getFullYear();

    if (!selectedSection) {
        showAddStudentResultModal("Input Error", 'Please select a section.', 'error');
        return;
    }

    if (!schoolYear) {
        showAddStudentResultModal("Input Error", 'Please enter a school year.', 'error');
        return;
    }

    const enteredStartYear = parseInt(schoolYear.substring(0, 4), 10);
    if (isNaN(enteredStartYear) || enteredStartYear < currentYear) {
        showAddStudentResultModal("Input Error", `School year cannot start before the current year (${currentYear}).`, 'error');
        return;
    }

    if (isNaN(numStudents) || numStudents < 1) {
        showAddStudentResultModal("Input Error", 'Please enter a valid number of students.', 'error');
        return;
    }

    preBulkAddModal.classList.remove('active');
    bulkAddModal.classList.add('active');
    
    studentEntriesContainer.innerHTML = '';
    studentEntryCounter = 0;
    
    for (let i = 0; i < numStudents; i++) {
        addNewStudentEntryForm();
    }
    
    // Populate adviser info for bulk add main modal
    const bulkSectionAdviserText = document.getElementById('bulkSectionAdviser');
    const selectedOption = bulkSectionSelector.options[bulkSectionSelector.selectedIndex];
    if (selectedOption && selectedOption.dataset.adviserName) {
        bulkSectionAdviserText.textContent = `Adviser: ${selectedOption.dataset.adviserName}`;
    } else {
        bulkSectionAdviserText.textContent = '';
    }
});

// Prevent non-numeric input for bulkSchoolYear in pre-bulk add modal
document.getElementById('bulkSchoolYear').addEventListener('keydown', function(e) {
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        return;
    }
    if (!(e.key >= '0' && e.key <= '9')) {
        e.preventDefault();
    }
});

const closeModal = () => {
    bulkAddModal.classList.remove('active');
    preBulkAddModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    studentEntriesContainer.innerHTML = ''; 
    studentEntryCounter = 0;
};

closeBulkAddModalBtn.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    if (event.target == bulkAddModal || event.target == preBulkAddModal) {
      closeModal();
    }
});

submitBulkAddBtn.addEventListener('click', async () => {
    // Revalidate all student numbers before submission
    const studentEntries = document.querySelectorAll('.student-entry-form');
    let hasErrors = false;

    for (const entry of studentEntries) {
        const studentNumberInput = entry.querySelector('input[id^="bulk_studentNumber_"]');
        const feedbackElement = entry.querySelector(`#${studentNumberInput.id}_feedback`);
        
        if (studentNumberInput && feedbackElement) {
            await validateStudentNumber(studentNumberInput, feedbackElement);
            
            // Check if this entry has a validation error
            if (!validationStates.get(studentNumberInput.id)) {
                hasErrors = true;
            }
        }
    }

    if (hasErrors) {
        showAlert("Please correct the student number issues before submitting.", 'error', 'bulkAddAlertContainer');
        return;
    }
    const sectionSelect = document.getElementById('bulkSectionSelector');
    if (!sectionSelect) {
        showAlert('Section selector not found.', 'error', 'bulkAddAlertContainer');
        return;
    }
    const selectedSection = sectionSelect.value;
    const selectedOption = sectionSelect.options[sectionSelect.selectedIndex];

    // Get the school year from the first modal
    const schoolYear = document.getElementById('bulkSchoolYear').value.trim();
    
    if (!selectedSection) {
        showAlert('Please select a section for this batch.', 'error', 'bulkAddAlertContainer');
        return;
    }

    if (!schoolYear) {
        showAlert('Please enter a school year for this batch.', 'error', 'bulkAddAlertContainer');
        return;
    }

    const studentForms = studentEntriesContainer.getElementsByClassName('student-entry-form');
    let students = [];
    for (let i = 0; i < studentForms.length; i++) {
        const form = studentForms[i];
        const name = form.querySelector(`input[id^="bulk_name_"]`).value.trim();
        const studentNumber = form.querySelector(`input[id^="bulk_studentNumber_"]`).value.trim();
        const birthday = form.querySelector(`input[id^="bulk_birthday_"]`).value.trim();
        const univEmail = form.querySelector(`input[id^="bulk_univEmail_"]`).value.trim(); // Add this line
        if (name && studentNumber && birthday && univEmail) {
            students.push({ 
                name, 
                studentNumber, 
                birthday, 
                schoolYear, 
                univEmail,
                adviserId: selectedOption.dataset.adviserId,
                adviserName: selectedOption.dataset.adviserName
            });
        }
    }

    if (students.length === 0) {
        showAlert('Please add at least one valid student.', 'error', 'bulkAddAlertContainer');
        return;
    }

    const originalSubmitBtnText = submitBulkAddBtn.innerHTML;
    submitBulkAddBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBulkAddBtn.disabled = true;
    try { showLoader('Registering batch...'); } catch (e) {}

    try {
    const response = await fetch(`${API_BASE}/api/students/add-bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                students, 
                department: chairpersonDepartment, 
                section: selectedSection,
                adviserId: selectedOption.dataset.adviserId,
                adviserName: selectedOption.dataset.adviserName,
                schoolYear 
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        let finalMessage = `Batch processing complete.<br>Successfully registered: ${result.successCount}.<br>Failed: ${result.failureCount}.`;
        if (result.errorMessages.length > 0) {
          finalMessage += "<br><br><strong>Error Details:</strong><br>" + result.errorMessages.join("<br>");
        }
        
        if (result.failureCount > 0) {
            showAddStudentResultModal("Batch Registration Result", finalMessage, 'error');
        } else {
            try { hideLoader(); } catch (e) {}
            showSuccessModal('Students added successfully!');
        }

        // Refresh the management list after successful bulk add
        await fetchManagementStudents(document.getElementById('management-section').value);

    } catch (error) {
        console.error("Error adding students in bulk:", error);
        showAddStudentResultModal("Error", "An unexpected error occurred during bulk add.", 'error');
    } finally {
        submitBulkAddBtn.innerHTML = originalSubmitBtnText;
        submitBulkAddBtn.disabled = false;
        try { hideLoader(); } catch (e) {}
    }
});

// ============ Enhanced UX helpers (Loader + Success Modal) ============
function showLoader(text = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    const textEl = overlay.querySelector('.loading-text');
    if (textEl) textEl.textContent = text;
    overlay.style.display = 'flex';
    overlay.classList.add('active');
    document.body.classList.add('modal-open');
}

function hideLoader() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.style.display = 'none';
    // Keep modal-open if any modal is still open
    const anyActiveModal = document.querySelector('.modal.active');
    if (!anyActiveModal) {
        document.body.classList.remove('modal-open');
    }
}

function showSuccessModal(message = 'Operation completed successfully.') {
    const modal = document.getElementById('successModal');
    if (!modal) return;
    const msgEl = document.getElementById('successMessage');
    if (msgEl) msgEl.textContent = message;
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Re-wire buttons to avoid stacking listeners
    const okBtn = document.getElementById('successOk');
    if (okBtn) {
        const newOk = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);
        newOk.addEventListener('click', closeSuccessModal);
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
    // Maintain modal-open if others are active
    const anyActiveModal = document.querySelector('.modal.active');
    if (!anyActiveModal) {
        document.body.classList.remove('modal-open');
    }
}

// Enhance close to also clear bulk modal content if open
const __origCloseSuccessModal = closeSuccessModal;
closeSuccessModal = function() {
    __origCloseSuccessModal();
    const bulkModal = document.getElementById('bulkAddModal');
    if (bulkModal && bulkModal.classList.contains('active')) {
        bulkModal.classList.remove('active');
        const entries = document.getElementById('studentEntriesContainer');
        if (entries) entries.innerHTML = '';
        try { studentEntryCounter = 0; } catch (e) {}
    }
}