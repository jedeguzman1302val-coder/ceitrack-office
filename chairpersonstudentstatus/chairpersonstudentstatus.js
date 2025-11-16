let allStudents = [];
const API_BASE = (typeof window !== 'undefined' && window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';

document.addEventListener('DOMContentLoaded', async () => {
    // Sidebar toggle behavior (match other pages)
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Prefer sessionStorage.currentUser (set by login) and fall back to legacy localStorage
    let idNumber = null;
    try {
        const cur = sessionStorage.getItem('currentUser');
        if (cur) {
            const obj = JSON.parse(cur);
            if (obj && obj.idNumber) idNumber = obj.idNumber;
        }
    } catch (e) { /* ignore parse errors */ }
    if (!idNumber) idNumber = localStorage.getItem('idNumber');
    if (!idNumber) {
        alert("No ID number found. Please log in first.");
        window.location.href = '/officelogin/officelogin.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/user-info/${idNumber}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const userData = await response.json();

        if (userData.name) {
            document.getElementById('header-username').textContent = userData.name;
            const headerAvatar = document.querySelector('.user-profile img');
            if (headerAvatar) {
                headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=3f37c9&color=fff`;
            }
        }

        if (userData.department) {
            document.getElementById("chairdepartment").textContent = userData.department;
            loadStudentsTable(userData.department);
        } else {
            alert("Could not determine chairperson's department.");
        }
    } catch (error) {
        console.error("Error fetching user info:", error);
        alert("Failed to fetch user information. Please check the console for more details.");
    }

    document.getElementById('section-filter').addEventListener('change', (event) => {
        const selectedSection = event.target.value;
        if (selectedSection === 'all') {
            renderTable(allStudents);
        } else {
            const filteredStudents = allStudents.filter(student => student.section === selectedSection);
            renderTable(filteredStudents);
        }
    });
});

async function loadStudentsTable(department) {
    try {
    const response = await fetch(`${API_BASE}/api/students/${department}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        allStudents = await response.json();
        populateSectionFilter();
        renderTable(allStudents);
    } catch (error) {
        console.error("Error loading students table:", error);
        document.getElementById('students-table-body').innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>Failed to load student data: ${error.message}</div>
                </td>
            </tr>
        `;
    }
}

function populateSectionFilter() {
    const filter = document.getElementById('section-filter');
    const sections = [...new Set(allStudents.map(student => student.section))];
    sections.sort();

    const existingOptions = filter.querySelectorAll('option:not([value="all"])');
    existingOptions.forEach(option => option.remove());

    sections.forEach(section => {
        if (section) { 
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            filter.appendChild(option);
        }
    });
}

function renderTable(students) {
    const tableBody = document.getElementById('students-table-body');
    tableBody.innerHTML = '';

    if (students.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <div>No students found for the selected section</div>
                </td>
            </tr>
        `;
        return;
    }

    students.forEach(student => {
        const progress = student.progress;
        const status = student.status;

        let statusBadge = '';
        if (status === 'Completed') {
            statusBadge = '<span class="status-badge status-completed">Completed</span>';
        } else if (status === 'In Progress') {
            statusBadge = '<span class="status-badge status-in-progress">In Progress</span>';
        } else {
            statusBadge = '<span class="status-badge status-not-started">Not Started</span>';
        }

        let progressBarClass = '';
        if (progress >= 75) progressBarClass = 'high';
        else if (progress >= 30) progressBarClass = 'medium';
        else progressBarClass = 'low';

        const progressBarHTML = `
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill ${progressBarClass}" style="width: ${progress}%;"></div>
                </div>
                <span>${progress}%</span>
            </div>
        `;

        const companyCellHTML = student.hteStatus && student.hteStatus.toLowerCase() === 'pending'
            ? '<td>Pending</td>'
            : `<td>${student.companyName}</td>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.name}</td>
            <td>${student.studentNumber}</td>
            <td>${student.section}</td>
            ${companyCellHTML}
            <td>${statusBadge}</td>
            <td>${progressBarHTML}</td>
            <td>
                <button class="action-btn view-btn" onclick="viewStudentDetails('${student.id}', '${student.section}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

window.viewStudentDetails = async function(studentId, sectionId) {
    const chairpersonDepartment = localStorage.getItem('department');
    try {
    const response = await fetch(`${API_BASE}/api/student-details/${chairpersonDepartment}/${sectionId}/${studentId}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const { studentData } = await response.json();

        const modal = document.querySelector('.student-details-modal');
        const modalContent = document.getElementById('student-details-content');

        // Generate DTR entries HTML
        let dtrEntriesHTML = '';
        if (studentData.dtrEntries && studentData.dtrEntries.length > 0) {
            dtrEntriesHTML = studentData.dtrEntries.map(entry => `
                <div class="dtr-entry">
                    <div class="dtr-entry-header">
                        <span class="dtr-date"><i class="fas fa-calendar"></i> ${entry.date || 'N/A'}</span>
                        <span class="dtr-hours"><i class="fas fa-clock"></i> ${entry.rendered_hours || 0} hours</span>
                    </div>
                    <div class="dtr-entry-details">
                        <div><strong>Day:</strong> ${entry.day_of_week || 'N/A'}</div>
                        <div><strong>Time:</strong> ${entry.time_in || 'N/A'} - ${entry.time_out || 'N/A'}</div>
                        <div><strong>Remarks:</strong> ${entry.remarks || 'None'}</div>
                    </div>
                </div>
            `).join('');
        } else {
            dtrEntriesHTML = '<p class="no-data">No DTR entries yet</p>';
        }

        modalContent.innerHTML = `
            <div class="student-info-top">
                <h2>${studentData.name || 'Unknown Student'}</h2>
                <div class="student-id">Student Number: ${studentData.studentNumber || studentId}</div>
                <div class="student-meta">Course: ${studentData.course || 'N/A'} | Section: ${studentData.section || sectionId}</div>
            </div>

            <div class="company-info-card">
                <div class="section-title">
                    <i class="fas fa-building"></i>
                    Company Information (HTE)
                </div>
                <div class="company-details">
                    <div class="company-detail">
                        <span class="detail-label">Company Name</span>
                        <span class="detail-value">${studentData.companyName || 'Not assigned'}</span>
                    </div>
                    <div class="company-detail">
                        <span class="detail-label">Address</span>
                        <span class="detail-value">${studentData.companyAddress || 'N/A'}</span>
                    </div>
                    <div class="company-detail">
                        <span class="detail-label">Representative</span>
                        <span class="detail-value">${studentData.companyRepresentative || 'N/A'}</span>
                    </div>
                    <div class="company-detail">
                        <span class="detail-label">Designation</span>
                        <span class="detail-value">${studentData.companyDesignation || 'N/A'}</span>
                    </div>
                    <div class="company-detail">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${studentData.companyEmail || 'N/A'}</span>
                    </div>
                    <div class="company-detail">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${studentData.companyPhone || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div class="company-info-card">
                <div class="section-title">
                    <i class="fas fa-calendar-check"></i>
                    DTR Summary
                </div>
                <div class="company-details">
                    <div class="company-detail">
                        <span class="detail-label">Total Hours Rendered</span>
                        <span class="detail-value" style="font-size: 18px; color: var(--primary-color); font-weight: 600;">
                            ${studentData.totalHoursRendered || 0} hours
                        </span>
                    </div>
                    <div class="company-detail">
                        <span class="detail-label">Progress</span>
                        <div class="progress-bar-detail">
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div class="progress-fill ${(studentData.totalHoursRendered || 0) >= 450 ? 'high' : (studentData.totalHoursRendered || 0) >= 200 ? 'medium' : 'low'}" 
                                         style="width: ${Math.min(Math.round(((studentData.totalHoursRendered || 0) / 600) * 100), 100)}%;"></div>
                                </div>
                                <span>${Math.min(Math.round(((studentData.totalHoursRendered || 0) / 600) * 100), 100)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="company-info-card">
                <div class="section-title">
                    <i class="fas fa-list"></i>
                    Recent DTR Entries (Last 10)
                </div>
                <div class="dtr-entries-container">
                    ${dtrEntriesHTML}
                </div>
            </div>
        `;

        modal.classList.add('active');
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeStudentModal();
            }
        });

    } catch (error) {
        console.error("Error viewing student details:", error);
        alert("Failed to load student details: " + error.message);
    }
};

window.closeStudentModal = function() {
    document.querySelector('.student-details-modal').classList.remove('active');
};

window.markEligibleForOJT = async function(studentId, sectionId) {
    const confirmed = confirm("Are you sure you want to mark this student as eligible for OJT?");
    if (!confirmed) return;

    const chairpersonDepartment = localStorage.getItem('department');
    const chairpersonName = localStorage.getItem('userName') || 'Chairperson';

    try {
    const response = await fetch(`${API_BASE}/api/students/${chairpersonDepartment}/${sectionId}/${studentId}/mark-eligible`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ chairpersonName })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        alert("Student has been marked as eligible for OJT successfully!");
        viewStudentDetails(studentId, sectionId);
        loadStudentsTable(chairpersonDepartment);

    } catch (error) {
        console.error("Error marking student as eligible:", error);
        alert("Failed to mark student as eligible: " + error.message);
    }
};

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusClass(status) {
    if (!status) return 'status-not-started';
    status = status.toLowerCase();
    if (status === 'approved') return 'status-completed';
    if (status === 'pending') return 'status-in-progress';
    if (status === 'rejected') return 'status-at-risk';
    return 'status-not-started';
}