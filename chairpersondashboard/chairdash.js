// Calendar and announcement features removed
// API base: when frontend is served from another port (e.g. Five Server :5500),
// point API calls to the backend running on :3000. When the page is served
// by the backend itself, keep using relative paths.
const API_BASE = (typeof window !== 'undefined' && window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed");

    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (sidebar) sidebar.classList.toggle('active');
        });
    }

    // Prefer sessionStorage.currentUser (set by the new login flow). Fall back to legacy localStorage.idNumber.
    let idNumber = null;
    try {
        const currentUserRaw = sessionStorage.getItem('currentUser');
        if (currentUserRaw) {
            const currentUser = JSON.parse(currentUserRaw);
            if (currentUser && currentUser.idNumber) {
                idNumber = currentUser.idNumber;
                // Populate header name immediately if available
                if (currentUser.name) {
                    document.getElementById('header-username').textContent = currentUser.name;
                    const headerAvatar = document.querySelector('.user-profile img');
                    if (headerAvatar) headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=3f37c9&color=fff`;
                }
                if (currentUser.department) {
                    document.getElementById('chairdepartment').textContent = currentUser.department;
                    localStorage.setItem('department', currentUser.department);
                }
            }
        }
    } catch (parseErr) {
        console.warn('Failed to parse sessionStorage.currentUser:', parseErr);
    }

    if (!idNumber) {
        idNumber = localStorage.getItem('idNumber');
    }

    if (!idNumber) {
        alert("No ID number found in storage. Please log in first.");
        // Redirect to the login page used in this project
        window.location.href = '/officelogin/officelogin.html';
        return;
    }
    console.log("Using idNumber:", idNumber);

    try {
    // Fetch user info
    const response = await fetch(`${API_BASE}/api/user-info/${idNumber}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error on user-info: ${response.status} - ${errorText}`);
        }
        const userData = await response.json();
        console.log("Received user data:", userData);

        // Populate header
        if (userData.name) {
            document.getElementById('header-username').textContent = userData.name;
            const headerAvatar = document.querySelector('.user-profile img');
            if(headerAvatar) headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=3f37c9&color=fff`;
        }

        if (!userData.department) {
            alert("Could not determine chairperson's department from user data.");
            return;
        }

        const department = userData.department;
        document.getElementById("chairdepartment").textContent = department;
        localStorage.setItem('department', department);
        
        // Load dashboard data
        loadDashboardData(department);

        // Announcement and calendar functionality removed for simplified dashboard

    } catch (error) {
        console.error("Error during initialization:", error);
        alert("An error occurred during initialization. Please try again.");
    }
});

async function loadDashboardData(department) {
    console.log(`Loading dashboard data for department: ${department}`);
    try {
        const url = `${API_BASE}/api/dashboard-data/${department}`;
        console.log(`Fetching dashboard data from: ${url}`);
        const response = await fetch(url);
        console.log("Dashboard data response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server responded with an error:", errorText);
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const data = await response.json();
        console.log("Received dashboard data:", data);

        document.getElementById('total-students').textContent = data.totalStudents || 0;
        document.getElementById('completed-ojts').textContent = data.completedOjts || 0;
        document.getElementById('total-companies-mou').textContent = data.totalCompaniesMOU || 0;
        document.getElementById('blocked-companies').textContent = data.blockedCompanies || 0;
        document.getElementById('pending-approvals').textContent = data.pendingCompanyApprovals || 0;
    } catch (error) {
        console.error("Error loading dashboard data:", error);
       
    }
}

function updateCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('current-date');
    if(dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
}

// Calendar and announcement initialization removed


