// Show error modal
function showError(message) {
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorModalMessage');
    errorMessage.textContent = message;
    errorModal.classList.add('show');
}

// Close error modal
function closeErrorModal() {
    const errorModal = document.getElementById('errorModal');
    errorModal.classList.remove('show');
}

// Set role function
function setRole(role) {
    try {
        const loginContainer = document.getElementById('loginContainer');
        const roleTitle = document.getElementById('roleTitle');
        const roleIcon = document.getElementById('roleIcon');
        const formRole = document.getElementById('formRole');
        const departmentGroup = document.getElementById('departmentGroup');

        if (!loginContainer || !roleTitle || !formRole || !departmentGroup) {
            console.error('Required elements not found');
            return;
        }

        loginContainer.classList.remove('chairperson', 'secretary', 'adviser');
        loginContainer.classList.add(role);

        if (role === 'chairperson' || role === 'adviser') {
            departmentGroup.style.display = 'block';
            setTimeout(() => {
                departmentGroup.classList.add('show');
            }, 10);
            // Make department required when visible for chairperson/adviser
            const deptSelect = document.getElementById('department');
            if (deptSelect) deptSelect.required = true;
        } else {
            departmentGroup.classList.remove('show');
            setTimeout(() => {
                departmentGroup.style.display = 'none';
            }, 300);
            // Remove required when department is hidden (so form validation won't complain)
            const deptSelect = document.getElementById('department');
            if (deptSelect) {
                deptSelect.required = false;
                // Clear selection so it doesn't accidentally submit an outdated value
                deptSelect.value = '';
            }
        }

        if (role === 'chairperson') {
            roleTitle.textContent = 'Chairperson Portal';
            if (roleIcon) roleIcon.className = 'fas fa-user-tie';
            formRole.value = 'chairperson';
        } else if (role === 'secretary') {
            roleTitle.textContent = 'Secretary Portal';
            if (roleIcon) roleIcon.className = 'fas fa-user-edit';
            formRole.value = 'secretary';
        } else {
            roleTitle.textContent = 'Adviser Portal';
            if (roleIcon) roleIcon.className = 'fas fa-user-graduate';
            formRole.value = 'adviser';
        }
    } catch (error) {
        console.error('Error setting role:', error);
    }
}

// Handle form submission
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const idNumber = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('formRole').value;
    const department = document.getElementById('department').value;

    if ((role === 'chairperson' || role === 'adviser') && !department) {
        showError('Please select a department');
        return;
    }

    try {
        const submitBtn = document.querySelector('.btn');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;

        const isFileProtocol = window.location.protocol === 'file:';
        const isDifferentPort = window.location.port && window.location.port !== '3000';
        const API_BASE = (isFileProtocol || isDifferentPort) ? 'http://localhost:3000' : '';

        // Special handling for secretary accounts: fetch the account by unique ID/path
        if (role === 'secretary') {
            try {
                const resp = await fetch(`${API_BASE}/secretary/${encodeURIComponent(idNumber)}`);
                if (!resp.ok) {
                    let msg = resp.statusText || 'Secretary account not found';
                    try {
                        const t = await resp.text(); if (t) msg = t;
                    } catch (e) {}
                    throw new Error(msg);
                }

                let accountData = await resp.json();
                // Some backends return an object with nested key (e.g., Firebase). Try to normalize.
                if (accountData && !accountData.password && typeof accountData === 'object') {
                    const keys = Object.keys(accountData).filter(k => k && typeof accountData[k] === 'object');
                    if (keys.length === 1 && accountData[keys[0]].password) {
                        accountData = accountData[keys[0]];
                    }
                }

                const storedPassword = (accountData && (accountData.password || accountData.pass || accountData.pw)) || '';

                if (!storedPassword || storedPassword !== password) {
                    throw new Error('Invalid ID number or password');
                }

                // Build currentUser object and save to sessionStorage
                const currentUser = {
                    idNumber: idNumber,
                    name: accountData.name || accountData.fullName || accountData.displayName || 'Secretary',
                    role: 'secretary',
                    department: accountData.department || accountData.dept || ''
                };

                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

                // Redirect to secretary dashboard (the dashboard reads sessionStorage for header info)
                window.location.href = '../secretarydashboard/secretarydash.html';
                return;

            } catch (err) {
                throw err; // handled by outer catch
            }
        }

        // Default login flow for chairperson/adviser via API login
        const apiUrl = (API_BASE ? API_BASE + '/api/login' : '/api/login');

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idNumber,
                password,
                role,
                department
            })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type') || '';
            let errorMessage = response.statusText || 'Login failed';
            try {
                if (contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.message || JSON.stringify(errorData);
                } else {
                    const text = await response.text();
                    if (text) errorMessage = text;
                }
            } catch (e) { /* ignore parse errors */ }
            throw new Error(errorMessage);
        }

        const accountData = await response.json();

        // Store user data in session storage ONLY
        sessionStorage.setItem('currentUser', JSON.stringify({
            idNumber: idNumber,
            name: accountData.name,
            role: role,
            position: accountData.position || '',
            department: accountData.department || '',
            section: accountData.section
        }));

        // Redirect to appropriate dashboard
        if (role === 'chairperson') {
            window.location.href = '../chairpersondashboard/chairdash.html';
        } else if (role === 'adviser') {
            window.location.href = '../adviserdashboard/adviserdashboard.html';
        }

    } catch (error) {
        console.error('Login error:', error);
        showError(error.message);

        const submitBtn = document.querySelector('.btn');
        submitBtn.innerHTML = 'Login';
        submitBtn.disabled = false;
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setRole('chairperson'); // Default role
    
    // Close modal when clicking outside of it
    const errorModal = document.getElementById('errorModal');
    errorModal.addEventListener('click', function(e) {
        if (e.target === errorModal) {
            closeErrorModal();
        }
    });
});