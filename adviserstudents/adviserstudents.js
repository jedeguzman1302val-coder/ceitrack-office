document.addEventListener('DOMContentLoaded', () => {
    // 1. Kunin ang user data DIREKTA mula sa sessionStorage
    const currentUserJSON = sessionStorage.getItem('currentUser');
    const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;

    let allStudents = [];
    const API_BASE = (window.location.port) ? 'http://localhost:3000' : '';

    if (!currentUser || !currentUser.idNumber) {
        console.error('Adviser data not found in sessionStorage.');
        document.getElementById('adviser-name').textContent = 'Unknown User';
        const tableBody = document.getElementById('students-table-body');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Could not identify user. Please log in again.</td></tr>';
        return;
    }

    // Itakda ang adviserInfo gamit ang data mula sa sessionStorage
    const adviserInfo = {
        id: currentUser.idNumber,
        name: currentUser.name || 'Adviser',
        department: currentUser.department || '',
        section: currentUser.section || ''
    };

    // 2. I-display AGAD ang header info (WALA NANG SEPARATE FETCH)
    function displayHeaderInfo() {
        document.getElementById('adviser-name').textContent = adviserInfo.name;
        document.getElementById('adviser-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adviserInfo.name)}&background=4361ee&color=fff`;
        const metaEl = document.getElementById('adviser-meta');
        if (metaEl) {
            metaEl.textContent = (adviserInfo.department && adviserInfo.section) ? `${adviserInfo.department} • ${adviserInfo.section}` : (adviserInfo.department || adviserInfo.section || '');
        }
    }

    // --- SIDEBAR TOGGLE LOGIC ---
    const sidebarToggleBtn = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = sidebar.classList.toggle('active');
            sidebarToggleBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992 && sidebar.classList.contains('active')) {
                const clickedInsideSidebar = sidebar.contains(e.target) || sidebarToggleBtn.contains(e.target);
                if (!clickedInsideSidebar) {
                    sidebar.classList.remove('active');
                    sidebarToggleBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });
        sidebar.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // === PAGE-SPECIFIC CODE (STUDENT TABLE & MODALS) ===
    const tableBody = document.getElementById('students-table-body');

    function formatHours(decimalHours) {
        if (!decimalHours || decimalHours <= 0) return "0 mins";
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        let result = '';
        if (hours > 0) result += `${hours} hr${hours > 1 ? 's' : ''}`;
        if (minutes > 0) result += `${result.length > 0 ? ' ' : ''}${minutes} min${minutes > 1 ? 's' : ''}`;
        return result.length > 0 ? result : `${Math.round(decimalHours * 60)} mins`;
    }

    function renderStudents(studentsToRender) {
        if (!tableBody) return;
        tableBody.innerHTML = studentsToRender.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 20px;">No students found for this section.</td></tr>' : '';
        studentsToRender.forEach(student => {
            const rowHTML = `<tr>
                <td>
                    <div class="student-info">
                        <img src="${student.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`}" alt="${student.name}" class="student-avatar">
                        <div class="student-details">
                            <div class="name">${student.name}</div>
                            <div class="id-number">${student.idNumber}</div>
                        </div>
                    </div>
                </td>
                <td>${student.company || 'N/A'}</td>
                <td>
                    <div class="hours-text">${formatHours(student.hoursRendered || 0)} / ${student.hoursRequired || 480} hrs</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${((student.hoursRendered || 0) / (student.hoursRequired || 480)) * 100}%;"></div>
                    </div>
                </td>
                <td><span class="status-pill ${student.hasRequirements ? 'complete' : 'incomplete'}">${student.hasRequirements ? 'Starting' : 'Not Starting'}</span></td>
                <td><button class="action-btn" onclick="viewStudentDetails('${student.idNumber}')">View</button></td>
            </tr>`;
            tableBody.innerHTML += rowHTML;
        });
    }

    function renderDocumentList(requirementsData) {
        const listElement = document.getElementById('documents-list');
        if (!listElement) return;
        const allDocumentNames = ['CERTIFICATE OF REGISTRATION', 'ACCEPTANCE LETTER', 'MEMORANDUM OF AGREEMENT', 'WAIVER', 'MEDICAL CERTIFICATE', 'VICINITY MAP', 'RECOMMENDATION LETTER', 'OATH OF UNDERTAKING'];
        listElement.innerHTML = '';
        allDocumentNames.forEach(docName => {
            const docInfo = requirementsData[docName];
            let status, statusClass, fileUrl, isDisabled, iconClass;
            if (docInfo && docInfo.submitRequirements) {
                status = docInfo.status || 'Pending';
                statusClass = status.toLowerCase() === 'approved' ? 'complete' : status.toLowerCase();
                fileUrl = docInfo.submitRequirements;
                isDisabled = false;
                iconClass = 'fa-eye';
            } else {
                status = 'Missing';
                statusClass = 'incomplete';
                fileUrl = '#';
                isDisabled = true;
                iconClass = 'fa-eye-slash';
            }
            const listItem = `<li><i class="fas fa-file-alt doc-icon"></i><span>${docName}</span><button class="action-btn view-doc-btn" onclick="openDocumentViewer('${docName}', '${fileUrl}')" title="View Document" ${isDisabled ? 'disabled' : ''}><i class="fas ${iconClass}"></i></button><span class="status-pill ${statusClass}">${status}</span></li>`;
            listElement.innerHTML += listItem;
        });
    }

    async function fetchAndDisplayStudents(adviser) {
        if (!adviser?.department || !adviser?.section) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Could not determine adviser section.</td></tr>';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/students/${adviser.department}/${adviser.section}`);
            allStudents = response.ok ? await response.json() : [];
            renderStudents(allStudents);
        } catch (error) {
            console.error("Error fetching students data:", error);
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Failed to load data. Please try again.</td></tr>';
        }
    }

    function openModal(modal) {
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        }
    }

    function closeModal(modal) {
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }

    const viewModal = document.getElementById('view-modal');
    if (viewModal) {
        viewModal.querySelector('#modal-close-btn')?.addEventListener('click', () => closeModal(viewModal));
        viewModal.addEventListener('click', e => {
            if (e.target === viewModal) closeModal(viewModal);
        });
    }
    const dtrModal = document.getElementById('dtr-modal');
    if (dtrModal) {
        dtrModal.querySelector('#dtr-modal-close-btn')?.addEventListener('click', () => closeModal(dtrModal));
        dtrModal.addEventListener('click', e => {
            if (e.target === dtrModal) closeModal(dtrModal);
        });
    }
    const docViewerModal = document.getElementById('doc-viewer-modal');
    if (docViewerModal) {
        docViewerModal.querySelector('#doc-viewer-close-btn')?.addEventListener('click', () => closeModal(docViewerModal));
        docViewerModal.addEventListener('click', e => {
            if (e.target === docViewerModal) closeModal(docViewerModal);
        });
    }
    const weeklyReportModal = document.getElementById('weekly-report-modal');
    if (weeklyReportModal) {
        weeklyReportModal.querySelector('#weekly-report-close-btn')?.addEventListener('click', () => closeModal(weeklyReportModal));
        weeklyReportModal.addEventListener('click', e => {
            if (e.target === weeklyReportModal) closeModal(weeklyReportModal);
        });
    }

    // DTR Filter handlers
    document.getElementById('dtr-filter-btn')?.addEventListener('click', () => {
        const fromDate = document.getElementById('dtr-date-from').value;
        const toDate = document.getElementById('dtr-date-to').value;
        
        if (!fromDate && !toDate) {
            renderDTRRecords(allDTRRecords);
            return;
        }
        
        const filtered = allDTRRecords.filter(record => {
            const recordDate = record.date;
            if (!recordDate) return false;
            
            if (fromDate && recordDate < fromDate) return false;
            if (toDate && recordDate > toDate) return false;
            return true;
        });
        
        renderDTRRecords(filtered);
    });

    document.getElementById('dtr-reset-btn')?.addEventListener('click', () => {
        document.getElementById('dtr-date-from').value = '';
        document.getElementById('dtr-date-to').value = '';
        renderDTRRecords(allDTRRecords);
    });

    // Weekly Activities Filter handlers
    document.getElementById('weekly-filter-btn')?.addEventListener('click', () => {
        const fromDate = document.getElementById('weekly-date-from').value;
        const toDate = document.getElementById('weekly-date-to').value;
        
        if (!fromDate && !toDate) {
            renderWeeklyActivities(allActivities);
            return;
        }
        
        const filtered = allActivities.filter(activity => {
            const activityDate = activity.date;
            if (!activityDate) return false;
            
            if (fromDate && activityDate < fromDate) return false;
            if (toDate && activityDate > toDate) return false;
            return true;
        });
        
        renderWeeklyActivities(filtered);
    });

    document.getElementById('weekly-reset-btn')?.addEventListener('click', () => {
        document.getElementById('weekly-date-from').value = '';
        document.getElementById('weekly-date-to').value = '';
        renderWeeklyActivities(allActivities);
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredStudents = allStudents.filter(s => s.name.toLowerCase().includes(searchTerm) || s.idNumber.toLowerCase().includes(searchTerm) || (s.company || '').toLowerCase().includes(searchTerm));
            renderStudents(filteredStudents);
        });
    }

    window.viewStudentDetails = async function(studentId) {
        const student = allStudents.find(s => s.idNumber === studentId);
        if (!student) return alert('Student data not found.');

        document.getElementById('modal-student-name').textContent = student.name;
        document.getElementById('modal-student-id').textContent = student.idNumber;
        document.getElementById('modal-student-avatar').src = student.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;

        const companyDetails = student.companyDetails || {};
        const logoImg = document.getElementById('modal-company-logo');
        logoImg.src = companyDetails.logoUrl || 'https://via.placeholder.com/100';
        logoImg.onerror = () => {
            logoImg.src = 'https://via.placeholder.com/100';
        };
        document.getElementById('modal-company-name').textContent = companyDetails.name || 'N/A';
        document.getElementById('modal-company-address').textContent = companyDetails.address || 'N/A';
        document.getElementById('modal-supervisor-name').textContent = companyDetails.supervisor || 'N/A';
        document.getElementById('modal-hr-name').textContent = companyDetails.hr || 'N/A';
        document.getElementById('modal-company-email').textContent = companyDetails.email || 'N/A';
        document.getElementById('modal-company-landline').textContent = companyDetails.landline || 'N/A';

        document.getElementById('view-dtr-btn').onclick = () => viewStudentDTR(student);
        const weeklyBtn = document.getElementById('view-weekly-report-btn');
        if (weeklyBtn) {
            weeklyBtn.onclick = () => viewStudentWeeklyReport(student);
        }
        openModal(viewModal);

        const docList = document.getElementById('documents-list');
        docList.innerHTML = '<li>Loading documents...</li>';
        try {
            const response = await fetch(`${API_BASE}/api/requirements/${adviserInfo.department}/${adviserInfo.section}/${student.idNumber}`);
            if (!response.ok) throw new Error('Failed to fetch requirements');
            renderDocumentList(await response.json());
        } catch (error) {
            console.error('Error fetching requirements:', error);
            docList.innerHTML = '<li>Error loading documents.</li>';
        }
    }

    let currentDTRStudent = null;
    let allDTRRecords = [];

    async function viewStudentDTR(student) {
        currentDTRStudent = student;
        document.getElementById('dtr-modal-student-name').textContent = `${student.name}'s DTR`;
        document.getElementById('dtr-modal-subtitle').textContent = `Student Number: ${student.idNumber}`;
        
        // Reset date filters
        document.getElementById('dtr-date-from').value = '';
        document.getElementById('dtr-date-to').value = '';
        
        const dtrContainer = document.getElementById('dtr-records-container');
        dtrContainer.innerHTML = '<p style="text-align: center; padding: 20px; color: #6b7280;"><i class="fas fa-spinner fa-spin"></i> Loading DTR records...</p>';
        
        openModal(dtrModal);
        
        try {
            // Fetch DTR records from Firestore
            // Path: students/{course}/{section}/{studentnumber}/dtr/
            const dtrRef = db.collection('students')
                .doc(adviserInfo.department)
                .collection(adviserInfo.section)
                .doc(student.idNumber)
                .collection('dtr');
            
            const snapshot = await dtrRef.orderBy('date', 'desc').get();
            
            // Store all records for filtering
            allDTRRecords = [];
            snapshot.forEach(doc => {
                allDTRRecords.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            renderDTRRecords(allDTRRecords);
            
        } catch (error) {
            console.error('Error fetching DTR records:', error);
            dtrContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px;"></i>
                    <p style="font-size: 16px;">Failed to load DTR records. Please try again.</p>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 8px;">${error.message}</p>
                </div>
            `;
        }
    }

    function renderDTRRecords(records) {
        const dtrContainer = document.getElementById('dtr-records-container');
            
            if (records.length === 0) {
                dtrContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #6b7280;">
                        <i class="fas fa-calendar-times" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p style="font-size: 16px;">No DTR records found for this date range.</p>
                    </div>
                `;
                return;
            }
            
            // Group records by date
            const recordsByDate = {};
            records.forEach(data => {
                const date = data.date || 'Unknown Date';
                
                if (!recordsByDate[date]) {
                    recordsByDate[date] = [];
                }
                
                recordsByDate[date].push(data);
            });
            
            // Sort dates in descending order
            const sortedDates = Object.keys(recordsByDate).sort((a, b) => {
                return new Date(b) - new Date(a);
            });
            
            // Build the HTML
            let html = '';
            
            sortedDates.forEach(date => {
                const records = recordsByDate[date];
                const dateObj = new Date(date);
                const formattedDate = dateObj.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                html += `
                    <div style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <div style="background: #f3f4f6; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #374151;">
                                <i class="fas fa-calendar-day" style="margin-right: 8px; color: #4361ee;"></i>
                                ${formattedDate}
                            </h4>
                        </div>
                        <div style="padding: 16px;">
                `;
                
                records.forEach(record => {
                    const timeIn = record.time_in || 'N/A';
                    const timeOut = record.time_out || 'Not yet clocked out';
                    const renderedHours = record.rendered_hours || 0;
                    const totalBreakMinutes = record.total_break_minutes || 0;
                    const remarks = record.remarks || '';
                    const entryType = record.entry_type || 'manual';
                    
                    const hoursDisplay = renderedHours > 0 ? `${renderedHours.toFixed(2)} hrs` : '0 hrs';
                    const breakDisplay = totalBreakMinutes > 0 ? `${totalBreakMinutes} mins` : 'None';
                    
                    html += `
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 12px; background: #f9fafb; border-radius: 6px; margin-bottom: 12px;">
                            <div>
                                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Time In</div>
                                <div style="font-size: 14px; font-weight: 600; color: #059669;">
                                    <i class="fas fa-arrow-right" style="margin-right: 6px;"></i>
                                    ${timeIn}
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Time Out</div>
                                <div style="font-size: 14px; font-weight: 600; color: #dc2626;">
                                    <i class="fas fa-arrow-left" style="margin-right: 6px;"></i>
                                    ${timeOut}
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Hours Rendered</div>
                                <div style="font-size: 14px; font-weight: 600; color: #4361ee;">
                                    <i class="fas fa-clock" style="margin-right: 6px;"></i>
                                    ${hoursDisplay}
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Break Time</div>
                                <div style="font-size: 14px; font-weight: 600; color: #f59e0b;">
                                    <i class="fas fa-coffee" style="margin-right: 6px;"></i>
                                    ${breakDisplay}
                                </div>
                            </div>
                            ${remarks ? `
                            <div style="grid-column: 1 / -1;">
                                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Remarks</div>
                                <div style="font-size: 14px; color: #374151; padding: 8px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
                                    ${remarks}
                                </div>
                            </div>
                            ` : ''}
                            <div style="grid-column: 1 / -1; text-align: right;">
                                <span style="font-size: 11px; color: #9ca3af; text-transform: uppercase;">
                                    <i class="fas fa-${entryType === 'auto' ? 'robot' : 'pen'}" style="margin-right: 4px;"></i>
                                    ${entryType} entry
                                </span>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            // Add summary statistics at the top
            let totalHours = 0;
            let totalBreak = 0;
            let totalDays = sortedDates.length;
            
            Object.values(recordsByDate).forEach(records => {
                records.forEach(record => {
                    totalHours += record.rendered_hours || 0;
                    totalBreak += record.total_break_minutes || 0;
                });
            });
            
            const summaryHtml = `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                        <div style="text-align: center; padding: 16px; background: rgba(255,255,255,0.15); border-radius: 8px; backdrop-filter: blur(10px);">
                            <div style="font-size: 12px; color: rgba(255,255,255,0.9); margin-bottom: 6px; font-weight: 500;">Total Days</div>
                            <div style="font-size: 28px; font-weight: 700; color: white;">${totalDays}</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: rgba(255,255,255,0.15); border-radius: 8px; backdrop-filter: blur(10px);">
                            <div style="font-size: 12px; color: rgba(255,255,255,0.9); margin-bottom: 6px; font-weight: 500;">Total Hours</div>
                            <div style="font-size: 28px; font-weight: 700; color: white;">${totalHours.toFixed(2)}</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: rgba(255,255,255,0.15); border-radius: 8px; backdrop-filter: blur(10px);">
                            <div style="font-size: 12px; color: rgba(255,255,255,0.9); margin-bottom: 6px; font-weight: 500;">Total Break</div>
                            <div style="font-size: 28px; font-weight: 700; color: white;">${Math.round(totalBreak)}<span style="font-size: 14px; margin-left: 4px;">min</span></div>
                        </div>
                    </div>
                </div>
            `;
            
            dtrContainer.innerHTML = summaryHtml + html;
    }

    let currentWeeklyStudent = null;
    let allActivities = [];

    async function viewStudentWeeklyReport(student) {
        currentWeeklyStudent = student;
        document.getElementById('weekly-report-student-name').textContent = `${student.name}'s Weekly Activities`;
        document.getElementById('weekly-report-subtitle').textContent = `Student Number: ${student.idNumber}`;
        
        // Reset date filters
        document.getElementById('weekly-date-from').value = '';
        document.getElementById('weekly-date-to').value = '';
        
        const activitiesContainer = document.getElementById('weekly-activities-container');
        activitiesContainer.innerHTML = '<p style="text-align: center; padding: 20px; color: #6b7280;"><i class="fas fa-spinner fa-spin"></i> Loading activities...</p>';
        
        const weeklyReportModal = document.getElementById('weekly-report-modal');
        openModal(weeklyReportModal);
        
        try {
            // Fetch activities from Firestore
            // Path: students/{course}/{section}/{studentnumber}/activities/{dateofactivities}
            const activitiesRef = db.collection('students')
                .doc(adviserInfo.department)
                .collection(adviserInfo.section)
                .doc(student.idNumber)
                .collection('activities');
            
            const snapshot = await activitiesRef.orderBy('date', 'desc').get();
            
            // Store all activities for filtering
            allActivities = [];
            snapshot.forEach(doc => {
                allActivities.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            renderWeeklyActivities(allActivities);
            
        } catch (error) {
            console.error('Error fetching activities:', error);
            activitiesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px;"></i>
                    <p style="font-size: 16px;">Failed to load activities. Please try again.</p>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 8px;">${error.message}</p>
                </div>
            `;
        }
    }

    function renderWeeklyActivities(activities) {
        const activitiesContainer = document.getElementById('weekly-activities-container');
        
        if (activities.length === 0) {
            activitiesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <i class="fas fa-clipboard-list" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p style="font-size: 16px;">No activities found for this date range.</p>
                </div>
            `;
            return;
        }
        
        // Group activities by date
        const activitiesByDate = {};
        activities.forEach(activity => {
                const dateKey = activity.date || activity.id;
                
                if (!activitiesByDate[dateKey]) {
                    activitiesByDate[dateKey] = [];
                }
                activitiesByDate[dateKey].push(activity);
            });
            
            // Sort dates descending
            const sortedDates = Object.keys(activitiesByDate).sort((a, b) => b.localeCompare(a));
            
            let html = '<div style="display: flex; flex-direction: column; gap: 20px;">';
            
            sortedDates.forEach(dateKey => {
                const activities = activitiesByDate[dateKey];
                const formattedDate = new Date(dateKey).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                html += `
                    <div style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                            <i class="fas fa-calendar-day" style="font-size: 16px; color: #10b981; line-height: 1;"></i>
                            <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #1f2937; line-height: 1;">${formattedDate}</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                `;
                
                activities.forEach((activity, index) => {
                    const description = activity.description || 'No description provided';
                    const mapImage = activity.mapImage || '';
                    const photos = activity.photos || [];
                    
                    html += `
                        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; border-left: 3px solid #10b981;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <span style="background: #10b981; color: white; width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px;">
                                    ${index + 1}
                                </span>
                                <h4 style="margin: 0; font-size: 13px; font-weight: 600; color: #374151;">Activity Description</h4>
                            </div>
                            <p style="margin: 0 0 16px 0; font-size: 14px; color: #1f2937; line-height: 1.5; padding-left: 4px;">${description}</p>
                    `;
                    
                    // Display images in a single row if available
                    const hasMedia = mapImage || photos.length > 0;
                    if (hasMedia) {
                        html += `
                            <div style="display: flex; gap: 8px; overflow-x: auto; padding: 4px 0;">
                        `;
                        
                        // Add map image first
                        if (mapImage) {
                            html += `
                                <div style="flex-shrink: 0;">
                                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px; font-weight: 500;">
                                        <i class="fas fa-map-marker-alt" style="font-size: 10px;"></i> Location
                                    </div>
                                    <img src="${mapImage}" alt="Map" style="width: 140px; height: 140px; object-fit: cover; border-radius: 6px; border: 2px solid #d1d5db; cursor: pointer;" onclick="window.open('${mapImage}', '_blank')">
                                </div>
                            `;
                        }
                        
                        // Add activity photos
                        photos.forEach((photo, photoIndex) => {
                            html += `
                                <div style="flex-shrink: 0;">
                                    ${photoIndex === 0 ? `<div style="font-size: 11px; color: #6b7280; margin-bottom: 4px; font-weight: 500;"><i class="fas fa-camera" style="font-size: 10px;"></i> Photos</div>` : '<div style="height: 15px;"></div>'}
                                    <img src="${photo}" alt="Photo ${photoIndex + 1}" style="width: 140px; height: 140px; object-fit: cover; border-radius: 6px; border: 2px solid #d1d5db; cursor: pointer;" onclick="window.open('${photo}', '_blank')">
                                </div>
                            `;
                        });
                        
                        html += `
                            </div>
                        `;
                    }
                    
                    html += `</div>`;
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            // Add summary statistics at the top
            const totalActivities = activities.length;
            const totalDays = sortedDates.length;
            let totalPhotos = 0;
            
            activities.forEach(activity => {
                totalPhotos += (activity.photos || []).length;
            });
            
            const summaryHtml = `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; color: white;">
                    <div style="text-align: center;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Total Days</div>
                        <div style="font-size: 24px; font-weight: 700;">${totalDays}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Total Activities</div>
                        <div style="font-size: 24px; font-weight: 700;">${totalActivities}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Photos Uploaded</div>
                        <div style="font-size: 24px; font-weight: 700;">${totalPhotos}</div>
                    </div>
                </div>
            `;
            
            activitiesContainer.innerHTML = summaryHtml + html;
    }

    window.openDocumentViewer = function(docName, fileUrl) {
        const titleEl = document.getElementById('doc-viewer-title');
        const contentEl = document.getElementById('doc-viewer-content');
        if (!titleEl || !contentEl) return;

        titleEl.textContent = docName;
        contentEl.innerHTML = '<p>Loading document...</p>';

        if (/\.(jpeg|jpg|gif|png|webp)$/i.test(fileUrl)) {
            contentEl.innerHTML = `<img src="${fileUrl}" alt="${docName}">`;
        } else if (/\.pdf$/i.test(fileUrl)) {
            contentEl.innerHTML = `<embed src="${fileUrl}" type="application/pdf" />`;
        } else {
            contentEl.innerHTML = `<p>Cannot preview this file type.</p><br/><a href="${fileUrl}" target="_blank" class="action-btn">Download File</a>`;
        }
        openModal(docViewerModal);
    }

    // 3. I-load agad ang page gamit ang adviser info
    function initializePage() {
        displayHeaderInfo();
        fetchAndDisplayStudents(adviserInfo);
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

    initializePage();
});