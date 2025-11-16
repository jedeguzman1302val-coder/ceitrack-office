document.addEventListener('DOMContentLoaded', () => {
    // 1. Kunin ang data ng SECRETARY sa sessionStorage
    const currentUserJSON = sessionStorage.getItem('currentUser');
    const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;

    // Base URL for API calls
    const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '3000')) ? 'http://localhost:3000' : '';

    if (!currentUser || !currentUser.idNumber) {
        console.error('Secretary data not found in sessionStorage.');
        const secretaryNameEl = document.getElementById('secretary-name');
        if (secretaryNameEl) secretaryNameEl.textContent = 'Unknown User';
        return; // Itigil ang execution
    }

    // Gamitin ang "secretary" sa variable names para malinaw
    const secretaryId = currentUser.idNumber;
    const secretaryName = currentUser.name || 'Secretary';
    
    // 2. I-display AGAD ang info sa header
    function displaySecretaryInfo() {
        // Gamitin ang bagong IDs mula sa HTML
        const nameEl = document.getElementById('secretary-name');
        const avatarEl = document.getElementById('secretary-avatar');
        const metaEl = document.getElementById('secretary-meta');

        if (nameEl) {
            nameEl.textContent = secretaryName;
        }
        if (avatarEl) {
            avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(secretaryName)}&background=4361ee&color=fff`;
        }
        if (metaEl) {
            // Pwede mong ilagay ang department dito kung meron, o "Secretary" lang
            metaEl.textContent = currentUser.department || 'Secretary';
        }
    }

    // 3. I-fetch ang stats para sa iisang card
    async function fetchCompanyStats() {
        try {
            // Gawa-gawa lang na API endpoint, palitan mo na lang
            // kung ano ang tama sa backend mo.
            const response = await fetch(`${API_BASE}/api/secretary/company-count/${secretaryId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch company count.');
            }
            const statsData = await response.json(); // Inaasahan na { count: 10 }
            
            const companyCountEl = document.getElementById('added-company-count');
            
            if (companyCountEl && statsData.count !== undefined) {
                companyCountEl.textContent = statsData.count;
            }

        } catch (error) {
            console.error("Error fetching company stats:", error);
            const companyCountEl = document.getElementById('added-company-count');
            if (companyCountEl) companyCountEl.textContent = 'Error';
        }
    }

    // Fetch companies with MOU count
    async function fetchCompaniesMouCount() {
        try {
            const res = await fetch(`${API_BASE}/api/secretary/company-count/${secretaryId}`);
            if (!res.ok) throw new Error('No company count endpoint');
            const data = await res.json();
            const el = document.getElementById('companies-mou-count');
            if (el && data.count !== undefined) el.textContent = data.count;
        } catch (err) {
            console.warn('company-count endpoint missing or failed, showing 0', err.message || err);
            const el = document.getElementById('companies-mou-count'); if (el) el.textContent = '0';
        }
    }

    // Fetch student request documents count from secretaryRequest collection
    async function fetchStudentRequestsCount() {
        try {
            const res = await fetch(`${API_BASE}/api/secretary/requests-count/${secretaryId}`);
            if (res.ok) {
                const data = await res.json();
                const el = document.getElementById('student-requests-count');
                if (el && data.count !== undefined) el.textContent = data.count;
                return;
            }

            // Fallback: try generic endpoint that returns number of documents in secretaryRequest
            const fallback = await fetch(`${API_BASE}/api/secretaryRequest/count`);
            if (fallback.ok) {
                const fdata = await fallback.json();
                const el = document.getElementById('student-requests-count');
                if (el && fdata.count !== undefined) el.textContent = fdata.count;
                return;
            }

            throw new Error('No suitable endpoint');
        } catch (err) {
            console.warn('requests-count endpoint missing or failed, showing 0', err.message || err);
            const el = document.getElementById('student-requests-count'); if (el) el.textContent = '0';
        }
    }

    // --- Sidebar Logic (ITO AY PAREHONG-PAREHO sa adviser.js) ---
    const sidebarToggleBtn = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.setAttribute('aria-expanded', sidebar.classList.contains('active'));
        sidebarToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            const expanded = sidebar.classList.contains('active');
            sidebarToggleBtn.setAttribute('aria-expanded', expanded);
            if (expanded && window.innerWidth <= 768) {
                document.body.classList.add('sidebar-open');
            } else {
                document.body.classList.remove('sidebar-open');
            }
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

    // Initialize dashboard
    displaySecretaryInfo();
    fetchCompaniesMouCount();
    fetchStudentRequestsCount();
});