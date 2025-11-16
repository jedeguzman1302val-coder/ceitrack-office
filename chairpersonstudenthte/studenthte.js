// Runtime API base: when the frontend is served from a different port (e.g. Five Server :5500)
// point API calls to the backend on :3000 during local development.
const API_BASE = (typeof window !== 'undefined' && window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed");

    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const mainContent = document.querySelector('.main-content-wrapper');

    // API_BASE is declared at module scope above so other functions can use it.

    // Always start with sidebar closed
    if (sidebar) sidebar.classList.remove('active');
    console.log('Sidebar initially inactive (default)');
    // Clear any saved preference
    try { localStorage.removeItem('sidebarActive'); } catch (e) { /* ignore */ }

    if (sidebarToggle && sidebar && mainContent) {
        console.log('Sidebar elements found, setting up toggle');

        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Toggle button clicked');

            sidebar.classList.toggle('active');
            const isActive = sidebar.classList.contains('active');
            // Persist preference
            try { localStorage.setItem('sidebarActive', isActive ? 'true' : 'false'); } catch (e) { /* ignore */ }
            console.log('Sidebar active state:', isActive);

            // Toggle visibility of icons
            const barsIcon = sidebarToggle.querySelector('.fa-bars');
            const timesIcon = sidebarToggle.querySelector('.fa-times');

            if (barsIcon && timesIcon) {
                barsIcon.style.display = isActive ? 'none' : 'block';
                timesIcon.style.display = isActive ? 'block' : 'none';
                console.log('Icons toggled');
            }

            // Adjust main content margin
            if (window.innerWidth > 768) {
                mainContent.style.marginLeft = isActive ? '260px' : '0';
                console.log('Main content margin adjusted');
            }
        });
    } else {
        console.warn('Some sidebar elements not found:', {
            sidebar: !!sidebar,
            toggle: !!sidebarToggle,
            mainContent: !!mainContent
        });
    }

    // Prefer sessionStorage.currentUser (new login flow), fallback to localStorage
    let idNumber = null;
    try {
        const cur = sessionStorage.getItem('currentUser');
        if (cur) {
            const obj = JSON.parse(cur);
            if (obj && obj.idNumber) {
                idNumber = obj.idNumber;
                if (obj.name) {
                    const headerEl = document.getElementById('header-username');
                    if (headerEl) headerEl.textContent = obj.name;
                }
                if (obj.department) {
                    const deptEl = document.getElementById('chairdepartment');
                    if (deptEl) deptEl.textContent = obj.department;
                    // Load students for this department
                    await loadStudents(obj.department);
                }
            }
        }
    } catch (e) { console.warn('Failed to parse sessionStorage.currentUser', e); }

    if (!idNumber) {
        idNumber = localStorage.getItem('idNumber');
        console.log("Fallback to localStorage idNumber:", idNumber);
        if (idNumber) {
            try {
                const response = await fetch(`${API_BASE}/api/user-info/${idNumber}`);
                if (response.ok) {
                    const userData = await response.json();
                    if (userData.name) {
                        const headerEl = document.getElementById('header-username');
                        if (headerEl) headerEl.textContent = userData.name;
                    }
                    if (userData.department) {
                        const deptEl = document.getElementById('chairdepartment');
                        if (deptEl) deptEl.textContent = userData.department;
                        await loadStudents(userData.department);
                    }
                }
            } catch (error) {
                console.error("Error fetching user info:", error);
            }
        }
    }

    // Add search input event listener
    if (studentSearch) {
        studentSearch.addEventListener('input', filterStudents);
    }
});

// Track selected student and section
let selectedStudent = null;
let selectedSection = null;

// Cache last known company data per student to avoid losing UI after status updates
// Persisted to localStorage with a short TTL so reload keeps the UI consistent for a short time.
const COMPANY_CACHE_KEY = 'companyCache_v1';
const COMPANY_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

let companyCache = loadCacheFromStorage();

