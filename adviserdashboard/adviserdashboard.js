document.addEventListener('DOMContentLoaded', () => {
    // 1. Kunin ang data DIREKTA sa sessionStorage
    const currentUserJSON = sessionStorage.getItem('currentUser');
    const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;

    // Base URL for API calls
    const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '3000')) ? 'http://localhost:3000' : '';

    if (!currentUser || !currentUser.idNumber) {
        console.error('Adviser data not found in sessionStorage. Redirecting to login.');
        // Opsyonal: I-redirect pabalik sa login page kung walang data
        // window.location.href = '../officelogin/officelogin.html'; 
        
        // Kung hindi ire-redirect, i-display na lang ang "Unknown"
        const adviserNameEl = document.getElementById('adviser-name');
        if (adviserNameEl) adviserNameEl.textContent = 'Unknown User';
        return; // Itigil ang execution ng iba pang functions
    }

    const adviserId = currentUser.idNumber;
    const adviserName = currentUser.name || 'Adviser';
    const adviserDept = currentUser.department || '';
    const adviserSection = currentUser.section || '';

    // 2. I-display AGAD ang info sa header (Wala nang fetch!)
    function displayHeaderInfo() {
        const adviserNameEl = document.getElementById('adviser-name');
        const adviserAvatarEl = document.getElementById('adviser-avatar');
        const metaEl = document.getElementById('adviser-meta');

        if (adviserNameEl) {
            adviserNameEl.textContent = adviserName;
        }
        if (adviserAvatarEl) {
            adviserAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adviserName)}&background=4361ee&color=fff`;
        }
        if (metaEl) {
            if (adviserDept && adviserSection) {
                metaEl.textContent = `${adviserDept} • ${adviserSection}`;
            } else {
                metaEl.textContent = adviserDept || adviserSection;
            }
        }
    }

    // 3. Gamitin ang adviserId para sa ibang functions
    async function fetchDashboardStats() {
        try {
            const response = await fetch(`${API_BASE}/api/adviser/students-count/${adviserId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch student count.');
            }
            const statsData = await response.json();
            
            const totalStudentsEl = document.getElementById('total-students');
            if (totalStudentsEl && statsData.count !== undefined) {
                totalStudentsEl.textContent = statsData.count;
            }

            const activeOjtEl = document.getElementById('active-ojt');
            if (activeOjtEl && statsData.activeOjt !== undefined) {
                activeOjtEl.textContent = statsData.activeOjt;
            }

            const pulloutEl = document.getElementById('pullout-students');
            const noCompanyEl = document.getElementById('no-company');
            const uncompleteDtrEl = document.getElementById('uncomplete-dtr');

            if (pulloutEl) pulloutEl.textContent = statsData.pulloutStudents ?? 0;
            if (noCompanyEl) noCompanyEl.textContent = statsData.noCompany ?? 0;
            if (uncompleteDtrEl) uncompleteDtrEl.textContent = statsData.uncompletedDTR ?? 0;
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
            const totalStudentsEl = document.getElementById('total-students');
            if (totalStudentsEl) totalStudentsEl.textContent = 'Error';
        }
    }

    // --- Sidebar Logic (Walang binago dito) ---
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

    // Logout functionality
    const logoutLinks = document.querySelectorAll('a[href="#"]');
    logoutLinks.forEach(link => {
        if (link.textContent.trim().toLowerCase().includes('logout')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Clear session storage
                sessionStorage.clear();
                // Redirect to login page
                window.location.href = '../officelogin/officelogin.html';
            });
        }
    });

    // Initialize dashboard
    displayHeaderInfo();
    fetchDashboardStats();
});