window.viewStudentDetails = async function(studentId, sectionId) {
    // Prefer department from sessionStorage.currentUser, fallback to localStorage
    let chairpersonDepartment = null;
    try {
        const cur = sessionStorage.getItem('currentUser');
        if (cur) {
            const obj = JSON.parse(cur);
            if (obj && obj.department) chairpersonDepartment = obj.department;
        }
    } catch (e) { /* ignore */ }
    if (!chairpersonDepartment) chairpersonDepartment = localStorage.getItem('department');
    try {
    const response = await fetch(`${API_BASE}/api/student-details/${chairpersonDepartment}/${sectionId}/${studentId}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const { studentData, requirements } = await response.json();

        const modal = document.querySelector('.student-details-modal');
        const modalContent = document.getElementById('student-details-content');

        modalContent.innerHTML = `
            <div class="student-info-top">
                <h2>${studentData.name || 'Unknown Student'}</h2>
                <div class="student-id">Student Number: ${studentData.studentNumber || studentId}</div>
                <div class="student-meta">Course: ${studentData.course || 'N/A'} | Section: ${studentData.section || sectionId}</div>
            </div>
        `;
        
        const requiredDocs = ["COR", "MOA", "HTE"];
        let allApproved = true;

        requiredDocs.forEach(docName => {
            const doc = requirements[docName];
            if (doc) {
                const status = doc.status || 'Not submitted';
                const statusClass = getStatusClass(status);
                if (status !== 'Approved') allApproved = false;
                const submittedAt = doc.submittedAt ? formatDate(new Date(doc.submittedAt._seconds * 1000)) : 'N/A';

                modalContent.innerHTML += `
                    <div class="requirement-card">
                        <div class="requirement-header">
                            <h3 class="requirement-title">${docName}</h3>
                            <span class="requirement-status ${statusClass}">${status}</span>
                        </div>
                        <div class="requirement-content">
                             <p>Submitted: ${submittedAt}</p>
                             <p>Reviewed by: ${doc.reviewedBy || 'Not yet reviewed'}</p>
                             ${doc.submitRequirements ? `<a href="${doc.submitRequirements}" target="_blank" class="file-link">View Document</a>` : 'No document uploaded'}
                        </div>
                    </div>
                `;
            } else {
                allApproved = false;
                 modalContent.innerHTML += `
                    <div class="requirement-card">
                        <div class="requirement-header">
                            <h3 class="requirement-title">${docName}</h3>
                            <span class="requirement-status status-not-started">Not submitted</span>
                        </div>
                        <div class="requirement-content"><p>No document submitted yet</p></div>
                    </div>
                `;
            }
        });

        if (allApproved && requirements['HTE']?.status === 'Approved') {
            if (studentData.eligibleForOJT) {
                 modalContent.innerHTML += `
                    <div class="eligible-container" style="color: var(--success-color);">
                        <i class="fas fa-check-circle"></i> 
                        Student is already marked as eligible for OJT
                    </div>
                `;
            } else {
                modalContent.innerHTML += `
                    <div class="eligible-container">
                        <button class="eligible-btn" onclick="markEligibleForOJT('${studentId}', '${sectionId}')">
                            <i class="fas fa-check-circle"></i> Mark Eligible for OJT
                        </button>
                    </div>
                `;
            }
        } else {
             modalContent.innerHTML += `
                <div class="eligible-container" style="color: var(--warning-color);">
                    <i class="fas fa-exclamation-triangle"></i> 
                    All requirements (COR, MOA, HTE) must be approved to mark this student eligible for OJT
                </div>
            `;
        }

        if(modal) {
            modal.classList.add('active');
            modal.addEventListener('click', function(event) {
                if (event.target === modal) {
                    closeStudentModal();
                }
            });
        }

    } catch (error) {
        console.error("Error viewing student details:", error);
        alert("Failed to load student details: " + error.message);
    }
};

window.closeStudentModal = function() {
    const modal = document.querySelector('.student-details-modal');
    if(modal) modal.classList.remove('active');
};

window.markEligibleForOJT = async function(studentId, sectionId) {
    const confirmed = confirm("Are you sure you want to mark this student as eligible for OJT?");
    if (!confirmed) return;

    // When marking eligible, prefer sessionStorage.currentUser values
    let chairpersonDepartment = null;
    let chairpersonName = 'Chairperson';
    try {
        const cur = sessionStorage.getItem('currentUser');
        if (cur) {
            const obj = JSON.parse(cur);
            if (obj) {
                chairpersonDepartment = obj.department || null;
                chairpersonName = obj.name || chairpersonName;
            }
        }
    } catch (e) { /* ignore */ }
    if (!chairpersonDepartment) chairpersonDepartment = localStorage.getItem('department');
    if (!chairpersonName) chairpersonName = localStorage.getItem('userName') || 'Chairperson';

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
