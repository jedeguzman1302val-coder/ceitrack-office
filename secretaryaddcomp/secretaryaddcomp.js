document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================================
    // 1. USER & HEADER LOGIC (Mula sa secretary dashboard)
    // ==========================================================
    
    // Kunin ang data ng SECRETARY sa sessionStorage
    const currentUserJSON = sessionStorage.getItem('currentUser');
    const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;

    // Base URL for API calls
    const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '3000')) ? 'http://localhost:3000' : '';

    if (!currentUser || !currentUser.idNumber) {
        console.error('Secretary data not found in sessionStorage.');
        const secretaryNameEl = document.getElementById('secretary-name');
        if (secretaryNameEl) secretaryNameEl.textContent = 'Unknown User';
        // Hindi tayo nag-return para gumana pa rin ang sidebar
    } else {
        // Ipakita lang ang info kung may currentUser
        displaySecretaryInfo();
    }

    // Function para i-display ang info sa header
    function displaySecretaryInfo() {
        const secretaryName = currentUser.name || 'Secretary';

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
            // Pwede mong palitan to kung ano ang role or department
            metaEl.textContent = currentUser.department || 'Secretary';
        }
    }

    // Function para i-fetch ang stats (gagana lang to sa dashboard page)
    async function fetchCompanyStats() {
        // Check muna kung nasa dashboard page tayo
        const companyCountEl = document.getElementById('added-company-count');
        if (!companyCountEl) {
            // Kung wala ang element, ibig sabihin wala tayo sa dashboard,
            // kaya wag na ituloy
            return; 
        }

        if (!currentUser || !currentUser.idNumber) {
            companyCountEl.textContent = 'N/A';
            return;
        }

        try {
            // Siguraduhin na tama ang API endpoint mo
            const response = await fetch(`${API_BASE}/api/secretary/company-count/${currentUser.idNumber}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch company count.');
            }
            const statsData = await response.json(); 
            
            if (statsData.count !== undefined) {
                companyCountEl.textContent = statsData.count;
            }

        } catch (error) {
            console.error("Error fetching company stats:", error);
            if (companyCountEl) companyCountEl.textContent = 'Error';
        }
    }

    // ==========================================================
    // 2. SIDEBAR TOGGLE LOGIC (Pareho sa lahat ng page)
    // ==========================================================
    
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

        // Para ma-close ang sidebar kapag cliniclick sa labas (mobile view)
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

    // ==========================================================
    // 3. LOGIC PARA SA 'ADD-COMPANY' PAGE
    // ==========================================================

    // --- LOGIC PARA SA LOGO UPLOADER ---
    const logoUploader = document.getElementById('logoUploader');
    const logoInput = document.getElementById('logoInput');
    const logoPreview = document.getElementById('logoPreview');
    const logoPlaceholder = document.getElementById('logoPlaceholder');

    // Check muna kung andito ang elements (para tumakbo lang sa add-company page)
    if (logoUploader && logoInput && logoPreview && logoPlaceholder) {
        
        // 1. Kapag cliniclick ang circle container
        logoUploader.addEventListener('click', () => {
            logoInput.click(); // I-trigger ang hidden file input
        });

        // 2. Kapag may piniling file ang user
        logoInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            
            if (file) {
                // Gumamit ng FileReader para basahin ang image
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    // Ilagay ang image data sa <img> tag
                    logoPreview.src = e.target.result;
                    // Ipakita ang image preview
                    logoPreview.style.display = 'block';
                    // Itago ang placeholder icon
                    logoPlaceholder.style.display = 'none';
                };
                
                // Basahin ang file bilang Data URL
                reader.readAsDataURL(file);
            }
        });
    }

    // --- LOGIC PARA SA FORM SUBMISSION ---
    const addCompanyForm = document.getElementById('add-company-form');
    const moaInput = document.getElementById('moaInput');
    const moaUploadBtn = document.getElementById('moaUploadBtn');
    const moaFileName = document.getElementById('moaFileName');

    // MOA upload interactions
    if (moaUploadBtn && moaInput) {
        moaUploadBtn.addEventListener('click', () => moaInput.click());
    }
    if (moaInput && moaFileName) {
        moaInput.addEventListener('change', () => {
            const file = moaInput.files && moaInput.files[0];
            if (!file) {
                moaFileName.textContent = 'No file chosen';
                return;
            }
            const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            const maxBytes = 10 * 1024 * 1024; // 10MB
            if (file.size > maxBytes) {
                alert('MOA file is too large. Maximum size is 10 MB.');
                moaInput.value = '';
                moaFileName.textContent = 'No file chosen';
                return;
            }
            if (file.type && !allowed.includes(file.type)) {
                // Some browsers may not set type for older doc files; we already filter by extension in accept attr
                console.warn('MOA file type not strictly allowed:', file.type);
            }
            moaFileName.textContent = file.name;
        });
    }

    // Check muna kung andito ang form
    if (addCompanyForm) {
        addCompanyForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Pigilan ang default form reload
            
            console.log('Form submitted!');

            // 1. Kunin ang file mula sa logo input
            // Make sure na 'logoInput' ay defined (nasa taas na siya)
            const logoFile = logoInput.files[0]; 
            // 1.b Kunin ang MOA file
            const moaFile = moaInput ? moaInput.files[0] : null;
            
            // 2. Kunin ang data sa input fields
            const companyData = {
                name: document.getElementById('companyName').value,
                address: document.getElementById('companyAddress').value,
                email: document.getElementById('companyEmail').value,
                landline: document.getElementById('companyLandline').value,
                mobile: document.getElementById('companyMobile').value,
                hr: document.getElementById('companyHR').value,
                designation: document.getElementById('companyDesignation').value,
            };

            // 2.b I-map sa HTE schema (yung gusto mong field names)
            const htePayload = {
                hteName: companyData.name,
                hteAddress: companyData.address,
                hteEmail: companyData.email,
                hteLandline: companyData.landline,
                hteMobile: companyData.mobile,
                hteRepresentative: companyData.hr,
                hteDesignation: companyData.designation,
                // logoUrl: to be set by backend after upload
                // hteMOA: to be set as URL by backend after upload
            };

            console.log('Company Data:', companyData);
            console.log('HTE Payload (JSON):', htePayload);
            if (logoFile) {
                console.log('Logo File:', logoFile.name);
                // Dito mo ilalagay ang logic para i-upload ang LOGO FILE sa storage
                // (e.g., Firebase Storage)
            } else {
                console.log('No logo file selected.');
            }

            if (moaFile) {
                console.log('MOA File:', moaFile.name);
                // Dito mo ilalagay ang logic para i-upload ang MOA FILE sa storage
                // (e.g., Firebase Storage) at isama ang URL sa payload
            } else {
                console.log('No MOA file selected.');
            }

            // Halimbawa ng Pags-submit (pseudo-code):
            // Option A: JSON + separate file uploads (backend returns URLs for logoUrl/hteMOA)
            // await fetch(`${API_BASE}/api/companies`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(htePayload) })
            // Then upload files to storage and PATCH with returned URLs.

            // Option B: Direct multipart form-data (backend handles files and JSON together)
            // Build FormData using the required HTE keys
            const formData = new FormData();
            Object.entries(htePayload).forEach(([k, v]) => formData.append(k, v ?? ''));
            if (logoFile) formData.append('logo', logoFile); // backend can save and produce logoUrl
            if (moaFile) formData.append('hteMOA', moaFile); // your requested key for MOA file

            // Example only (uncomment when endpoint is ready):
            // const res = await fetch(`${API_BASE}/api/companies`, { method: 'POST', body: formData });
            // const created = await res.json();
            // console.log('Created company:', created);
            
            alert('Company added successfully! (Check console for data)');
            // Optional: reset MOA indicator after submit
            if (moaFileName) moaFileName.textContent = 'No file chosen';
            if (moaInput) moaInput.value = '';
        });
    }

    // ==========================================================
    // 4. INITIALIZE PAGE FUNCTIONS
    // ==========================================================
    
    // (Note: displaySecretaryInfo() ay tinawag na sa taas, after ng currentUser check)
    
    // I-try i-fetch ang stats (gagana lang to kung nasa dashboard page tayo)
    fetchCompanyStats();

});