const API_BASE = (typeof window !== 'undefined' && window.location.port && window.location.port !== '3000') ? 'http://localhost:3000' : '';

document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const modal = document.getElementById('requirementModal');
    const closeBtn = document.querySelector('.close');

    // Close modal when clicking the close button or outside the modal
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = "none";
        }
    }

    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Prefer sessionStorage.currentUser (set by the login flow). Fall back to legacy localStorage.idNumber.
    let idNumber = null;
    try {
        const currentUserRaw = sessionStorage.getItem('currentUser');
        if (currentUserRaw) {
            const currentUser = JSON.parse(currentUserRaw);
            if (currentUser && currentUser.idNumber) {
                idNumber = currentUser.idNumber;
                // Populate header name if available
                if (currentUser.name) {
                    const headerName = document.getElementById('header-username');
                    if (headerName) headerName.textContent = currentUser.name;
                }
                // Ensure department is available for other functions
                if (currentUser.department) {
                    localStorage.setItem('department', currentUser.department);
                }
            }
        }
    } catch (err) {
        console.warn('Failed to parse sessionStorage.currentUser', err);
    }

    if (!idNumber) idNumber = localStorage.getItem('idNumber');
    if (!idNumber) {
        alert("No ID number found in storage. Please log in first.");
        window.location.href = '/officelogin/officelogin.html';
        return;
    }

    async function loadUserInfo() {
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
                if(headerAvatar){
                    headerAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=3f37c9&color=fff`;
                }
            }

            if (userData.department) {
                localStorage.setItem('department', userData.department); // Store department in localStorage
                document.getElementById("chairdepartment").textContent = userData.department;
                populateSectionFilter(userData.department); // Populate sections after getting department
                fetchStudents(userData.department, 'all'); // Initially fetch all students
            } else {
                alert("Could not determine chairperson's department from user data.");
            }
        } catch (error) {
            console.error("Error fetching user info:", error);
            alert("Error fetching user info: " + error.message);
        }
    }

    loadUserInfo();

    document.getElementById('sectionFilter').addEventListener('change', function() {
        const department = localStorage.getItem('department');
        const selectedSection = this.value;
        if (department) {
            fetchStudents(department, selectedSection);
        }
    });
});

async function populateSectionFilter(department) {
    const sectionFilter = document.getElementById('sectionFilter');
    try {
    const response = await fetch(`${API_BASE}/api/sections/${department}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const sections = await response.json();
        console.log('[chairpersondocuments] populateSectionFilter - department:', department, 'sections:', sections);

        sectionFilter.innerHTML = '<option value="all">All Sections</option>'; // Reset options
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section;
            sectionFilter.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching sections:", error);
        // Optionally, display an error message in the filter or an alert
    }
}

