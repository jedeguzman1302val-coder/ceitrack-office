document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================================
    // 1. USER & HEADER LOGIC (Para sa STUDENT)
    // ==========================================================
    
    const currentUserJSON = sessionStorage.getItem('currentUser');
    const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;

    if (!currentUser || !currentUser.idNumber) {
        console.error('Student data not found in sessionStorage.');
        const studentNameEl = document.getElementById('student-name');
        if (studentNameEl) studentNameEl.textContent = 'Unknown User';
    } else {
        displayStudentInfo(currentUser);
    }

    function displayStudentInfo(student) {
        const studentName = student.name || 'Student';
        const studentCourse = student.department || student.course || 'Unknown';
        const studentSection = student.section || '';

        const nameEl = document.getElementById('student-name');
        const avatarEl = document.getElementById('student-avatar');
        const metaEl = document.getElementById('student-meta');

        if (nameEl) {
            nameEl.textContent = studentName;
        }
        if (avatarEl) {
            avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=4361ee&color=fff`;
        }
        if (metaEl) {
            metaEl.textContent = `${studentCourse} • ${studentSection}`;
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
    // 3. LOGIC PARA SA 'REQUEST-DOCUMENT' PAGE
    // ==========================================================

    let allStudents = {};
    let filteredStudents = {};

    // API base — point to backend server. Adjust if your backend runs elsewhere.
    const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';

    const studentListContainer = document.getElementById('student-list-container');
    const deptButtons = document.querySelectorAll('.dept-filter-btn');
    const sectionFilterContainer = document.getElementById('section-filter-container');

    async function fetchAllRequests() {
        if (!db) {
            console.error("Firestore is not initialized");
            return;
        }

        // show loading spinner
        showLoading(true);

        try {
            // Fetch from secretaryRequest collection instead
            const requestsSnapshot = await db.collection('secretaryRequest').get();
            const students = {};

            console.log(`Found ${requestsSnapshot.size} requests in total.`);

            requestsSnapshot.forEach(doc => {
                const data = doc.data();
                const studentNumber = doc.id; // Document ID is the student number
                
                console.log('secretaryRequest doc:', { docId: doc.id, data });

                // Store student with company info and requested documents
                students[studentNumber] = {
                    id: studentNumber,
                    name: data.studentName || '',
                    course: data.course || '',
                    section: data.section || '',
                    // Company info
                    companyName: data.companyName || '',
                    companyAddress: data.companyAddress || '',
                    companyEmail: data.companyEmail || '',
                    companyLandline: data.companyLandline || '',
                    companyMobile: data.companyMobile || '',
                    companyRepresentative: data.companyRepresentative || '',
                    companyDesignation: data.companyDesignation || '',
                    companyLogoUrl: data.companyLogourl || '',
                    // Requested documents
                    requestedDocuments: data.requestedDocuments || [],
                    notes: data.notes || '',
                    createdAt: data.createdAt || null
                };
            });

            console.log("Processed students data:", students);
            allStudents = students;
            filteredStudents = allStudents;
            renderStudentList(filteredStudents);
            updateSectionFilters();
            showLoading(false);
        } catch (error) {
            showLoading(false);
            console.error("Error fetching requests:", error);
        }
    }

    function renderStudentList(students) {
        console.log("Rendering student list:", students);
        if (!studentListContainer) return;
        studentListContainer.innerHTML = '';

        Object.keys(students).forEach(studentNumber => {
            const student = students[studentNumber];
            const studentDiv = document.createElement('div');
            studentDiv.classList.add('student-card');
            
            // Count how many documents are requested
            const docCount = Array.isArray(student.requestedDocuments) ? student.requestedDocuments.length : 0;
            
            studentDiv.innerHTML = `
                <div class="student-card-header">
                    <div class="student-avatar-circle">
                        ${(student.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div class="student-card-info">
                        <h3 class="student-card-name">${student.name || studentNumber}</h3>
                        <p class="student-card-meta">${student.course} • ${student.section} • ${student.id}</p>
                    </div>
                </div>
                <div class="student-card-body">
                    <div class="company-preview">
                        <i class="fas fa-building"></i>
                        <span>${student.companyName || 'No company assigned'}</span>
                    </div>
                    <div class="document-count">
                        <i class="fas fa-file-alt"></i>
                        <span>${docCount} document${docCount !== 1 ? 's' : ''} requested</span>
                    </div>
                </div>
                <button type="button" class="view-details-btn" data-student-number="${student.id || studentNumber}">
                    View Details
                    <i class="fas fa-arrow-right"></i>
                </button>
            `;
            studentListContainer.appendChild(studentDiv);
        });

        const viewBtns = document.querySelectorAll('.view-details-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const studentNumber = btn.dataset.studentNumber;
                const student = students[studentNumber];
                renderModal(student);
            });
        });
    }

    // Loading spinner helper
    function showLoading(show) {
        if (!studentListContainer) return;
        let spinner = document.getElementById('student-list-spinner');
        if (show) {
            if (!spinner) {
                spinner = document.createElement('div');
                spinner.id = 'student-list-spinner';
                spinner.className = 'spinner';
                spinner.innerHTML = '<div class="double-bounce1"></div><div class="double-bounce2"></div>';
                studentListContainer.innerHTML = '';
                studentListContainer.appendChild(spinner);
            }
        } else {
            if (spinner) spinner.remove();
        }
    }

    // Render and show a modal with the student's company info and document generation
    function renderModal(student) {
        if (!student) return;

        // Remove any existing modal first
        const existing = document.querySelector('.modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        // Header with close button
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const headerLeft = document.createElement('div');
        headerLeft.className = 'modal-header-left';
        
        const title = document.createElement('h2');
        title.innerHTML = `<i class="fas fa-user-graduate"></i> ${student.name || student.id}`;
        headerLeft.appendChild(title);
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close';
        closeBtn.innerHTML = '&times;';

        header.appendChild(headerLeft);
        header.appendChild(closeBtn);

        // Body: student info, company info, document generation
        const body = document.createElement('div');
        body.className = 'modal-body';

        // Student Information Section
        const studentSection = document.createElement('div');
        studentSection.className = 'info-section';
        studentSection.innerHTML = `
            <div class="section-header">
                <i class="fas fa-user"></i>
                <h3>Student Information</h3>
            </div>
            <div class="info-grid">
                <div class="info-item">
                    <label>Student Number</label>
                    <span>${student.id || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Name</label>
                    <span>${student.name || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Course</label>
                    <span>${student.course || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Section</label>
                    <span>${student.section || 'N/A'}</span>
                </div>
            </div>
        `;
        body.appendChild(studentSection);

        // Company Information Section
        const companySection = document.createElement('div');
        companySection.className = 'info-section';
        companySection.innerHTML = `
            <div class="section-header">
                <i class="fas fa-building"></i>
                <h3>Company Information</h3>
            </div>
            ${student.companyLogoUrl ? `
            <div class="company-logo-container">
                <img src="${student.companyLogoUrl}" alt="Company Logo" class="company-logo" onerror="this.style.display='none'">
            </div>
            ` : ''}
            <div class="info-grid">
                <div class="info-item full-width">
                    <label>Company Name</label>
                    <span>${student.companyName || 'N/A'}</span>
                </div>
                <div class="info-item full-width">
                    <label>Address</label>
                    <span>${student.companyAddress || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Email</label>
                    <span>${student.companyEmail || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Mobile</label>
                    <span>${student.companyMobile || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Landline</label>
                    <span>${student.companyLandline || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Representative</label>
                    <span>${student.companyRepresentative || 'N/A'}</span>
                </div>
                <div class="info-item full-width">
                    <label>Designation</label>
                    <span>${student.companyDesignation || 'N/A'}</span>
                </div>
            </div>
        `;
        body.appendChild(companySection);

        // Requested Documents Section
        const documentsSection = document.createElement('div');
        documentsSection.className = 'info-section';
        documentsSection.innerHTML = `
            <div class="section-header">
                <i class="fas fa-file-alt"></i>
                <h3>Requested Documents</h3>
            </div>
        `;

        if (Array.isArray(student.requestedDocuments) && student.requestedDocuments.length) {
            const docList = document.createElement('ul');
            docList.className = 'document-list';
            student.requestedDocuments.forEach(doc => {
                const li = document.createElement('li');
                li.className = 'document-item';
                li.innerHTML = `
                    <i class="fas fa-file-pdf"></i>
                    <span>${doc}</span>
                `;
                docList.appendChild(li);
            });
            documentsSection.appendChild(docList);
        } else {
            const p = document.createElement('p');
            p.className = 'no-documents';
            p.textContent = 'No documents requested';
            documentsSection.appendChild(p);
        }
        body.appendChild(documentsSection);

        // Generate Documents Buttons Section
        const generateSection = document.createElement('div');
        generateSection.className = 'generate-section';
        generateSection.innerHTML = `
            <div class="section-header">
                <i class="fas fa-magic"></i>
                <h3>Generate Documents</h3>
            </div>
            <div class="generate-buttons">
                <button type="button" class="generate-btn" data-doc-type="moa">
                    <i class="fas fa-file-contract"></i>
                    <span>Generate MOA</span>
                </button>
                <button type="button" class="generate-btn" data-doc-type="waiver">
                    <i class="fas fa-file-signature"></i>
                    <span>Generate Waiver</span>
                </button>
                <button type="button" class="generate-btn" data-doc-type="recommendation">
                    <i class="fas fa-file-alt"></i>
                    <span>Generate Recommendation Letter</span>
                </button>
            </div>
            <div class="generate-status"></div>
        `;
        body.appendChild(generateSection);

        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Show modal via class
        modal.classList.add('active');

        // Close modal handlers
        function closeModal() { 
            modal.classList.remove('active');
            setTimeout(() => { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 200);
        }
        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        // Generate document button handlers
        const generateBtns = generateSection.querySelectorAll('.generate-btn');
        const generateStatus = generateSection.querySelector('.generate-status');
        
        console.log('Found generate buttons:', generateBtns.length); // Debug log
        
        generateBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                console.log('Generate button clicked!', e.target); // Debug log
                e.preventDefault(); // Prevent default button behavior
                e.stopPropagation(); // Stop event bubbling
                
                const docType = btn.dataset.docType;
                generateStatus.textContent = `Generating ${docType.toUpperCase()}...`;
                generateStatus.className = 'generate-status processing';
                
                // Disable all buttons during generation
                generateBtns.forEach(b => b.disabled = true);

                try {
                    const response = await fetch(`${API_BASE}/api/generate-document`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            studentData: student,
                            docType: docType
                        })
                    });

                    const result = await response.json();

                    if (response.ok && result.success) {
                        generateStatus.innerHTML = `
                            <i class="fas fa-check-circle"></i>
                            ${result.message}
                            <div class="action-buttons">
                                <a href="${result.downloadUrl}"
                                   class="download-link" 
                                   download="${result.filename}"
                                   data-url="${result.downloadUrl}"
                                   data-filename="${result.filename}">
                                    <i class="fas fa-download"></i> Download PDF
                                </a>
                                <button type="button" class="send-to-student-btn" data-doc-type="${docType}" data-url="${result.downloadUrl}" data-filename="${result.filename}">
                                    <i class="fas fa-paper-plane"></i> Send to student
                                </button>
                            </div>
                        `;
                        generateStatus.className = 'generate-status success';

                        // Download link handler - force actual download
                        const downloadLink = generateStatus.querySelector('.download-link');
                        if (downloadLink) {
                            downloadLink.addEventListener('click', async (e) => {
                                e.preventDefault();
                                try {
                                    const url = downloadLink.dataset.url;
                                    const filename = downloadLink.dataset.filename;
                                    
                                    // Fetch the file as a blob
                                    const response = await fetch(url);
                                    const blob = await response.blob();
                                    
                                    // Create a temporary download link
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    const tempLink = document.createElement('a');
                                    tempLink.href = blobUrl;
                                    tempLink.download = filename;
                                    document.body.appendChild(tempLink);
                                    tempLink.click();
                                    document.body.removeChild(tempLink);
                                    
                                    // Clean up the blob URL
                                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
                                } catch (err) {
                                    console.error('Download failed:', err);
                                    // Fallback to direct download
                                    window.location.href = downloadLink.dataset.url;
                                }
                            });
                        }

                        // Send to student handler
                        const sendBtn = generateStatus.querySelector('.send-to-student-btn');
                        if (sendBtn) {
                            sendBtn.addEventListener('click', async () => {
                                try {
                                    sendBtn.disabled = true;
                                    const original = sendBtn.innerHTML;
                                    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

                                    const payload = {
                                        studentId: student.id,
                                        studentName: student.name,
                                        docType,
                                        downloadUrl: sendBtn.dataset.url,
                                        filename: sendBtn.dataset.filename,
                                        extra: {
                                            course: student.course,
                                            section: student.section,
                                            companyName: student.companyName,
                                            companyRepresentative: student.companyRepresentative
                                        }
                                    };

                                    const sendResp = await fetch(`${API_BASE}/api/send-document`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                    });
                                    const sendResult = await sendResp.json();
                                    if (!sendResp.ok || !sendResult.success) {
                                        throw new Error(sendResult.error || 'Failed to send document');
                                    }

                                    sendBtn.innerHTML = '<i class="fas fa-check"></i> Sent to student';
                                    sendBtn.classList.add('copied');
                                } catch (err) {
                                    console.error('Send failed:', err);
                                    sendBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed. Retry';
                                    sendBtn.disabled = false;
                                }
                            });
                        }
                    } else {
                        throw new Error(result.error || 'Failed to generate document');
                    }
                } catch (error) {
                    console.error('Error generating document:', error);
                    generateStatus.innerHTML = `
                        <i class="fas fa-exclamation-circle"></i>
                        Error: ${error.message}
                    `;
                    generateStatus.className = 'generate-status error';
                } finally {
                    // Re-enable buttons
                    generateBtns.forEach(b => b.disabled = false);
                }
                
                return false; // Extra safety to prevent any default action
            });
        });
    }

    function updateSectionFilters() {
        if (!sectionFilterContainer) return;
        sectionFilterContainer.innerHTML = '';

        const activeDeptBtn = document.querySelector('.dept-filter-btn.active');
        const selectedDept = activeDeptBtn ? activeDeptBtn.dataset.dept : null;

        // If no department is actively selected, pick first dept button's dept
        if (!selectedDept) {
            const firstDept = document.querySelector('.dept-filter-btn');
            if (firstDept) firstDept.classList.add('active');
        }

        const realSelectedDept = selectedDept || (document.querySelector('.dept-filter-btn')?.dataset.dept);
        const sections = [...new Set(Object.values(allStudents).filter(student => student.course === realSelectedDept).map(student => student.section))];
        
        sections.forEach(section => {
            const button = document.createElement('button');
            button.type = 'button'; // Add button type
            button.textContent = section;
            button.classList.add('section-filter-btn');
            button.dataset.section = section;
            sectionFilterContainer.appendChild(button);
        });
    }

    function filterStudents() {

        const activeDeptBtn = document.querySelector('.dept-filter-btn.active');
        const selectedDept = activeDeptBtn ? activeDeptBtn.dataset.dept : null;

        const activeSectionBtn = document.querySelector('.section-filter-btn.active');
        const selectedSection = activeSectionBtn ? activeSectionBtn.dataset.section : null;

        let students = allStudents;

        if (selectedDept) {
            students = Object.fromEntries(Object.entries(students).filter(([_, student]) => student.course === selectedDept));
        }

        if (selectedSection) {
            students = Object.fromEntries(Object.entries(students).filter(([_, student]) => student.section === selectedSection));
        }

        filteredStudents = students;
        renderStudentList(filteredStudents);
    }

    deptButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            deptButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateSectionFilters();
            filterStudents();
        });
    });

    sectionFilterContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('section-filter-btn')) {
            const sectionBtns = document.querySelectorAll('.section-filter-btn');
            sectionBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterStudents();
        }
    });

    // Initial load: fetch requests from Firestore and render student list
    fetchAllRequests();
});