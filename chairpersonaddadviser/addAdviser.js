function showAlert(message, type = 'success', containerId = 'alertContainer') {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertEl);
    
    if (type === 'success' && containerId === 'alertContainer') {
      setTimeout(() => {
        alertEl.style.opacity = '0';
        setTimeout(() => alertEl.remove(), 300);
      }, 5000);
    }
}

let chairpersonDepartment = null; // Declare a global variable to store the department

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed");
    const API_BASE = (window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';

    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Prefer sessionStorage.currentUser (set by login) then fallback to localStorage
    let idNumber = null;
    try {
        const cur = sessionStorage.getItem('currentUser');
        if (cur) {
            const obj = JSON.parse(cur);
            if (obj && obj.idNumber) {
                idNumber = obj.idNumber;
                if (obj.name) {
                    const headerName = document.getElementById('header-username');
                    if (headerName) headerName.textContent = obj.name;
                }
                if (obj.department) {
                    localStorage.setItem('department', obj.department);
                    chairpersonDepartment = obj.department;
                }
            }
        }
    } catch (e) {
        console.warn('Failed parsing sessionStorage.currentUser', e);
    }

    if (!idNumber) idNumber = localStorage.getItem('idNumber');
    console.log("Using idNumber:", idNumber);

    if (!idNumber) {
        alert("No ID number found in storage. Please log in first.");
        window.location.href = '/officelogin/officelogin.html';
        return;
    }

    try {
    console.log(`Fetching user info for idNumber: ${idNumber}`);
    const response = await fetch(`${API_BASE}/api/user-info/${idNumber}`);
        console.log("User info response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server responded with an error:", errorText);
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const userData = await response.json();
        console.log("Received user data:", userData);

        if (userData.name) {
            document.getElementById('header-username').textContent = userData.name;
            const headerAvatar = document.querySelector('.user-profile img');
            if(headerAvatar){
                headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=3f37c9&color=fff`;
            }
        }

        if (userData.department) {
            console.log(`Department found: ${userData.department}.`);
            document.getElementById("chairdepartment").textContent = userData.department;
            document.getElementById("adviserDepartment").value = userData.department;
            chairpersonDepartment = userData.department; // Assign to global variable
        } else {
            alert("Could not determine chairperson's department from user data.");
        }
    } catch (error) {
        console.error("Error fetching user info:", error);
       
    }

    // Initial load of advisers
    await loadAdvisers(chairpersonDepartment);

});

const API_BASE = (window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';
const adviserManagementList = document.getElementById('adviserManagementList');
const adviserSearch = document.getElementById('adviserSearch');

const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmClose = document.getElementById('deleteConfirmClose');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const deleteConfirmText = document.getElementById('deleteConfirmText');

const deleteResultModal = document.getElementById('deleteResultModal');
const deleteResultOk = document.getElementById('deleteResultOk');
const deleteResultMessage = document.getElementById('deleteResultMessage');

const addAdviserResultModal = document.getElementById('addAdviserResultModal');
const addAdviserResultOk = document.getElementById('addAdviserResultOk');
const addAdviserResultMessage = document.getElementById('addAdviserResultMessage');

let adviserToDeleteId = null;
let adviserToDeleteName = null;

// Generic modal open/close functions
function openModal(modalElement) {
    modalElement.style.display = 'flex';
    modalElement.classList.add('active'); // Add this line
    document.body.classList.add('modal-open');
}

function closeModal(modalElement) {
    modalElement.style.display = 'none';
    modalElement.classList.remove('active'); // Add this line
    document.body.classList.remove('modal-open');
}

function showResultModal(modalElement, _titleId, messageId, _title, message, _type = 'success') {
    // Plain message-only modal: ignore title and type
    const msgEl = document.getElementById(messageId);
    if (!msgEl) return;
    // Allow simple HTML like <br> for multiline messages
    if (/[<][a-zA-Z!/]/.test(String(message))) {
        msgEl.innerHTML = message;
    } else {
        msgEl.textContent = message;
    }
    // Hide conflict-only action if present (should only show on conflict)
    try {
        if (modalElement && modalElement.id === 'addAdviserResultModal') {
            const conflictBtn = modalElement.querySelector('#addAdviserChangeSectionBtn');
            if (conflictBtn) conflictBtn.style.display = 'none';
        }
    } catch (_) {}
    openModal(modalElement);
}

// Event listeners for modals
deleteConfirmClose.addEventListener('click', () => closeModal(deleteConfirmModal));
cancelDeleteBtn.addEventListener('click', () => closeModal(deleteConfirmModal));
deleteResultOk.addEventListener('click', () => closeModal(deleteResultModal));
addAdviserResultOk.addEventListener('click', () => closeModal(addAdviserResultModal));

window.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) {
        closeModal(deleteConfirmModal);
    }
    if (e.target === deleteResultModal) closeModal(deleteResultModal);
    if (e.target === addAdviserResultModal) closeModal(addAdviserResultModal);
});

// Global loader helpers
function showLoader(text = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    const txt = overlay.querySelector('.loading-text');
    if (txt) txt.textContent = text;
    overlay.style.display = 'flex';
    overlay.classList.add('active');
    document.body.classList.add('modal-open');
}

function hideLoader() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.style.display = 'none';
    // keep scroll lock if any modal still active
    const anyActive = document.querySelector('.modal.active');
    if (!anyActive) document.body.classList.remove('modal-open');
}

async function loadAdvisers(department, searchTerm = '') {
    try {
        if (!department) {
            console.error("Department is required to load advisers.");
            showAlert("Cannot load advisers: Department not found.", 'error', 'adviserListAlertContainer');
            return;
        }
        let url = `${API_BASE}/api/advisers/${department}`;
        if (searchTerm) {
            url += `?search=${encodeURIComponent(searchTerm)}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const advisers = await response.json();
        displayAdvisers(advisers);
    } catch (error) {
        console.error("Error fetching advisers:", error);
        showAlert("Failed to load advisers.", 'error', 'adviserListAlertContainer');
    }
}

function displayAdvisers(advisers) {
    adviserManagementList.innerHTML = ''; // Clear existing list
    if (advisers.length === 0) {
        adviserManagementList.innerHTML = '<div class="management-item">No advisers found.</div>';
        return;
    }

    advisers.forEach(adviser => {
        const adviserItem = document.createElement('div');
        adviserItem.className = 'management-item';
        adviserItem.innerHTML = `
            <div class="info">
                <span class="name">${adviser.name}</span>
                <span class="details">${adviser.idNumber} &bull; ${adviser.section}</span>
            </div>
            <div class="actions">
                <button class="btn btn-danger btn-sm delete-adviser-btn" data-id="${adviser.idNumber}" data-name="${adviser.name}"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>
        `;
        adviserManagementList.appendChild(adviserItem);
    });
    addAdviserEventListeners();
}

function addAdviserEventListeners() {
    document.querySelectorAll('.delete-adviser-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            // Store the button clicked, so we can manage its loading state later
            const clickedButton = e.currentTarget; // Use currentTarget to get the button itself
            adviserToDeleteId = clickedButton.dataset.id;
            adviserToDeleteName = clickedButton.dataset.name || null;

            // Store the button in the modal dataset or a global variable if needed
            deleteConfirmModal.dataset.deleteButtonId = clickedButton.id; // Assign a unique ID if not present
            if (!clickedButton.id) {
                clickedButton.id = `delete-btn-${adviserToDeleteId}`; // Assign unique ID
            }

            openModal(deleteConfirmModal);
            // Update confirm text to include both name and id
            if (deleteConfirmText) {
                const who = adviserToDeleteName ? `${adviserToDeleteName} (${adviserToDeleteId})` : adviserToDeleteId;
                deleteConfirmText.textContent = `Are you sure you want to delete adviser ${who}? This action cannot be undone.`;
            }
        });
    });
}