// Add filterStudents and filterBySection functions
function filterStudents() {
    const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
    const studentList = document.getElementById('studentList');
    Array.from(studentList.children).forEach(item => {
        const name = item.querySelector('.student-name').textContent.toLowerCase();
        const studentNumber = item.querySelector('.student-meta').dataset.studentnumber.toLowerCase();
        const section = item.querySelector('.student-meta').dataset.section.toLowerCase();
        
        if (name.includes(searchTerm) || studentNumber.includes(searchTerm) || section.includes(searchTerm)) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
}

function filterBySection(selectedSection) {
    const department = localStorage.getItem('department');
    if (department) {
        fetchStudents(department, selectedSection);
    }
}

async function openRequirementModal(course, section, studentNumber, requirementName, requirement) {
    const modal = document.getElementById('requirementModal');
    const requirementTitle = document.getElementById('requirementTitle');
    const requirementDescription = document.getElementById('requirementDescription');
    const requirementImage = document.getElementById('requirementImage');
    const submittedDate = document.getElementById('submittedDate');
    const feedbackText = document.getElementById('feedbackText');
    const actionButtons = modal.querySelector('.action-buttons');

    // Set modal content
    requirementTitle.textContent = requirementName;
    requirementDescription.textContent = requirement.taskDescription || 'No description provided';
    submittedDate.textContent = requirement.submittedAt ? 
        new Date(requirement.submittedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }) : 'Not submitted';
    
    // Handle action buttons visibility and feedback based on status
    if (requirement.status === 'Approved' || requirement.status === 'Rejected') {
        // For approved or rejected documents
        actionButtons.style.display = 'none';
        feedbackText.readOnly = true;
        
        // Show the status indicator if it doesn't exist
        let statusIndicator = modal.querySelector('.status-indicator');
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.className = 'status-indicator';
            const isApproved = requirement.status === 'Approved';
            statusIndicator.innerHTML = `
                <i class="fas ${isApproved ? 'fa-check-circle' : 'fa-times-circle'}" style="color: ${isApproved ? '#10b981' : '#ef4444'};"></i>
                <span style="color: ${isApproved ? '#10b981' : '#ef4444'}; margin-left: 8px;">${requirement.status}</span>
            `;
            // Insert the status indicator before the image container
            modal.querySelector('.requirement-details').insertBefore(statusIndicator, requirementImage.parentNode);
        }
        
        // Make sure feedback is visible for approved and rejected documents
        const feedbackContainer = document.getElementById('feedbackContainer');
        if (feedbackContainer) {
            feedbackContainer.style.display = 'block';
        }
    } else {
        // For non-approved documents
        actionButtons.style.display = 'flex';
        feedbackText.readOnly = false;
        
        // Remove any existing status indicator
        const existingIndicator = modal.querySelector('.status-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Reset feedback visibility and make it required for rejected documents
        const feedbackContainer = document.getElementById('feedbackContainer');
        if (feedbackContainer) {
            feedbackContainer.style.display = 'block';
            if (!requirement.status || requirement.status === 'Not Submitted') {
                feedbackText.placeholder = 'Enter feedback here (required for rejecting documents)';
            } else if (requirement.status === 'Rejected') {
                feedbackText.placeholder = 'Feedback (required for rejected documents)';
            } else {
                feedbackText.placeholder = 'Optional feedback';
            }
        }
    }
    
    // Set image if available
    if (requirement.submitRequirements) {
        try {
            // The user has clarified that submitRequirements is a full, public URL.
            // We can use it directly without fetching a signed URL.
            const url = requirement.submitRequirements;
            console.log('Using direct URL for document:', url);

            requirementImage.src = url;
            requirementImage.style.display = 'block';
            
            // Remove loading indicator related code since it's not needed with direct URL
            // and styling can be handled by CSS. Removed lines that add/remove loading indicator.
            
            // Handle image load success
            requirementImage.onload = () => {
                requirementImage.style.opacity = '1';
            };
            
            // Handle image load error
            requirementImage.onerror = () => {
                console.error('Image failed to load from URL:', url);
                requirementImage.style.display = 'none';
                alert('Failed to load document. The URL might be invalid or the file is missing.');
            };
        } catch (error) {
            console.error('Error loading document:', error);
            requirementImage.style.display = 'none';
            alert('An unexpected error occurred while trying to load the document.');
        }
    } else {
        requirementImage.style.display = 'none';
    }    // Set feedback if available
    feedbackText.value = requirement.feedback || '';

    // Store current requirement info for status updates
    modal.dataset.course = course;
    modal.dataset.section = section;
    modal.dataset.studentNumber = studentNumber;
    modal.dataset.requirementName = requirementName;

    modal.style.display = 'block';
}

async function updateStatus(newStatus) {
    const modal = document.getElementById('requirementModal');
    const feedbackText = document.getElementById('feedbackText');
    const feedback = feedbackText.value.trim();
    const { course, section, studentNumber, requirementName } = modal.dataset;
    const reviewerName = document.getElementById('header-username').textContent;
    const actionButtons = modal.querySelector('.action-buttons');

    // Check if feedback is required for rejection
    if (newStatus === 'rejected' && !feedback) {
        alert('Please provide feedback when rejecting a document.');
        feedbackText.placeholder = 'Feedback is required for rejecting documents';
        feedbackText.focus();
        return;
    }
    
    // Update placeholder based on action
    feedbackText.placeholder = newStatus === 'rejected' ? 'Required feedback for rejection' : 'Optional feedback';

    // Show loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'modal-loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-circle-notch fa-spin"></i>
            <div class="loading-text">
                <span>${newStatus === 'approved' ? 'Approving' : 'Rejecting'}</span>
                <span class="loading-dots">...</span>
            </div>
        </div>
    `;
    document.body.appendChild(loadingOverlay);

    // Disable buttons and feedback while processing
    const buttons = actionButtons.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.7';
        button.style.cursor = 'not-allowed';
    });
    feedbackText.readOnly = true;
    feedbackText.style.opacity = '0.7';

    // Set status with proper capitalization
    const finalStatus = newStatus === 'approved' ? 'Approved' : (newStatus === 'rejected' ? 'Rejected' : newStatus);

    try {
    const response = await fetch(`${API_BASE}/api/requirements/update-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                course,
                section,
                studentNumber,
                docName: requirementName,
                newStatus: finalStatus, // Use capitalized status
                reviewerName,
                feedback
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to update status');
        }

        // Create notification for the student
        try {
            const notificationResponse = await fetch(`${API_BASE}/api/notifications/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    course,
                    section,
                    studentNumber,
                    notification: {
                        type: 'document_status',
                        title: `Document ${finalStatus}`,
                        message: `Your ${requirementName} has been ${finalStatus.toLowerCase()} by ${reviewerName}`,
                        documentName: requirementName,
                        status: finalStatus,
                        feedback: feedback,
                        timestamp: new Date().toISOString(),
                        reviewer: reviewerName
                    }
                }),
            });

            if (!notificationResponse.ok) {
                console.error('Failed to create notification');
            }
        } catch (notifError) {
            console.error('Error creating notification:', notifError);
        }

        // Add success content to loading overlay only when actively approving/rejecting
        const loadingOverlay = document.querySelector('.modal-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.querySelector('.loading-spinner').innerHTML = `
                <i class="fas fa-check-circle" style="color: #10b981; animation: none;"></i>
                <div class="success-text">
                    Status updated successfully
                </div>
            `;
        }

        // If the status was updated to Approved or Rejected, hide the action buttons
        if (finalStatus === 'Approved' || finalStatus === 'Rejected') {
            actionButtons.style.display = 'none';
            feedbackText.readOnly = true;
        }
        
        // Remove the overlay and close modal after delay
        setTimeout(() => {
            if (loadingOverlay) {
                // Update the requirement card status in real-time
                const requirementCards = document.querySelectorAll('.requirement-card');
                requirementCards.forEach(card => {
                    const titleEl = card.querySelector('.requirement-title');
                    if (titleEl && titleEl.textContent === requirementName) {
                        const statusEl = card.querySelector('.requirement-status');
                        if (statusEl) {
                            statusEl.textContent = finalStatus;
                            statusEl.style.color = finalStatus === 'Approved' ? '#10b981' : 
                                                 finalStatus === 'Rejected' ? '#ef4444' : '#f59e0b';
                            
                            // Update the view document button data
                            const viewBtn = card.querySelector('.view-document-btn');
                            if (viewBtn) {
                                const currentOnclick = viewBtn.getAttribute('onclick');
                                viewBtn.setAttribute('onclick', currentOnclick.replace(/status:[^,}]+/, `status:'${finalStatus}'`));
                            }
                        }
                    }
                });
                
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    loadingOverlay.remove();
                    modal.style.display = 'none';
                    // Reload the page after modal closes
                    window.location.reload();
                }, 400); // Match fadeOut duration
            }
        }, 1500);    } catch (error) {
        console.error('Error updating status:', error);
        
        // Update loading overlay to show error
        const loadingOverlay = document.querySelector('.modal-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.querySelector('.loading-spinner').innerHTML = `
                <i class="fas fa-exclamation-circle" style="color: #ef4444; animation: none;"></i>
                <div class="error-text" style="color: #ef4444;">
                    Failed to update status
                </div>
                <div style="font-size: 0.9rem; color: #666;">Please try again</div>
            `;

            // Remove error message and overlay after delay
            setTimeout(() => {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    loadingOverlay.remove();
                    // Re-enable buttons and feedback
                    buttons.forEach(button => {
                        button.disabled = false;
                        button.style.opacity = '1';
                        button.style.cursor = 'pointer';
                    });
                    feedbackText.readOnly = false;
                    feedbackText.style.opacity = '1';
                }, 400); // Match fadeOut duration
            }, 2000);
        }
    }
}

async function fetchStudents(department, selectedSection) {
    const studentList = document.getElementById("studentList");
    studentList.innerHTML = `
        <li class="student-item">
            <div class="list-empty-state">
                <i class="fas fa-circle-notch fa-spin" style="font-size:1.25rem; color:var(--primary);"></i>
                <div class="list-empty-text">Loading students...</div>
            </div>
        </li>
    `;

    try {
    const url = `${API_BASE}/api/students/${department}${selectedSection !== 'all' ? `?section=${selectedSection}` : ''}`;
    console.log('[chairpersondocuments] fetchStudents - url:', url);

    const response = await fetch(url);
    console.log('[chairpersondocuments] fetchStudents - response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const students = await response.json();

        studentList.innerHTML = '';
        if (students.length === 0) {
            studentList.innerHTML = `
                <li class="student-item">
                    <div class="list-empty-state">
                        <i class="fas fa-user-slash" style="font-size:1.25rem; color:var(--gray);"></i>
                        <div class="list-empty-text">No students found for this department</div>
                    </div>
                </li>
            `;
            return;
        }

        students.forEach(student => {
            const listItem = document.createElement("li");
            listItem.className = "student-item";
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random&color=fff`;
            const hasCompanyStatus = student.hasCompany ? 'approved' : 'no-company';

            listItem.innerHTML = `
                <button class="student-btn" onclick="fetchStudentRequirements('${department}', '${student.section}', '${student.studentNumber}', event)">
                    <img src="${avatarUrl}" alt="Student Avatar" class="student-avatar">
                    <div class="student-details">
                        <span class="student-name">${student.name}</span>
                        <span class="student-meta" data-studentnumber="${student.studentNumber}" data-section="${student.section}">${student.studentNumber} • ${student.section}</span>
                    </div>
                    <div class="student-status">
                        <span class="status-badge ${hasCompanyStatus}-badge">${student.hasCompany ? 'With HTE' : ''}</span>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </button>
            `;
            studentList.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error fetching students:", error);
        studentList.innerHTML = `
            <li class="student-item">
                <div class="list-empty-state">
                    <i class="fas fa-exclamation-circle" style="font-size:1.25rem; color:var(--danger);"></i>
                    <div class="list-empty-text">Error loading students. Please try again.</div>
                </div>
            </li>
        `;
    }
}

window.fetchStudentRequirements = async function(course, section, studentNumber, event) {
    const displayArea = document.getElementById("displayArea");

    document.querySelectorAll('.student-btn').forEach(btn => btn.classList.remove('active'));
    if (event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    displayArea.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px 20px;">
            <i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 16px;"></i>
            <p style="color: var(--gray); font-size: 0.875rem;">Loading requirements...</p>
        </div>
    `;

    try {
    const response = await fetch(`${API_BASE}/api/students/${course}/${section}/${studentNumber}/requirements`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const requirements = await response.json();

    const studentResponse = await fetch(`${API_BASE}/api/student-details/${course}/${section}/${studentNumber}`);
        if (!studentResponse.ok) {
            const errorText = await studentResponse.text();
            throw new Error(`Server error: ${studentResponse.status} ${studentResponse.statusText} - ${errorText}`);
        }
        const { studentData } = await studentResponse.json();

        displayArea.innerHTML = '';

        const requirementGrid = document.createElement("div");
        requirementGrid.className = "requirement-grid";
        displayArea.appendChild(requirementGrid);

        const allExpectedRequirements = [
            "CERTIFICATE OF REGISTRATION", "MEDICAL CERTIFICATE", "HTE", "INTERN PLACEMENT", 
            "INTERNSHIP PLAN", "OATH OF UNDERTAKING", 
            "WAIVER", "RECOMMENDATION LETTER", "ACCEPTANCE LETTER"
        ];

        let hasPendingItems = false;
        allExpectedRequirements.forEach(expectedDocName => {
            const requirementCard = document.createElement("div");
            requirementCard.className = "requirement-card";
            const requirementId = expectedDocName.replace(/\s+/g, '-');

            const submittedDoc = requirements[expectedDocName];

            if (submittedDoc) {
                const { submitRequirements, taskDescription, submittedAt, status } = submittedDoc;
                const fileURL = submitRequirements;
                const statusText = status || 'Not Submitted';
                let statusClass = statusText === 'Approved' ? 'status-approved' : 
                                (statusText === 'Rejected' ? 'status-rejected' : 'status-pending');

                requirementCard.innerHTML = `
                    <div class="requirement-header">
                        <h3 class="requirement-title">${expectedDocName}</h3>
                        <span class="requirement-status" style="color: ${statusText === 'Not Submitted' ? 'var(--danger)' : 
                            statusText === 'Approved' ? 'var(--success)' : 
                            statusText === 'Rejected' ? 'var(--danger)' : 'var(--warning)'}">${statusText}</span>
                    </div>
                    <div class="requirement-content">
                        <p>This document has ${statusText === 'Not Submitted' ? 'not been' : 'been'} submitted.</p>
                        ${submitRequirements ? `
                            <button class="view-document-btn" onclick="openRequirementModal('${course}', '${section}', '${studentNumber}', '${expectedDocName}', 
                                ${JSON.stringify({
                                    ...submittedDoc,
                                    status: statusText // Ensure the status is passed correctly
                                }).replace(/"/g, '&quot;')})">
                                <i class="fas fa-file-image"></i> View Document
                            </button>
                        ` : ''}
                    </div>
                `;
            } else {
                requirementCard.innerHTML = `
                    <div class="requirement-header">
                        <h3 class="requirement-title">${expectedDocName}</h3>
                        <span class="requirement-status" style="color: var(--danger);">Not Submitted</span>
                    </div>
                    <div class="requirement-content">
                        <p>This document has not been submitted.</p>
                    </div>
                `;
            }
            requirementGrid.appendChild(requirementCard);
        });

        let bulkActionsContainer = document.getElementById('bulk-actions-container');
        if (hasPendingItems) {
            if (!bulkActionsContainer) {
                bulkActionsContainer = document.createElement('div');
                bulkActionsContainer.id = 'bulk-actions-container';
                bulkActionsContainer.style.cssText = 'margin-top: 25px; text-align: right; border-top: 1px solid var(--border-color); padding-top: 20px;';
                displayArea.appendChild(bulkActionsContainer);
            }
            bulkActionsContainer.innerHTML = `
                <button id="process-actions-btn" class="action-btn approve-btn" onclick="processSelectedActions('${course}', '${section}', '${studentNumber}')">
                    <i class="fas fa-tasks"></i> Process Actions
                </button>
            `;
        } else if (bulkActionsContainer) {
            bulkActionsContainer.innerHTML = '';
        }

    } catch (error) {
        console.error("Error fetching requirements:", error);
        displayArea.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: var(--danger); margin-bottom: 16px;"></i>
                <p style="color: var(--gray); font-size: 0.875rem;">Unable to load requirements. Please try again.</p>
            </div>
        `;
    }
};

