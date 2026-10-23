/* =========================================================
   REGISTRAR VALIDATION QUEUE SCRIPT
   ========================================================= */

(function () {
  "use strict";

  // State
  let enrollments = [];
  let currentFilter = "pending"; // 'pending', 'ready', 'missing', 'enrolled', 'all'
  let searchQuery = "";
  let activeEnrollment = null;

  // DOM Elements
  const tableBody = document.getElementById("queueTableBody");
  const searchInput = document.getElementById("queueSearchInput");
  const refreshBtn = document.getElementById("refreshQueueBtn");
  const messageEl = document.getElementById("message");

  // Stat counters
  const statPendingEl = document.getElementById("statPending");
  const statReadyEl = document.getElementById("statReady");
  const statMissingEl = document.getElementById("statMissing");
  const statEnrolledEl = document.getElementById("statEnrolled");

  // Validation Modal Elements
  const validationModal = document.getElementById("validationModal");
  const closeValidationModalBtn = document.getElementById("closeValidationModalBtn");
  const cancelModalBtn = document.getElementById("cancelModalBtn");
  const confirmAllDocsBtn = document.getElementById("confirmAllDocsBtn");
  const enrollStudentBtn = document.getElementById("enrollStudentBtn");
  const docsListEl = document.getElementById("docsList");
  const docsAlertBanner = document.getElementById("docsAlertBanner");

  // Success Modal Elements
  const successModal = document.getElementById("enrollmentSuccessModal");
  const closeSuccessModalBtn = document.getElementById("closeSuccessModalBtn");
  const doneSuccessModalBtn = document.getElementById("doneSuccessModalBtn");
  const copyCredsBtn = document.getElementById("copyCredsBtn");

  // Initialize
  document.addEventListener("DOMContentLoaded", () => {
    CEC.initUserMenu();

    if (!CEC.requireAuth()) return;
    CEC.loadUserDetails({ defaultName: "Registrar" });

    setupEventListeners();
    loadEnrollments();
  });

  function setupEventListeners() {
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        loadEnrollments();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderTable();
      });
    }

    // Filter Pills
    document.querySelectorAll(".filter-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        currentFilter = pill.getAttribute("data-filter");
        renderTable();
      });
    });

    // Stat cards trigger filter
    document.querySelectorAll(".stat-card").forEach((card) => {
      card.addEventListener("click", () => {
        const filter = card.getAttribute("data-filter");
        if (!filter) return;
        currentFilter = filter;
        document.querySelectorAll(".filter-pill").forEach((p) => {
          p.classList.toggle("active", p.getAttribute("data-filter") === filter);
        });
        renderTable();
      });
    });

    // Modal Close listeners
    if (closeValidationModalBtn) {
      closeValidationModalBtn.addEventListener("click", closeValidationModal);
    }
    if (cancelModalBtn) {
      cancelModalBtn.addEventListener("click", closeValidationModal);
    }

    if (validationModal) {
      validationModal.addEventListener("click", (e) => {
        if (e.target === validationModal) closeValidationModal();
      });
    }

    // Confirm all documents button in modal
    if (confirmAllDocsBtn) {
      confirmAllDocsBtn.addEventListener("click", handleConfirmAllDocs);
    }

    // Enroll button in modal
    if (enrollStudentBtn) {
      enrollStudentBtn.addEventListener("click", handleEnrollStudent);
    }

    // Success Modal Close
    if (closeSuccessModalBtn) {
      closeSuccessModalBtn.addEventListener("click", closeSuccessModal);
    }
    if (doneSuccessModalBtn) {
      doneSuccessModalBtn.addEventListener("click", closeSuccessModal);
    }
    if (successModal) {
      successModal.addEventListener("click", (e) => {
        if (e.target === successModal) closeSuccessModal();
      });
    }

    // Copy credentials
    if (copyCredsBtn) {
      copyCredsBtn.addEventListener("click", () => {
        const u = document.getElementById("successUsername").textContent;
        const p = document.getElementById("successPassword").textContent;
        const text = `Student Username: ${u}\nTemporary Password: ${p}`;
        navigator.clipboard.writeText(text).then(() => {
          copyCredsBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
          setTimeout(() => {
            copyCredsBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
          }, 2000);
        });
      });
    }

    // Keyboard ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeValidationModal();
        closeSuccessModal();
      }
    });
  }

  // =========================================================
  // LOAD ENROLLMENTS FROM API
  // =========================================================
  async function loadEnrollments() {
    setMessage("Loading enrollments queue...");
    try {
      const response = await fetch("/api/enrollments?status=all", {
        method: "GET",
        headers: CEC.authHeaders(),
      });

      if (response.status === 401 || response.status === 403) {
        CEC.handleAuthFailure();
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load queue (HTTP ${response.status})`);
      }

      enrollments = await response.json();
      setMessage("");
      updateStats();
      renderTable();
    } catch (err) {
      console.error("Error loading enrollments:", err);
      setMessage(`Error loading queue: ${err.message}`);
    }
  }

  function setMessage(msg) {
    if (messageEl) messageEl.textContent = msg;
  }

  // =========================================================
  // UPDATE STAT METRICS
  // =========================================================
  function updateStats() {
    let pendingCount = 0;
    let readyCount = 0;
    let missingCount = 0;
    let enrolledCount = 0;

    enrollments.forEach((e) => {
      const isPending = (e.status || "").toLowerCase() === "pending";
      const isEnrolled = (e.status || "").toLowerCase() === "enrolled";
      const allSubmitted = Boolean(e.all_documents_submitted);

      if (isPending) {
        pendingCount++;
        if (allSubmitted) {
          readyCount++;
        } else {
          missingCount++;
        }
      } else if (isEnrolled) {
        enrolledCount++;
      }
    });

    if (statPendingEl) statPendingEl.textContent = pendingCount;
    if (statReadyEl) statReadyEl.textContent = readyCount;
    if (statMissingEl) statMissingEl.textContent = missingCount;
    if (statEnrolledEl) statEnrolledEl.textContent = enrolledCount;
  }

  // =========================================================
  // RENDER TABLE
  // =========================================================
  function renderTable() {
    if (!tableBody) return;

    // Filter enrollments
    const filtered = enrollments.filter((e) => {
      const isPending = (e.status || "").toLowerCase() === "pending";
      const isEnrolled = (e.status || "").toLowerCase() === "enrolled";
      const allSubmitted = Boolean(e.all_documents_submitted);

      // Tab filter
      if (currentFilter === "pending" && !isPending) return false;
      if (currentFilter === "ready" && (!isPending || !allSubmitted)) return false;
      if (currentFilter === "missing" && (!isPending || allSubmitted)) return false;
      if (currentFilter === "enrolled" && !isEnrolled) return false;

      // Search keyword filter
      if (searchQuery) {
        const student = e.student_info || {};
        const fullName = `${student.first_name || ""} ${student.middle_name || ""} ${student.last_name || ""}`.toLowerCase();
        const code = (e.enrollment_id || "").toLowerCase();
        const course = (student.course || "").toLowerCase();
        const email = (student.email || "").toLowerCase();

        if (
          !fullName.includes(searchQuery) &&
          !code.includes(searchQuery) &&
          !course.includes(searchQuery) &&
          !email.includes(searchQuery)
        ) {
          return false;
        }
      }

      return true;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="table-empty-state">
              <i class="fa-solid fa-folder-open"></i>
              <h3>No enrollments found</h3>
              <p>There are no enrollment records matching your current filter.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered
      .map((e) => {
        const student = e.student_info || {};
        const fullName = `${student.first_name || ""} ${student.middle_name || ""} ${student.last_name || ""} ${student.suffix || ""}`.trim();
        const yearMap = { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year" };
        const semMap = { "1": "1st Semester", "2": "2nd Semester" };
        const yearSem = `${yearMap[student.year] || student.year || ""} - ${semMap[student.semester] || student.semester || ""}`.trim();

        const totalDocs = e.total_documents || (e.documents ? e.documents.length : 0);
        const submittedDocs = e.submitted_documents || 0;
        const percent = totalDocs > 0 ? Math.round((submittedDocs / totalDocs) * 100) : 0;
        const allSubmitted = Boolean(e.all_documents_submitted);

        let statusBadge = "";
        let actionBtn = "";

        if (e.status === "Enrolled") {
          statusBadge = `<span class="status-badge enrolled" title="Officially Enrolled"><i class="fa-solid fa-circle-check"></i> Enrolled</span>`;
          actionBtn = `
            <button class="btn-validate" title="View Application Details" onclick="window.viewEnrollmentModal('${e.enrollment_id}')">
              <i class="fa-solid fa-eye"></i> Details
            </button>
          `;
        } else if (allSubmitted) {
          statusBadge = `<span class="status-badge ready" title="All documents verified - Ready to Enroll"><i class="fa-solid fa-circle-check"></i> Ready</span>`;
          actionBtn = `
            <button class="btn-enroll-direct" title="Enroll Student Now" onclick="window.viewEnrollmentModal('${e.enrollment_id}')">
              <i class="fa-solid fa-bolt"></i> Enroll
            </button>
          `;
        } else {
          statusBadge = `<span class="status-badge pending" title="Pending Document Submission"><i class="fa-solid fa-clock"></i> Incomplete</span>`;
          actionBtn = `
            <button class="btn-validate" title="Validate Physical Documents" onclick="window.viewEnrollmentModal('${e.enrollment_id}')">
              <i class="fa-solid fa-file-circle-check"></i> Validate
            </button>
          `;
        }

        return `
          <tr>
            <td>
              <span class="tracking-code" title="${e.enrollment_id}">${e.enrollment_id}</span>
            </td>
            <td>
              <div class="student-name-cell">
                <span class="student-full-name" title="${fullName || "Unnamed Enrollee"}">${fullName || "Unnamed Enrollee"}</span>
                <span class="student-meta" title="${student.email || "No email"}${student.phone_number ? ` • ${student.phone_number}` : ""}">${student.email || "No email"}${student.phone_number ? ` &bull; ${student.phone_number}` : ""}</span>
              </div>
            </td>
            <td>
              <div class="course-cell">
                <span class="course-name" title="${student.course || "No Course Specified"}">${student.course || "No Course Specified"}</span>
                <span class="course-meta" title="${yearSem}${student.preferred_schedule ? ` • ${student.preferred_schedule}` : ""}">${yearSem}${student.preferred_schedule ? ` &bull; ${student.preferred_schedule}` : ""}</span>
              </div>
            </td>
            <td>
              <span class="type-badge">${e.enrollment_type || "Student"}</span>
            </td>
            <td>
              <div class="doc-progress-cell" title="${submittedDocs} of ${totalDocs} documents verified (${percent}%)">
                <div class="doc-progress-label">
                  <span>${submittedDocs}/${totalDocs}</span>
                  <span>${percent}%</span>
                </div>
                <div class="doc-progress-track">
                  <div class="doc-progress-fill ${allSubmitted ? "full" : ""}" style="width: ${percent}%;"></div>
                </div>
              </div>
            </td>
            <td>
              ${statusBadge}
            </td>
            <td>
              <div class="table-actions">
                ${actionBtn}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // =========================================================
  // VIEW & VALIDATE ENROLLMENT MODAL
  // =========================================================
  window.viewEnrollmentModal = function (enrollmentId) {
    const item = enrollments.find((e) => e.enrollment_id === enrollmentId);
    if (!item) return;

    activeEnrollment = item;
    populateValidationModal(item);

    if (validationModal) {
      validationModal.classList.add("active");
      validationModal.setAttribute("aria-hidden", "false");
    }
  };

  function populateValidationModal(item) {
    const student = item.student_info || {};
    const fullName = `${student.first_name || ""} ${student.middle_name || ""} ${student.last_name || ""} ${student.suffix || ""}`.trim();

    // Header info
    setText("modalStudentName", fullName);
    setText("modalTrackingId", item.enrollment_id);

    // Profile snapshot
    setText("snapCourse", student.course || "—");
    setText("snapSchedule", student.preferred_schedule || "—");

    const yearMap = { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year" };
    const semMap = { "1": "1st Semester", "2": "2nd Semester" };
    setText("snapYearSem", `${yearMap[student.year] || student.year || "—"} (${semMap[student.semester] || student.semester || "—"})`);
    setText("snapType", item.enrollment_type || "—");
    setText("snapPhone", student.phone_number || "—");
    setText("snapEmail", student.email || "—");
    setText("snapAddress", student.home_address || "—");
    setText("snapBirthdate", student.birthdate || "—");

    // Documents checklist
    renderModalDocsChecklist(item);
  }

  function renderModalDocsChecklist(item) {
    if (!docsListEl) return;

    const docs = item.documents || [];
    const total = docs.length;
    const submitted = docs.filter((d) => d.status === "Submitted").length;
    const allSubmitted = total > 0 && submitted === total;
    const isEnrolled = item.status === "Enrolled";

    // Update Banner
    if (docsAlertBanner) {
      if (isEnrolled) {
        docsAlertBanner.className = "docs-alert-banner success";
        docsAlertBanner.innerHTML = `<i class="fa-solid fa-circle-check"></i> This student is officially ENROLLED. Student account has been created.`;
      } else if (allSubmitted) {
        docsAlertBanner.className = "docs-alert-banner success";
        docsAlertBanner.innerHTML = `<i class="fa-solid fa-circle-check"></i> All ${total} required documents have been verified as submitted. Ready for official enrollment!`;
      } else {
        docsAlertBanner.className = "docs-alert-banner warning";
        docsAlertBanner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${submitted} of ${total} documents verified. Confirm receipt of physical documents before enrolling.`;
      }
    }

    // Toggle Confirm All button visibility
    if (confirmAllDocsBtn) {
      confirmAllDocsBtn.style.display = isEnrolled || allSubmitted ? "none" : "inline-block";
    }

    // Update Enroll Button
    if (enrollStudentBtn) {
      if (isEnrolled) {
        enrollStudentBtn.disabled = true;
        enrollStudentBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> Already Enrolled`;
      } else if (allSubmitted) {
        enrollStudentBtn.disabled = false;
        enrollStudentBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> Enroll Student & Create Account`;
      } else {
        enrollStudentBtn.disabled = true;
        enrollStudentBtn.innerHTML = `<i class="fa-solid fa-lock"></i> All Documents Required to Enroll`;
      }
    }

    // Render Checklist
    if (docs.length === 0) {
      docsListEl.innerHTML = `<p style="color:#64748b; font-size:13px;">No document requirements defined for this student type.</p>`;
      return;
    }

    docsListEl.innerHTML = docs
      .map((doc) => {
        const isSub = doc.status === "Submitted";
        return `
          <div class="doc-check-row ${isSub ? "submitted" : ""}">
            <div class="doc-left">
              <i class="fa-solid ${isSub ? "fa-circle-check" : "fa-file-lines"} doc-icon"></i>
              <span class="doc-name">${doc.requirement_name}</span>
            </div>
            <div class="doc-right">
              <span class="doc-badge ${isSub ? "submitted" : "pending"}">
                ${isSub ? '<i class="fa-solid fa-check"></i> Submitted' : '<i class="fa-solid fa-clock"></i> Pending'}
              </span>
              ${
                !isEnrolled
                  ? `
                <button
                  type="button"
                  class="btn-toggle-doc ${!isSub ? "mark-submitted" : ""}"
                  onclick="window.toggleDocumentStatus(${doc.document_id}, '${isSub ? "Pending" : "Submitted"}')"
                >
                  ${isSub ? "Undo" : "✓ Mark Submitted"}
                </button>
              `
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  // =========================================================
  // TOGGLE SINGLE DOCUMENT STATUS
  // =========================================================
  window.toggleDocumentStatus = async function (documentId, newStatus) {
    if (!activeEnrollment) return;

    try {
      const response = await fetch(
        `/api/enrollments/${encodeURIComponent(activeEnrollment.enrollment_id)}/documents/validate`,
        {
          method: "POST",
          headers: CEC.authHeaders(),
          body: JSON.stringify({
            document_id: documentId,
            status: newStatus,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        alert(errData.msg || "Failed to update document status");
        return;
      }

      const resData = await response.json();
      activeEnrollment = resData.enrollment;

      // Update in local state list
      const idx = enrollments.findIndex((e) => e.enrollment_id === activeEnrollment.enrollment_id);
      if (idx !== -1) {
        enrollments[idx] = activeEnrollment;
      }

      updateStats();
      renderTable();
      renderModalDocsChecklist(activeEnrollment);
    } catch (err) {
      console.error("Error updating document status:", err);
      alert(`Error updating document: ${err.message}`);
    }
  };

  // =========================================================
  // CONFIRM ALL DOCUMENTS
  // =========================================================
  async function handleConfirmAllDocs() {
    if (!activeEnrollment) return;

    try {
      confirmAllDocsBtn.disabled = true;
      confirmAllDocsBtn.textContent = "Confirming...";

      const response = await fetch(
        `/api/enrollments/${encodeURIComponent(activeEnrollment.enrollment_id)}/documents/validate`,
        {
          method: "POST",
          headers: CEC.authHeaders(),
          body: JSON.stringify({ validate_all: true }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        alert(errData.msg || "Failed to confirm documents");
        return;
      }

      const resData = await response.json();
      activeEnrollment = resData.enrollment;

      const idx = enrollments.findIndex((e) => e.enrollment_id === activeEnrollment.enrollment_id);
      if (idx !== -1) {
        enrollments[idx] = activeEnrollment;
      }

      updateStats();
      renderTable();
      renderModalDocsChecklist(activeEnrollment);
    } catch (err) {
      console.error("Error confirming all documents:", err);
      alert(`Error confirming documents: ${err.message}`);
    } finally {
      if (confirmAllDocsBtn) {
        confirmAllDocsBtn.disabled = false;
        confirmAllDocsBtn.textContent = "Confirm All Documents Submitted";
      }
    }
  }

  // =========================================================
  // ENROLL STUDENT & CREATE ACCOUNT
  // =========================================================
  async function handleEnrollStudent() {
    if (!activeEnrollment) return;

    if (!activeEnrollment.all_documents_submitted) {
      alert("All required documents must be submitted to the office before enrolling.");
      return;
    }

    const student = activeEnrollment.student_info || {};
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const isReEnrollment = activeEnrollment.enrollment_type_id === 1 || !!(student && student.user_id);
    const confirmPrompt = isReEnrollment
      ? `Are you sure you want to officially enroll ${fullName}? Student data connected with their existing account will be updated (no new account will be created).`
      : `Are you sure you want to officially enroll ${fullName} and create their Student Portal account?`;
    const confirmed = confirm(confirmPrompt);
    if (!confirmed) return;

    try {
      enrollStudentBtn.disabled = true;
      enrollStudentBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Enrolling...`;

      const response = await fetch(
        `/api/enrollments/${encodeURIComponent(activeEnrollment.enrollment_id)}/enroll`,
        {
          method: "POST",
          headers: CEC.authHeaders(),
        }
      );

      const resData = await response.json();

      if (!response.ok) {
        alert(`Enrollment Failed: ${resData.msg || "Server error"}`);
        return;
      }

      // Update state
      activeEnrollment = resData.enrollment;
      const idx = enrollments.findIndex((e) => e.enrollment_id === activeEnrollment.enrollment_id);
      if (idx !== -1) {
        enrollments[idx] = activeEnrollment;
      }

      updateStats();
      renderTable();
      closeValidationModal();

      // Show Success Modal
      showEnrollmentSuccessModal(resData, fullName);
    } catch (err) {
      console.error("Error enrolling student:", err);
      alert(`Error enrolling student: ${err.message}`);
    } finally {
      if (enrollStudentBtn) {
        enrollStudentBtn.disabled = false;
        enrollStudentBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> Enroll Student & Create Account`;
      }
    }
  }

  // =========================================================
  // SUCCESS MODAL DISPLAY
  // =========================================================
  function showEnrollmentSuccessModal(data, studentName) {
    if (!successModal) return;

    setText("successStudentName", studentName);
    setText("successTrackingId", data.enrollment_id);
    setText("successUsername", data.username);
    setText("successPassword", data.password);

    const titleEl = successModal.querySelector("h3");
    if (titleEl) {
      titleEl.textContent = data.is_reenrollment
        ? "Student Re-Enrollment Confirmed!"
        : "Student Officially Enrolled!";
    }

    const subtitleEl = successModal.querySelector(".subtitle");
    if (subtitleEl) {
      if (data.is_reenrollment) {
        subtitleEl.innerHTML = `<strong>${studentName}</strong> (<span>${data.enrollment_id}</span>) has been officially re-enrolled. Student data connected with their existing account has been updated (no new account created).`;
      } else {
        subtitleEl.innerHTML = `<strong>${studentName}</strong> (<span>${data.enrollment_id}</span>) has been officially enrolled. A new student account has been created.`;
      }
    }

    const emailStatusEl = document.getElementById("successEmailStatus");
    if (emailStatusEl) {
      if (data.email_sent) {
        emailStatusEl.className = "email-dispatch-status";
        emailStatusEl.innerHTML = data.is_reenrollment
          ? `<i class="fa-solid fa-circle-check"></i> Re-enrollment confirmation dispatched to student's email. Existing login maintained.`
          : `<i class="fa-solid fa-circle-check"></i> Login credentials dispatched to student's email.`;
      } else {
        emailStatusEl.className = "email-dispatch-status warn";
        emailStatusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Email notification skipped or pending dispatch.`;
      }
    }

    successModal.classList.add("active");
    successModal.setAttribute("aria-hidden", "false");
  }

  function closeValidationModal() {
    if (validationModal) {
      validationModal.classList.remove("active");
      validationModal.setAttribute("aria-hidden", "true");
    }
    activeEnrollment = null;
  }

  function closeSuccessModal() {
    if (successModal) {
      successModal.classList.remove("active");
      successModal.setAttribute("aria-hidden", "true");
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || "—";
  }
})();