adviserSearch.addEventListener('input', () => {
    loadAdvisers(chairpersonDepartment, adviserSearch.value);
});

// Modify confirmDeleteBtn listener to pass department
confirmDeleteBtn.addEventListener('click', async () => {
    const originalConfirmBtnText = confirmDeleteBtn.innerHTML;
    confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    confirmDeleteBtn.disabled = true;

    const originalDeleteButtonId = deleteConfirmModal.dataset.deleteButtonId;
    const originalDeleteButton = originalDeleteButtonId ? document.getElementById(originalDeleteButtonId) : null;
    if (originalDeleteButton) {
        originalDeleteButton.disabled = true;
        originalDeleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    // Keep confirm modal open while deleting; then close and show result
    let resultMsg = '';
    let ok = false;
    try {
        const res = await deleteAdviser(adviserToDeleteId, chairpersonDepartment, { silent: true });
        ok = !!(res && res.ok);
        // Compose a user-friendly message that includes both ID and name
        const who = adviserToDeleteName ? `${adviserToDeleteName} (${adviserToDeleteId})` : adviserToDeleteId;
        if (ok) {
            resultMsg = `Adviser ${who} deleted successfully.`;
        } else {
            const serverMsg = (res && res.message) ? ` ${res.message}` : '';
            resultMsg = `Failed to delete adviser ${who}.${serverMsg}`;
        }
    } catch (err) {
        ok = false;
        const who = adviserToDeleteName ? `${adviserToDeleteName} (${adviserToDeleteId})` : adviserToDeleteId;
        const errMsg = (err && err.message) ? ` ${err.message}` : '';
        resultMsg = `Failed to delete adviser ${who}.${errMsg}`;
    }

    // Restore confirm button
    confirmDeleteBtn.innerHTML = originalConfirmBtnText;
    confirmDeleteBtn.disabled = false;
    // Close confirm
    closeModal(deleteConfirmModal);
    adviserToDeleteId = null;
    adviserToDeleteName = null;

    // Restore original row delete button
    if (originalDeleteButton) {
        originalDeleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
        originalDeleteButton.disabled = false;
    }

    // Show result and refresh list on success
    showResultModal(deleteResultModal, null, 'deleteResultMessage', null, resultMsg || (ok ? 'Adviser deleted successfully' : 'Failed to delete adviser'), ok ? 'success' : 'error');
    if (ok) {
        try { await loadAdvisers(chairpersonDepartment); } catch (e) { console.warn('Failed to refresh advisers:', e); }
    }
});

async function deleteAdviser(idNumber, department, options = {}) {
    try {
        if (!department) {
            throw new Error("Department is required for deleting an adviser.");
        }
        const response = await fetch(`${API_BASE}/api/advisers/delete/${department}/${idNumber}`, {
            method: 'DELETE',
        });

        const result = await response.text();

        if (!response.ok) {
            throw new Error(result);
        }
        if (!options.silent) {
            showResultModal(deleteResultModal, null, 'deleteResultMessage', null, result, 'success');
        }
        return { ok: true, message: result };
    } catch (error) {
        console.error("Error deleting adviser:", error);
        if (!options.silent) {
            showResultModal(deleteResultModal, null, 'deleteResultMessage', null, error.message, 'error');
        }
        return { ok: false, message: error.message };
    }
}

// Input formatting and validation for add adviser form
document.getElementById('adviserSection').addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    let formattedValue = value;

    if (value.length > 1) {
        formattedValue = value.substring(0, 1) + '-' + value.substring(1);
    }

    e.target.value = formattedValue;
});