function loadCacheFromStorage() {
    try {
        const raw = localStorage.getItem(COMPANY_CACHE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        const now = Date.now();
        const out = {};
        Object.entries(parsed).forEach(([k, v]) => {
            if (v && v._ts && (now - v._ts) <= COMPANY_CACHE_TTL) {
                out[k] = v.data;
            }
        });
        return out;
    } catch (e) {
        console.warn('Failed to load company cache from storage', e);
        return {};
    }
}

function saveCacheToStorage() {
    try {
        const now = Date.now();
        const toSave = {};
        Object.entries(companyCache).forEach(([k, v]) => {
            toSave[k] = { _ts: now, data: v };
        });
        localStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save company cache to storage', e);
    }
}

// Note: API_BASE (above) is used for API calls. No API_URL is necessary.

// Function to fetch students from backend
async function fetchStudentsFromBackend(department) {
    try {
        const response = await fetch(`${API_BASE}/api/students/${department}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const students = await response.json();
        return students;
    } catch (error) {
        console.error('Error fetching students:', error);
        return [];
    }
}

// Function to update student status in backend
async function updateStudentStatus(department, studentId, status) {
    try {
        const response = await fetch(`${API_BASE}/api/students/${department}/${studentId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error updating student status:', error);
        throw error;
    }
}

// DOM Elements
const studentList = document.getElementById("studentList");
const contentEmpty = document.getElementById("contentEmpty");
const contentLoaded = document.getElementById("contentLoaded");
const studentSearch = document.getElementById("studentSearch");

// Back button functionality
function backPage() {
  window.location.href = "/chair/chairdash.html";
}

let currentSection = 'all';
let searchTerm = '';

function filterStudents() {
  searchTerm = studentSearch.value.toLowerCase();
  applyFilters();
}

function filterBySection(section) {
  currentSection = section;
  
  // Update active tab
  document.querySelectorAll('.section-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.section === section);
  });
  
  applyFilters();
}

function applyFilters() {
  const items = document.getElementsByClassName('student-item');
  
  for (let item of items) {
    const text = item.textContent.toLowerCase();
    const itemSection = item.dataset.section;
    const matchesSearch = text.includes(searchTerm);
    const matchesSection = currentSection === 'all' || itemSection === currentSection;
    
    item.classList.toggle('hidden', !(matchesSearch && matchesSection));
  }
}

// Function to load students for the department
async function loadStudents(department) {
    try {
        const students = await fetchStudentsFromBackend(department);
        if (students.length === 0) {
            contentEmpty.style.display = "block";
            contentLoaded.style.display = "none";
            return;
        }

        // On load, show the empty state and hide the details panel
        contentEmpty.style.display = "flex";
        contentLoaded.style.display = "none";
        
        // Also ensure the empty state has the correct default text
        const emptyStateH3 = contentEmpty.querySelector('h3');
        if (emptyStateH3) {
            emptyStateH3.textContent = 'Select A Student';
        }

        // Clear existing list
        studentList.innerHTML = '';

        // Group students by section
        const sections = {};
        students.forEach(student => {
            if (!sections[student.section]) {
                sections[student.section] = [];
            }
            sections[student.section].push(student);
        });

        // Populate section filter dropdown
        const sectionFilter = document.getElementById('sectionFilter');
        if (sectionFilter) {
            sectionFilter.innerHTML = `
                <option value="all">All Sections</option>
                ${Object.keys(sections).map(section => 
                    `<option value="${section}">${section}</option>`
                ).join('')}
            `;
        }
        // The section tabs have been replaced by a dropdown filter.
        // This line is no longer needed.

        // Add students to the list
        Object.entries(sections).forEach(([section, sectionStudents]) => {
            sectionStudents.forEach(student => {
                const studentItem = createStudentListItem(student, section);
                studentList.appendChild(studentItem);
            });
        });

    } catch (error) {
        console.error('Error loading students:', error);
        contentEmpty.style.display = "block";
        contentLoaded.style.display = "none";
    }
}

// Function to create student list item
function createStudentListItem(student, section) {
    const item = document.createElement('div');
    item.className = 'student-item';
    item.dataset.section = section;
    item.dataset.student = student.studentNumber;

    const status = student.hteStatus || "NO COMPANY";
    const statusClass = status === "Approved" ? "approved-badge" : 
                       status === "Pending" ? "pending-badge" : "no-company-badge";
    
    const studentName = student.name || "Unknown Student";
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=random&color=fff&rounded=true&size=40`;

    item.innerHTML = `
        <button class="student-btn" onclick="fetchStudentCompany('${student.course || localStorage.getItem('department')}', '${section}', '${student.studentNumber}')">
            <img src="${avatarUrl}" alt="Avatar" class="student-avatar">
            <div class="student-details">
                <span class="student-name">${studentName}</span>
                <span class="student-meta">${student.studentNumber} • ${section}</span>
            </div>
            <div class="student-status">
                <span class="status-badge ${statusClass}">${status}</span>
                <i class="fas fa-chevron-right"></i>
            </div>
        </button>
    `;
    return item;
}

// Function to update student status
async function updateStatus(studentId, status) {
    try {
        const department = document.getElementById('chairdepartment').textContent;
        await updateStudentStatus(department, studentId, status);
        // Reload the students list to show updated status
        await loadStudents(department);
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update student status. Please try again.');
    }
}

// Fetch all students and display in sidebar
async function fetchStudents() {
    const studentList = document.getElementById("studentList");
    
    // Show loading state
    studentList.innerHTML = '<li class="student-item"><div class="student-btn"><i class="fas fa-spinner fa-spin"></i> Loading students...</div></li>';

    // Get officer info
    const officerNumber = localStorage.getItem("idNumber");

    if (!officerNumber) {
        studentList.innerHTML = '<li class="student-item"><div class="student-btn">Officer not logged in</div></li>';
        return;
    }

    try {
        // Get department from localStorage
        const department = localStorage.getItem('department');
        if (!department) {
            studentList.innerHTML = '<li class="student-item"><div class="student-btn">Department not found</div></li>';
            return;
        }

    // Fetch students from backend
    const response = await fetch(`${API_BASE}/api/students/${department}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const students = await response.json();

        studentList.innerHTML = '';

        if (students.length === 0) {
            studentList.innerHTML = '<li class="student-item"><div class="student-btn">No students found in this department</div></li>';
            return;
        }

        // Group students by section
        const sections = {};
        students.forEach(student => {
            if (!sections[student.section]) {
                sections[student.section] = [];
            }
            sections[student.section].push(student);
        });

        // Create and append student list items
        Object.entries(sections).forEach(([section, sectionStudents]) => {
            sectionStudents.forEach(student => {
                const listItem = document.createElement("li");
                listItem.className = "student-item";
                listItem.dataset.section = section;
                listItem.dataset.student = student.studentNumber;

                const status = student.hteStatus || "NO COMPANY";
                const statusClass = status === "Approved" ? "approved-badge" : 
                                  status === "NO COMPANY" ? "no-company-badge" : "pending-badge";

                listItem.innerHTML = `
                    <button class="student-btn" onclick="fetchStudentCompany('${department}', '${section}', '${student.studentNumber}')">
                        <div class="student-info">
                            <span class="student-number">${student.studentNumber}</span>
                            <span class="student-name">${student.name || "Unknown Student"}</span>
                            <span class="student-section">${section}</span>
                        </div>
                        <div class="student-status">
                            <span class="${statusClass}">${status}</span>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </button>
                `;
                studentList.appendChild(listItem);
            });
        });

    } catch (error) {
        console.error("Error fetching students:", error);
        studentList.innerHTML = '<li class="student-item"><div class="student-btn"><i class="fas fa-exclamation-triangle"></i> Error loading students</div></li>';
    }
}

// Cleanup function
function cleanupStudentsListeners() {
    if (studentsListener) {
        studentsListener();
        studentsListener = null;
    }
}

// Fetch a student's company details
async function fetchStudentCompany(department, section, studentNumber) {
  selectedStudent = studentNumber;
  selectedSection = section;

  // Handle selected item UI
  document.querySelectorAll('.student-item').forEach(item => {
    item.classList.remove('selected');
  });
  const clickedItem = document.querySelector(`.student-item[data-student='${studentNumber}']`);
  if (clickedItem) {
    clickedItem.classList.add('selected');
  }
  
  // Show the details panel and hide the empty state immediately
  contentEmpty.style.display = "none";
  contentLoaded.style.display = "block";

  try {
    const response = await fetch(`${API_BASE}/api/company/${studentNumber}`, {
      // Suppress console errors for expected 404s
      credentials: 'same-origin'
    });
    
    // Handle 404 Not Found specifically as the "No Company" case (expected, not an error)
    if (response.status === 404) {
        console.log(`Student ${studentNumber} has no company submission.`);
        // Clear any cached data for this student
        delete companyCache[studentNumber];
        saveCacheToStorage();
        
        resetCompanyDetails(); // Show No Company state
        updateSidebarStatus(studentNumber, "NO COMPANY");
        return;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const companies = await response.json();
    
    if (!companies || companies.length === 0) {
        console.log(`Student ${studentNumber} has no company submission (empty response).`);
        // Clear any cached data for this student
        delete companyCache[studentNumber];
        saveCacheToStorage();
        
        resetCompanyDetails(); // Show No Company state
        updateSidebarStatus(studentNumber, "NO COMPANY");
        return;
    }

    // If company data exists, display the most recent one
    const mostRecentCompany = companies[0];
    
    // Only cache if we have valid company data
    if (mostRecentCompany && mostRecentCompany.hteName) {
        try { 
            companyCache[studentNumber] = mostRecentCompany;
            saveCacheToStorage();
        } catch (e) { 
            console.warn('Failed to cache company data:', e);
        }
        displayCompanyDetails(mostRecentCompany);
        updateSidebarStatus(studentNumber, mostRecentCompany.status || "Pending");
    } else {
        // Invalid company data, clear cache and show No Company
        delete companyCache[studentNumber];
        saveCacheToStorage();
        resetCompanyDetails();
        updateSidebarStatus(studentNumber, "NO COMPANY");
    }

  } catch (error) {
    console.error("Error fetching company details:", error);
    // Clear cache on error
    delete companyCache[studentNumber];
    saveCacheToStorage();
    
    // Show a proper error state in the details panel
    contentLoaded.style.display = "none";
    contentEmpty.style.display = "flex";
    const emptyH3 = contentEmpty.querySelector('h3');
    const emptyP = contentEmpty.querySelector('p');
    if (emptyH3) emptyH3.textContent = 'Error Loading Details';
    if (emptyP) emptyP.textContent = 'Could not fetch company information. Please try again later.';
  }
}

// Helper function to update a field with data or show "No Company"
function updateField(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element with id '${elementId}' not found`);
    return;
  }
  if (value) {
    element.textContent = value;
    element.classList.remove("empty-value");
  } else {
    element.textContent = "No Company";
    element.classList.add("empty-value");
  }
}
        
// Reset all company details to default state
function resetCompanyDetails() {
  // Reset logo
  const logoPreview = document.getElementById("logo-preview");
  if (logoPreview) {
    logoPreview.src = "https://via.placeholder.com/120?text=No+Logo";
  }

  // Reset website link
  const websiteElement = document.getElementById("companywebsite");
  if (websiteElement) {
    websiteElement.style.display = "none";
  }
  
  // Hide all action buttons
  const actionButtons = document.querySelector(".action-buttons");
  if (actionButtons) {
    actionButtons.style.display = "none";
  }

  // Hide buttons individually
  ["approve-btn", "reject-btn", "verify-btn"].forEach(id => {
    const button = document.getElementById(id);
    if (button) {
      button.style.display = "none";
    }
  });

  // Hide modal
  const modal = document.getElementById("businessSearchModal");
  if (modal) {
    modal.style.display = "none";
  }
  
  const fields = [
    "companyname", "companyindustry", "companylocation", 
    "companycontactperson", "companydesignation", "companyemail",
    "companycontactnumber", "companyspecializations", "companydescription",
    "officestart", "officeend"
  ];
  
  fields.forEach(field => {
    const element = document.getElementById(field);
    if (element) {
      element.textContent = field === "companydescription" ? 
        "No company description available." : "No Company";
      element.classList.add("empty-value");
    }
  });
}

// Update the status badge in the sidebar
function updateSidebarStatus(studentNumber, status) {
  const items = studentList.getElementsByClassName("student-item");
  for (let item of items) {
    if (item.dataset.student === studentNumber) {
      const badge = item.querySelector('.student-status span');
      if (badge) {
        badge.textContent = status;
        if (status === "Approved") {
          badge.className = "approved-badge";
        } else if (status === "No Company") {
          badge.className = "no-company-badge";
        } else {
          badge.className = "pending-badge";
        }
      }
      break;
    }
  }
}

// Update company status (Approve/Reject)
async function updateCompanyStatus(status) {
  if (!selectedStudent || !selectedSection) {
    alert("Please select a student first!");
    return;
  }

  // Get department from sessionStorage first, fallback to localStorage
  let department = null;
  try {
    const cur = sessionStorage.getItem('currentUser');
    if (cur) {
      const obj = JSON.parse(cur);
      if (obj && obj.department) {
        department = obj.department;
      }
    }
  } catch (e) {
    console.warn('Failed to get department from sessionStorage', e);
  }
  
  // Fallback to localStorage or header element
  if (!department) {
    department = localStorage.getItem("department");
  }
  if (!department) {
    const deptEl = document.getElementById('chairdepartment');
    if (deptEl && deptEl.textContent) {
      department = deptEl.textContent;
    }
  }
  
  if (!department) {
    alert("Department not found! Please log in again.");
    return;
  }

  // Show loading overlay
  showLoader(status === 'Approved' ? 'Approving company...' : 'Rejecting company...');

        try {
            // First, update the company status
            const response = await fetch(`${API_BASE}/api/company-status/${selectedStudent}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status, department })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            // If approved, add to companies/department/withmou/ collection
            if (status === 'Approved') {
                try {
                    const addToCompaniesResponse = await fetch(`${API_BASE}/api/companies/withmou`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            department: department,
                            studentNumber: selectedStudent,
                            hteMOU: 'Processing'
                        })
                    });

                    if (!addToCompaniesResponse.ok) {
                        console.warn('Failed to add company to withmou collection:', await addToCompaniesResponse.text());
                    } else {
                        console.log('Company successfully added to withmou collection with hteMOU: processing');
                    }
                } catch (mouError) {
                    console.error('Error adding company to withmou collection:', mouError);
                    // Don't fail the approval if this step fails
                }
            }

    // Hide loader before showing success
    hideLoader();

    // Update the status badge immediately in the UI (before re-fetch)
    const statusElement = document.getElementById("companyStatus");
    const statusContainer = document.getElementById("companyStatusContainer");
    if (statusElement && statusContainer) {
        statusElement.textContent = status;
        statusElement.className = "status-badge " + status.toLowerCase();
        statusContainer.style.display = "flex";
        
        // Hide approve/reject buttons immediately after approval/rejection
        const approveBtn = document.getElementById("approve-btn");
        const rejectBtn = document.getElementById("reject-btn");
        if (approveBtn) approveBtn.style.display = "none";
        if (rejectBtn) rejectBtn.style.display = "none";
    }

    // Update cached company data with new status ONLY if we have valid cached data
    if (companyCache[selectedStudent] && companyCache[selectedStudent].hteName) {
        companyCache[selectedStudent].status = status;
        saveCacheToStorage();
    }

    // Update sidebar status immediately
    updateSidebarStatus(selectedStudent, status);

    // Re-fetch and display the updated company details (don't rely on cache)
    try {
        const companyResponse = await fetch(`${API_BASE}/api/company/${selectedStudent}`);
        if (companyResponse.ok) {
            const companies = await companyResponse.json();
            if (companies && companies.length > 0) {
                const updatedCompany = companies[0];
                // Update cache with fresh data
                companyCache[selectedStudent] = updatedCompany;
                saveCacheToStorage();
                displayCompanyDetails(updatedCompany);
            } else {
                // No company data after approval? Clear cache
                delete companyCache[selectedStudent];
                saveCacheToStorage();
                resetCompanyDetails();
            }
        } else if (companyResponse.status === 404) {
            // Company not found, clear cache
            delete companyCache[selectedStudent];
            saveCacheToStorage();
            resetCompanyDetails();
        }
    } catch (e) {
        console.warn('Could not re-fetch company after status update:', e);
        // Keep the status we already updated in the UI
    }

    // Reload students list to update badges
    const deptEl = document.getElementById('chairdepartment');
    if (deptEl && deptEl.textContent) {
        await loadStudents(deptEl.textContent);
        // Re-select the student after list refresh
        const studentItem = document.querySelector(`.student-item[data-student='${selectedStudent}']`);
        if (studentItem) {
            studentItem.classList.add('selected');
        }
    }

    // Show success modal
    const actionText = status === 'Approved' ? 'approved' : 'rejected';
    showResultModal(`Company ${actionText} successfully!`, status === 'Approved' ? 'success' : 'error');

  } catch (error) {
    console.error("Error updating company status:", error);
    hideLoader();
    showResultModal("Error updating company status. Please try again.", "error");
  }
}