window.markEligibleForOJT = async function(course, section, studentNumber) {
    const chairpersonName = localStorage.getItem("userName") || "Chairperson";
    try {
    const response = await fetch(`${API_BASE}/api/students/${course}/${section}/${studentNumber}/mark-eligible`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chairpersonName })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        alert("Student marked as eligible for OJT!");
        fetchStudentRequirements(course, section, studentNumber, new Event('click'));
    } catch (error) {
        console.error("Error updating eligibility status:", error);
        alert("Failed to mark student as eligible: " + error.message);
    }
};

window.processSelectedActions = async function(course, section, studentNumber) {
    const selectedActionRadios = document.querySelectorAll('input[type="radio"][value="approve"]:checked, input[type="radio"][value="reject"]:checked');
    const actions = Array.from(selectedActionRadios).map(radio => ({
        course,
        section,
        studentNumber,
        docName: radio.name.replace('action-', ''),
        status: radio.value === 'approve' ? 'Approved' : 'Rejected'
    }));

    if (actions.length === 0) {
        alert("Please select an 'Approve' or 'Reject' action for at least one requirement.");
        return;
    }

    const reviewerName = localStorage.getItem("userName") || "Chairperson";

    try {
        const response = await fetch('http://localhost:3000/api/requirements/bulk-update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actions, reviewerName })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const result = await response.json();
        alert(`Successfully processed ${result.successCount} action(s). Failed: ${result.errorCount}`);
        fetchStudentRequirements(course, section, studentNumber, new Event('click'));
    } catch (error) {
        console.error("Error processing actions:", error);
        alert("Failed to process actions. Please try again.");
    }
};