document.getElementById('adviserSection').addEventListener('keydown', function(e) {
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        return;
    }
    if (!(e.key >= '0' && e.key <= '9')) {
        e.preventDefault();
    }
});

document.getElementById('adviserIdNumber').addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, '');
    let formattedValue = value;

    if (value.length > 2) {
        formattedValue = value.substring(0, 2) + '-' + value.substring(2);
    }

    e.target.value = formattedValue.slice(0, 7);
});

document.getElementById('adviserIdNumber').addEventListener('keydown', function(e) {
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        return;
    }
    if (!(e.key >= '0' && e.key <= '9')) {
        e.preventDefault();
    }
});

document.getElementById('adviserBirthday').addEventListener('input', function (e) {
    let digits = e.target.value.replace(/\D/g, '');
    let formattedValue = '';

    if (digits.length > 0) {
        formattedValue += digits.substring(0, Math.min(2, digits.length));
    }
    if (digits.length > 2) {
        formattedValue += '/' + digits.substring(2, Math.min(4, digits.length));
    }
    if (digits.length > 4) {
        formattedValue += '/' + digits.substring(4, Math.min(8, digits.length));
    }

    e.target.value = formattedValue;
});

document.getElementById('adviserBirthday').addEventListener('keydown', function(e) {
    const input = e.target;
    const value = input.value;
    const cursorPosition = input.selectionStart;

    if (['ArrowLeft', 'ArrowRight', 'Tab', 'Delete'].includes(e.key)) {
        return;
    }

    if (e.key === 'Backspace') {
        if (cursorPosition > 0) {
            let newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
            if (value[cursorPosition - 1] === '/' && cursorPosition > 1) {
                newValue = newValue.slice(0, cursorPosition - 2) + newValue.slice(cursorPosition - 1);
                input.value = newValue;
                input.setSelectionRange(cursorPosition - 2, cursorPosition - 2);
                e.preventDefault();
                return;
            }
            input.value = newValue;
            input.setSelectionRange(cursorPosition - 1, cursorPosition - 1);
            e.preventDefault();
            return;
        }
    }

    if (!(e.key >= '0' && e.key <= '9')) {
        e.preventDefault();
    }
});