// Show toast notification
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "var(--border-radius)";
  toast.style.backgroundColor = type === "success" ? "var(--success)" : 
                              type === "danger" ? "var(--danger)" : 
                              type === "warning" ? "var(--warning)" : "var(--primary)";
  toast.style.color = "white";
  toast.style.boxShadow = "var(--box-shadow)";
  toast.style.zIndex = "1000";
  toast.style.transition = "var(--transition)";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(20px)";
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Business search modal functions
function openBusinessSearch() {
  const modal = document.getElementById("businessSearchModal");
  const iframe = document.getElementById("businessSearchIframe");
  const header = document.querySelector(".header");
  
  // Reset iframe src to ensure fresh load
  iframe.src = "https://bnrs.dti.gov.ph/search";
  
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  
  // Hide header when modal is open
  if (header) {
    header.style.display = "none";
  }
}

function closeBusinessSearch() {
  const modal = document.getElementById("businessSearchModal");
  const iframe = document.getElementById("businessSearchIframe");
  const header = document.querySelector(".header");
  
  modal.style.display = "none";
  document.body.style.overflow = "auto";
  
  // Show header again when modal closes
  if (header) {
    header.style.display = "flex";
  }
  
  // Clear iframe src when closing
  iframe.src = "";
}

// Global loader helpers
function showLoader(text = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    const txt = overlay.querySelector('.loading-text');
    if (txt) txt.textContent = text;
    overlay.style.display = 'flex';
}