document.getElementById('adviserSchoolYear').addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, '');
    let currentYear = new Date().getFullYear();
    let formattedValue = '';

    if (value.length >= 4) {
        const enteredStartYear = parseInt(value.substring(0, 4), 10);
        if (enteredStartYear < currentYear) {
            alert(`School year cannot start before the current year (${currentYear}).`);
            e.target.value = '';
            return;
        }
    }

    if (value.length > 0) {
        formattedValue += value.substring(0, 4);
    }
    if (value.length > 4) {
        formattedValue += '-' + value.substring(4, 8);
    }

    e.target.value = formattedValue.slice(0, 9);
});

document.getElementById('adviserSchoolYear').addEventListener('keydown', function(e) {
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        return;
    }
    if (!(e.key >= '0' && e.key <= '9')) {
        e.preventDefault();
    }
});

// Original add adviser form submission logic
document.getElementById('adviserForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const adviserData = {
        idNumber: document.getElementById('adviserIdNumber').value.trim(),
        name: document.getElementById('adviserName').value.trim(),
        department: document.getElementById('adviserDepartment').value.trim(),
        section: document.getElementById('adviserSection').value.trim(),
        birthday: document.getElementById('adviserBirthday').value.trim(),
        univEmail: document.getElementById('adviserUnivEmail').value.trim(),
        password: document.getElementById('adviserBirthday').value.trim(), // Birthday as initial password
        schoolYear: document.getElementById('adviserSchoolYear').value.trim(),
    };

    // Additional validation for section format
    const sectionPattern = /^\d-\d$/;
    if (!sectionPattern.test(adviserData.section)) {
        showAlert("Section must be in format 'Year-Section' (e.g., 3-1).", 'error');
        return;
    }

    // Additional validation for school year format
    const schoolYearPattern = /^\d{4}-\d{4}$/;
    if (!schoolYearPattern.test(adviserData.schoolYear)) {
        showAlert("School year must be in format 'YYYY-YYYY' (e.g., 2025-2026).", 'error');
        return;
    }

    if (!adviserData.idNumber || !adviserData.name || !adviserData.department || !adviserData.section || !adviserData.birthday || !adviserData.univEmail) {
        showAlert("Please fill in all fields.", 'error');
        return;
    }

    if (!adviserData.univEmail.includes("@")) {
        showAlert("Please enter a valid university email address.", 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    try { showLoader('Registering adviser...'); } catch (_) {}

    try {
        const response = await fetch(`${API_BASE}/api/advisers/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adviserData)
        });

        const result = await response.text();

        // Detect conflict messages even if backend returns 200
        const isConflictMsg = /already assigned/i.test(result);

        if (!response.ok || isConflictMsg) {
            try { hideLoader(); } catch (_) {}
            if (response.status === 409 || isConflictMsg) {
                showAdviserConflictModal(result);
            } else {
                showResultModal(addAdviserResultModal, null, 'addAdviserResultMessage', null, result, 'error');
            }
            return; // don't proceed to success path
        }

        try { hideLoader(); } catch (_) {}
        showResultModal(addAdviserResultModal, null, 'addAdviserResultMessage', null, result, 'success');
        document.getElementById('adviserForm').reset();
        loadAdvisers(chairpersonDepartment); // Reload advisers after adding new one
    } catch (error) {
        console.error("Error adding adviser:", error);
        try { hideLoader(); } catch (_) {}
        showResultModal(addAdviserResultModal, null, 'addAdviserResultMessage', null, error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        try { hideLoader(); } catch (_) {}
    }
});

// Show a specialized conflict modal with a "Change Section" action
function showAdviserConflictModal(message) {
    const modal = addAdviserResultModal;
    if (!modal) return;
    const msgEl = addAdviserResultMessage;
    if (/[<][a-zA-Z!/]/.test(String(message))) {
        msgEl.innerHTML = message;
    } else {
        msgEl.textContent = message;
    }
    // Ensure there's a Change Section button
    const actions = modal.querySelector('.modal-actions');
    if (actions) {
        let changeBtn = actions.querySelector('#addAdviserChangeSectionBtn');
        if (!changeBtn) {
            changeBtn = document.createElement('button');
            changeBtn.id = 'addAdviserChangeSectionBtn';
            changeBtn.type = 'button';
            changeBtn.className = 'btn btn-secondary';
            changeBtn.textContent = 'Change Section';
            actions.insertBefore(changeBtn, actions.firstChild);
        }
        changeBtn.style.display = '';
        changeBtn.onclick = () => {
            closeModal(modal);
            const field = document.getElementById('adviserSection');
            if (field) { field.focus(); if (field.select) field.select(); }
        };

        // Ensure OK button closes the modal (rebind safely)
        const okBtn = actions.querySelector('#addAdviserResultOk');
        if (okBtn) {
            okBtn.onclick = () => closeModal(modal);
        }
    }
    openModal(modal);
}