function hideLoader() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
}

// Result modal helpers
function showResultModal(message, type = 'success') {
    const modal = document.getElementById('resultModal');
    const messageEl = document.getElementById('resultMessage');
    const okBtn = document.getElementById('resultOkBtn');
    
    if (!modal || !messageEl) return;
    
    messageEl.textContent = message;
    modal.style.display = 'flex';
    
    // Close modal when OK is clicked
    if (okBtn) {
        okBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    // Close modal when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Initialize user info
async function initUserInfo() {
    const idNumber = localStorage.getItem('idNumber');
    
    if (!idNumber) {
        alert("No ID number found in localStorage. Please log in first.");
        window.location.href = 'login.html';
        return;
    }

    try {
            const response = await fetch(`${API_BASE}/api/user-info/${idNumber}`);
        console.log("User info response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server responded with an error:", errorText);
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const userData = await response.json();
        console.log("Received user data:", userData);

        // Update header username
        const username = document.getElementById('header-username');
        if (username && userData.name) {
            username.textContent = userData.name;
        }

        // Update header avatar (use initials via ui-avatars)
        try {
            const avatarImg = document.querySelector('.user-profile img');
            if (avatarImg && userData.name) {
                const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=3f37c9&color=fff&rounded=true`;
                avatarImg.src = avatarUrl;
            }
        } catch (err) {
            console.warn('Failed to set avatar image:', err);
        }

        // Persist name for other pages if needed
        try { localStorage.setItem('userName', userData.name); } catch (e) { /* ignore */ }

        // Update department
        const department = document.getElementById('chairdepartment');
        if (department && userData.department) {
            department.textContent = userData.department;
            localStorage.setItem('department', userData.department);
        }

    } catch (error) {
        console.error("Error fetching user info:", error);
    }
}

// Function to handle sidebar toggle state
function updateSidebarState(isActive) {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const mainContent = document.querySelector('.main-content');
    
    if (!sidebar || !sidebarToggle) return;
    
    // Update sidebar class
    sidebar.classList.toggle('active', isActive);
    
    // Update toggle button icons
    const barsIcon = sidebarToggle.querySelector('.fa-bars');
    const timesIcon = sidebarToggle.querySelector('.fa-times');
    
    if (barsIcon) barsIcon.style.display = isActive ? 'none' : 'block';
    if (timesIcon) timesIcon.style.display = isActive ? 'block' : 'none';
    
    // Adjust main content on mobile
    if (mainContent && window.innerWidth <= 768) {
        mainContent.style.marginLeft = isActive ? '250px' : '0';
    }
}

// Back to dashboard function
function backToDashboard() {
  window.location.href = '/chairpersondashboard/chairdash.html';
}

// Display selected company details
function displayCompanyDetails(company, clickedItem) {
    if (!company || Object.keys(company).length === 0) {
        console.warn('No company data provided to displayCompanyDetails');
        resetCompanyDetails();
        return;
    }

    try {
        // Update selection in the list
        if (clickedItem) {
            document.querySelectorAll('.company-submission-item').forEach(item => {
                item.classList.remove('selected');
            });
            clickedItem.classList.add('selected');
        }

        // Update all company fields
        const fields = [
            { id: "hteName", value: company.hteName },
            { id: "hteAddress", value: company.hteAddress },
            { id: "hteEmail", value: company.hteEmail },
            { id: "hteLandline", value: company.hteLandline },
            { id: "hteMobile", value: company.hteMobile },
            { id: "hteRepresentative", value: company.hteRepresentative },
            { id: "hteDesignation", value: company.hteDesignation }
        ];

        fields.forEach(field => {
            try {
                updateField(field.id, field.value);
            } catch (err) {
                console.warn(`Failed to update field ${field.id}:`, err);
            }
        });

        // Update submission date if available
        try {
            const submissionElement = document.getElementById("submissionDate");
            if (submissionElement) {
                if (company.submittedAt) {
                    const date = new Date(company.submittedAt);
                    if (!isNaN(date.getTime())) {
                        submissionElement.textContent = `Submitted: ${date.toLocaleString()}`;
                    } else {
                        submissionElement.textContent = '';
                    }
                } else {
                    submissionElement.textContent = '';
                }
            }
        } catch (err) {
            console.warn('Failed to update submission date:', err);
        }

        // Update website link
        try {
            const websiteElement = document.getElementById("companywebsite");
            if (websiteElement) {
                if (company.companyWebsite) {
                    websiteElement.href = company.companyWebsite.startsWith("http")
                        ? company.companyWebsite
                        : `https://${company.companyWebsite}`;
                    const spanElement = websiteElement.querySelector("span");
                    if (spanElement) {
                        spanElement.textContent = company.companyWebsite;
                    }
                    websiteElement.style.display = "flex";
                } else {
                    websiteElement.style.display = "none";
                }
            }
        } catch (err) {
            console.warn('Failed to update website link:', err);
        }

        // Handle logo with better error handling
        const logoPreview = document.getElementById("logo-preview");
        if (logoPreview && company.logoUrl) {
            // Set a default placeholder first
            logoPreview.src = "https://placehold.co/120x120/CCCCCC/333333?text=Loading";
            
            console.log('Attempting to load logo from URL:', company.logoUrl);
            
            // Try direct load first
            const testImg = new Image();
            testImg.onload = () => {
                logoPreview.src = company.logoUrl;
            };
            testImg.onerror = () => {
                console.warn('Direct logo load failed, trying proxy');
                
                // Extract file path for proxy
                let filePath = '';
                try {
                    const url = new URL(company.logoUrl);
                    if (url.pathname.includes('/o/')) {
                        filePath = decodeURIComponent(url.pathname.split('/o/')[1] || '');
                    } else {
                        let rawPath = url.pathname.replace(/^\//, '');
                        const projectIdx = rawPath.indexOf('project-');
                        if (projectIdx !== -1) {
                            filePath = rawPath.substring(projectIdx);
                        } else {
                            filePath = rawPath;
                        }
                    }
                } catch(e) {
                    console.error("Could not parse logoUrl:", e);
                    logoPreview.src = "https://placehold.co/120x120/CCCCCC/333333?text=No+Logo";
                    return;
                }

                const proxyUrl = `${API_BASE}/api/company-logo?path=${encodeURIComponent(filePath)}`;
                fetch(proxyUrl)
                    .then(response => {
                        if (!response.ok) throw new Error(`Proxy failed: ${response.status}`);
                        return response.blob();
                    })
                    .then(blob => {
                        logoPreview.src = URL.createObjectURL(blob);
                    })
                    .catch(error => {
                        console.error('Logo load failed:', error);
                        logoPreview.src = "https://placehold.co/120x120/CCCCCC/333333?text=No+Logo";
                    });
            };
            testImg.src = company.logoUrl;
        } else if (logoPreview) {
            logoPreview.src = "https://placehold.co/120x120/CCCCCC/333333?text=No+Logo";
        }

        // Update status and buttons
        try {
            const statusElement = document.getElementById("companyStatus");
            const statusContainer = document.getElementById("companyStatusContainer");
            const actionButtons = document.querySelector(".action-buttons");
            const approveBtn = document.getElementById("approve-btn");
            const rejectBtn = document.getElementById("reject-btn");
            const verifyBtn = document.getElementById("verify-btn");

            if (company.status && statusElement && statusContainer) {
                statusElement.textContent = company.status;
                statusElement.className = "status-badge " + company.status.toLowerCase();
                statusContainer.style.display = "flex";

                if (actionButtons) {
                    actionButtons.style.display = "flex";
                }
                
                if (company.status === "Pending") {
                    if (approveBtn) approveBtn.style.display = "flex";
                    if (rejectBtn) rejectBtn.style.display = "flex";
                } else {
                    if (approveBtn) approveBtn.style.display = "none";
                    if (rejectBtn) rejectBtn.style.display = "none";
                }
                if (verifyBtn) verifyBtn.style.display = "flex";
            } else {
                if (statusContainer) statusContainer.style.display = "none";
                if (actionButtons) actionButtons.style.display = "flex";
                if (approveBtn) approveBtn.style.display = "flex";
                if (rejectBtn) rejectBtn.style.display = "flex";
                if (verifyBtn) verifyBtn.style.display = "flex";
            }
        } catch (err) {
            console.warn('Failed to update status and buttons:', err);
        }
    } catch (error) {
        console.error('Error displaying company details:', error);
        resetCompanyDetails();
    }
}



// Function to handle user logout
function logout() {
    // Clear all user-related data from local storage
    localStorage.clear();
    
    // Redirect to the login page
    console.log("User logged out. Redirecting to login page.");
    window.location.href = '/officelogin/officelogin.html';
}