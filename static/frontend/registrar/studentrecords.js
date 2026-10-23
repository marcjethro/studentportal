/* =========================================================
   REGISTRAR STUDENT RECORDS SCRIPT (studentrecords.js)
   Handles student directory, search, filter, detailed record
   inspection, profile editing, and new registration.
   ========================================================= */

(function () {
  "use strict";

  // Bootstrap shared auth and navbar
  CEC.initUserMenu();
  if (!CEC.requireAuth()) return;

  CEC.loadUserDetails({ defaultName: "Registrar" });

  // ---- State ----
  let allStudents = [];
  let availableCourses = [];
  let currentFilter = "all"; // 'all', 'enrolled', 'pending', 'returnee', 'new'
  let activeStudentId = null;
  let activeStudentDetail = null;

  // ---- DOM Elements ----
  const recordsAlert = document.getElementById("recordsAlert");
  const refreshRecordsBtn = document.getElementById("refreshRecordsBtn");
  const newStudentRecordBtn = document.getElementById("newStudentRecordBtn");
  const printMasterListBtn = document.getElementById("printMasterListBtn");

  // Stat Elements
  const statTotal = document.getElementById("statTotal");
  const statEnrolled = document.getElementById("statEnrolled");
  const statPending = document.getElementById("statPending");
  const statPrograms = document.getElementById("statPrograms");

  // Filters
  const filterPills = document.querySelectorAll(".filter-pill");
  const recordSearchInput = document.getElementById("recordSearchInput");
  const courseFilterSelect = document.getElementById("courseFilterSelect");
  const yearFilterSelect = document.getElementById("yearFilterSelect");

  // Table
  const recordsTableBody = document.getElementById("recordsTableBody");

  // View Modal Elements
  const viewRecordModal = document.getElementById("viewRecordModal");
  const closeViewModalBtn = document.getElementById("closeViewModalBtn");
  const closeViewModalFooterBtn = document.getElementById("closeViewModalFooterBtn");
  const editFromViewBtn = document.getElementById("editFromViewBtn");
  const printRecordBtn = document.getElementById("printRecordBtn");
  const viewStudentName = document.getElementById("viewStudentName");
  const viewStudentId = document.getElementById("viewStudentId");
  const viewStudentProgram = document.getElementById("viewStudentProgram");
  const viewStudentStatus = document.getElementById("viewStudentStatus");
  const modalTabBtns = document.querySelectorAll(".modal-tab-btn");
  const modalTabPanels = document.querySelectorAll(".modal-tab-panel");

  // Edit Modal Elements
  const editRecordModal = document.getElementById("editRecordModal");
  const closeEditModalBtn = document.getElementById("closeEditModalBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const editRecordForm = document.getElementById("editRecordForm");
  const editStudentInfoId = document.getElementById("editStudentInfoId");
  const editFirstName = document.getElementById("editFirstName");
  const editMiddleName = document.getElementById("editMiddleName");
  const editLastName = document.getElementById("editLastName");
  const editSuffix = document.getElementById("editSuffix");
  const editBirthdate = document.getElementById("editBirthdate");
  const editPhone = document.getElementById("editPhone");
  const editEmail = document.getElementById("editEmail");
  const editAddress = document.getElementById("editAddress");
  const editCourse = document.getElementById("editCourse");
  const editYearLevel = document.getElementById("editYearLevel");
  const editSemester = document.getElementById("editSemester");
  const editSchedule = document.getElementById("editSchedule");
  const saveEditBtn = document.getElementById("saveEditBtn");

  // New Record Modal Elements
  const newRecordModal = document.getElementById("newRecordModal");
  const closeNewModalBtn = document.getElementById("closeNewModalBtn");
  const cancelNewBtn = document.getElementById("cancelNewBtn");
  const newRecordForm = document.getElementById("newRecordForm");
  const newCourse = document.getElementById("newCourse");
  const saveNewBtn = document.getElementById("saveNewBtn");

  // Print Header Date
  const printTimestamp = document.getElementById("printTimestamp");

  // ---- Alert Helper ----
  function showAlert(msg, type = "success") {
    if (!recordsAlert) return;
    recordsAlert.textContent = msg;
    recordsAlert.className = `records-alert ${type}`;
    recordsAlert.style.display = "flex";
    setTimeout(() => {
      recordsAlert.style.display = "none";
    }, 6000);
  }

  // Safe DOM text setter
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val != null && val !== "" ? val : "—";
  }

  // ---- Fetch & Load Directory ----
  async function loadStudentRecords() {
    try {
      const search = recordSearchInput ? recordSearchInput.value.trim() : "";
      const courseId = courseFilterSelect ? courseFilterSelect.value : "";
      const yearLevel = yearFilterSelect ? yearFilterSelect.value : "";

      const queryParams = new URLSearchParams();
      if (search) queryParams.append("search", search);
      if (courseId) queryParams.append("course_id", courseId);
      if (yearLevel) queryParams.append("year_level", yearLevel);
      if (currentFilter && currentFilter !== "all") queryParams.append("status", currentFilter);

      const response = await fetch(`/api/student/records?${queryParams.toString()}`, {
        method: "GET",
        headers: CEC.authHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          CEC.handleAuthFailure();
          return;
        }
        throw new Error(`Failed to load records (HTTP ${response.status})`);
      }

      const data = await response.json();
      allStudents = data.students || [];
      availableCourses = data.courses || [];

      // Update stat counters
      const stats = data.stats || {};
      statTotal.textContent = stats.total ?? allStudents.length;
      statEnrolled.textContent = stats.enrolled ?? 0;
      statPending.textContent = stats.pending ?? 0;
      statPrograms.textContent = stats.programs_count ?? availableCourses.length;

      // Populate course filter dropdown once
      populateCourseSelects();

      // Render Table
      renderTable();
    } catch (err) {
      console.error("Error loading student records:", err);
      showAlert("Could not load student directory. Please check network connection.", "error");
    }
  }

  // Populate course selects
  let coursesPopulated = false;
  function populateCourseSelects() {
    if (coursesPopulated || !availableCourses.length) return;

    if (courseFilterSelect) {
      courseFilterSelect.innerHTML = '<option value="">All Programs</option>';
      availableCourses.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.course_id;
        opt.textContent = c.course_name;
        courseFilterSelect.appendChild(opt);
      });
    }

    if (editCourse) {
      editCourse.innerHTML = '<option value="">-- Select Program --</option>';
      availableCourses.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.course_id;
        opt.textContent = c.course_name;
        editCourse.appendChild(opt);
      });
    }

    if (newCourse) {
      newCourse.innerHTML = '<option value="">-- Select Program --</option>';
      availableCourses.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.course_id;
        opt.textContent = c.course_name;
        newCourse.appendChild(opt);
      });
    }

    coursesPopulated = true;
  }

  // ---- Render Table ----
  function renderTable() {
    recordsTableBody.innerHTML = "";

    if (!allStudents.length) {
      recordsTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="table-empty-state">
              <i class="fa-regular fa-folder-open"></i>
              <h3>No student records found</h3>
              <p>There are no student profiles matching your current filters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    allStudents.forEach((student) => {
      const tr = document.createElement("tr");

      const studentIdCode = `STU-${String(student.student_info_id).padStart(4, "0")}`;
      const fullName = student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim();

      // Enrollment Status
      const latestEnr = student.latest_enrollment;
      const enrStatus = latestEnr ? latestEnr.status : "Not Enrolled";
      const isEnrolled = enrStatus.toLowerCase() === "enrolled";
      const isPending = enrStatus.toLowerCase() === "pending";

      const statusBadge = `
        <span class="status-badge ${isEnrolled ? "enrolled" : isPending ? "pending" : "none"}">
          <i class="fa-solid ${isEnrolled ? "fa-circle-check" : isPending ? "fa-clock" : "fa-circle-minus"}"></i>
          ${escapeHtml(enrStatus)}
        </span>
      `;

      // Portal user badge
      const userBadge = student.has_portal_account && student.username
        ? `<span class="account-status-pill has-user"><i class="fa-solid fa-user-check"></i> ${escapeHtml(student.username)}</span>`
        : `<span class="account-status-pill no-user"><i class="fa-solid fa-user-xmark"></i> No Portal</span>`;

      tr.innerHTML = `
        <td>
          <div class="student-meta-cell">
            <span class="id-badge">${studentIdCode}</span>
            ${userBadge}
          </div>
        </td>
        <td>
          <div class="student-meta-cell">
            <span class="student-name-bold">${escapeHtml(fullName)}</span>
            <span class="student-sub-info">${escapeHtml(student.birthdate || "Birthdate unrecorded")}</span>
          </div>
        </td>
        <td>
          <span style="font-weight: 600; color: navy;">${escapeHtml(student.course || "—")}</span>
        </td>
        <td>
          <span style="font-weight: 600;">${escapeHtml(student.year || "—")}</span>
          <div style="font-size: 12px; color: #334155;">${escapeHtml(student.semester || "—")}</div>
        </td>
        <td>
          <span style="font-size: 12.5px; font-weight: 600; color: #334155;">${escapeHtml(student.preferred_schedule || "Regular")}</span>
        </td>
        <td>
          ${statusBadge}
          ${
            latestEnr && latestEnr.enrollment_id
              ? `<div style="font-size: 11px; font-family: monospace; color: #334155; margin-top: 3px;">ID: ${escapeHtml(latestEnr.enrollment_id)}</div>`
              : ""
          }
        </td>
        <td>
          <div class="action-buttons-group">
            <button type="button" class="btn-action view" title="View Full Student Record" onclick="window.viewStudentRecord(${student.student_info_id})">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button type="button" class="btn-action edit" title="Edit Student Record" onclick="window.editStudentRecord(${student.student_info_id})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
        </td>
      `;

      recordsTableBody.appendChild(tr);
    });
  }

  // ---- View Detailed Student Record ----
  window.viewStudentRecord = async function (studentInfoId) {
    try {
      activeStudentId = studentInfoId;

      const response = await fetch(`/api/student/records/${studentInfoId}`, {
        method: "GET",
        headers: CEC.authHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to load student record details");
      }

      const record = await response.json();
      activeStudentDetail = record;

      // Header details
      const studentIdCode = `STU-${String(record.student_info_id).padStart(4, "0")}`;
      if (viewStudentName) viewStudentName.textContent = record.full_name || `${record.first_name || ""} ${record.last_name || ""}`.trim();
      if (viewStudentId) viewStudentId.textContent = studentIdCode;
      if (viewStudentProgram) viewStudentProgram.textContent = `${record.course || "—"} · ${record.year || record.year_level || "—"} (${record.semester || "—"})`;

      // Status
      const latestEnr = record.enrollments && record.enrollments.length ? record.enrollments[0] : null;
      const isEnrolled = latestEnr && (latestEnr.status || "").toLowerCase() === "enrolled";
      const isPending = latestEnr && (latestEnr.status || "").toLowerCase() === "pending";

      if (viewStudentStatus) {
        viewStudentStatus.className = `status-badge ${isEnrolled ? "enrolled" : isPending ? "pending" : "none"}`;
        viewStudentStatus.innerHTML = `
          <i class="fa-solid ${isEnrolled ? "fa-circle-check" : isPending ? "fa-clock" : "fa-circle-minus"}"></i>
          ${escapeHtml(latestEnr ? latestEnr.status : "Not Enrolled")}
        `;
      }

      // Tab 1: Profile Information
      setText("vFullName", record.full_name || `${record.first_name || ""} ${record.last_name || ""}`.trim());
      setText("vBirthdate", record.birthdate || record.birthdate_iso);
      setText("vPhone", record.phone_number);
      setText("vEmail", record.email);
      setText("vAddress", record.home_address);
      setText("vCourse", record.course);
      setText("vYearSem", `${record.year || record.year_level || "—"} · ${record.semester || "—"}`);
      setText("vSchedule", record.preferred_schedule);
      setText("vPortalUser", record.user ? record.user.username : "No Portal Account");
      setText("vPortalRole", record.user ? record.user.role : "N/A");

      // Tab 2: Enrollment History & Documents
      const enrollListContainer = document.getElementById("vEnrollmentsList");
      enrollListContainer.innerHTML = "";

      if (record.enrollments && record.enrollments.length) {
        record.enrollments.forEach((enr) => {
          const isEnrDone = (enr.status || "").toLowerCase() === "enrolled";
          const card = document.createElement("div");
          card.className = "history-item-card";

          const docs = enr.documents || [];
          let docsHtml = "";
          if (docs.length) {
            docsHtml = docs
              .map((d) => {
                const sub = d.status === "Submitted";
                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 12.5px;">
                    <span><i class="fa-solid ${sub ? "fa-check" : "fa-hourglass"}"></i> ${escapeHtml(d.requirement_name)}</span>
                    <span class="status-badge ${sub ? "enrolled" : "pending"}" style="padding: 2px 8px; font-size: 11px;">${escapeHtml(d.status)}</span>
                  </div>
                `;
              })
              .join("");
          } else {
            docsHtml = `<p style="font-size: 12px; color: #334155; margin: 4px 0 0;">No document checklist attached.</p>`;
          }

          card.innerHTML = `
            <div class="history-item-header">
              <div>
                <strong style="font-family: monospace; color: navy; font-size: 15px;">Tracking ID: ${escapeHtml(enr.enrollment_id)}</strong>
                <span class="id-badge" style="margin-left: 8px;">${escapeHtml(enr.enrollment_type || "Student")}</span>
              </div>
              <span class="status-badge ${isEnrDone ? "enrolled" : "pending"}">${escapeHtml(enr.status)}</span>
            </div>
            <div style="font-size: 12.5px; color: #334155;">
              Clearance &amp; Physical Documents (${enr.submitted_documents || 0}/${enr.total_documents || docs.length} Verified):
            </div>
            <div style="background: white; border-radius: 8px; padding: 8px 12px; border: 1px solid #e2e8f0;">
              ${docsHtml}
            </div>
          `;
          enrollListContainer.appendChild(card);
        });
      } else {
        enrollListContainer.innerHTML = `
          <div style="text-align: center; color: #334155; padding: 20px;">
            No enrollment records on file for this student.
          </div>
        `;
      }

      // Tab 3: Official Document Requests
      const requestsContainer = document.getElementById("vRequestsList");
      requestsContainer.innerHTML = "";

      if (record.document_requests && record.document_requests.length) {
        record.document_requests.forEach((req) => {
          const reqCard = document.createElement("div");
          reqCard.className = "history-item-card";
          reqCard.innerHTML = `
            <div class="history-item-header">
              <div>
                <strong style="color: navy;">${escapeHtml(req.document_name || "Document Request")}</strong>
                <span style="font-family: monospace; font-size: 12px; color: #334155; margin-left: 6px;">(${escapeHtml(req.request_id)})</span>
              </div>
              <span class="status-badge ${req.status === "Released" ? "enrolled" : req.status === "Pending" ? "pending" : "enrolled"}">
                ${escapeHtml(req.status)}
              </span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12.5px; color: #334155;">
              <div>Purpose: <strong>${escapeHtml(req.purpose || "—")}</strong></div>
              <div>Copies: <strong>${req.copies || 1}</strong></div>
              <div>Submitted: <strong>${escapeHtml(req.created_at || "—")}</strong></div>
              <div>Location: <strong>${escapeHtml(req.pickup_location || "Registrar")}</strong></div>
            </div>
          `;
          requestsContainer.appendChild(reqCard);
        });
      } else {
        requestsContainer.innerHTML = `
          <div style="text-align: center; color: #334155; padding: 20px;">
            No official document requests recorded for this student.
          </div>
        `;
      }

      // Reset tabs to default (first tab)
      resetModalTabs();

      // Open Modal
      viewRecordModal.classList.add("active");
    } catch (err) {
      console.error("Error viewing student record:", err);
      showAlert(`Could not load student profile: ${err.message}`, "error");
    }
  };

  // Close View Modal
  function closeViewModal() {
    if (viewRecordModal) viewRecordModal.classList.remove("active");
  }

  if (closeViewModalBtn) closeViewModalBtn.addEventListener("click", closeViewModal);
  if (closeViewModalFooterBtn) closeViewModalFooterBtn.addEventListener("click", closeViewModal);

  // Tab switching inside View Modal
  modalTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      modalTabBtns.forEach((b) => b.classList.remove("active"));
      modalTabPanels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const targetPanel = document.getElementById(targetTab);
      if (targetPanel) targetPanel.classList.add("active");
    });
  });

  function resetModalTabs() {
    modalTabBtns.forEach((b, idx) => {
      b.classList.toggle("active", idx === 0);
    });
    modalTabPanels.forEach((p, idx) => {
      p.classList.toggle("active", idx === 0);
    });
  }

  // Edit from View Modal button
  if (editFromViewBtn) {
    editFromViewBtn.addEventListener("click", () => {
      closeViewModal();
      if (activeStudentId) {
        window.editStudentRecord(activeStudentId);
      }
    });
  }

  // Print Student Record from View Modal
  if (printRecordBtn) {
    printRecordBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // ---- Edit Student Record ----
  window.editStudentRecord = function (studentInfoId) {
    const student = allStudents.find((s) => s.student_info_id === studentInfoId);
    if (!student) return;

    activeStudentId = studentInfoId;
    editStudentInfoId.value = student.student_info_id;
    editFirstName.value = student.first_name || "";
    editMiddleName.value = student.middle_name || "";
    editLastName.value = student.last_name || "";
    editSuffix.value = student.suffix || "";
    editBirthdate.value = student.birthdate_iso || "";
    editPhone.value = student.phone_number || "";
    editEmail.value = student.email || "";
    editAddress.value = student.home_address || "";

    if (student.course_id && editCourse) {
      editCourse.value = student.course_id;
    }
    if (student.year && editYearLevel) {
      editYearLevel.value = student.year;
    }
    if (student.semester && editSemester) {
      editSemester.value = student.semester;
    }
    if (student.preferred_schedule && editSchedule) {
      editSchedule.value = student.preferred_schedule;
    }

    editRecordModal.classList.add("active");
  };

  // Close Edit Modal
  function closeEditModal() {
    if (editRecordModal) editRecordModal.classList.remove("active");
  }

  if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", closeEditModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditModal);

  // Submit Edit Form
  if (editRecordForm) {
    editRecordForm.addEventListener("submit", async function (ev) {
      ev.preventDefault();

      const studentId = editStudentInfoId.value;
      const payload = {
        first_name: editFirstName.value.trim(),
        middle_name: editMiddleName.value.trim(),
        last_name: editLastName.value.trim(),
        suffix: editSuffix.value.trim(),
        birthdate: editBirthdate.value,
        phone_number: editPhone.value.trim(),
        email: editEmail.value.trim(),
        home_address: editAddress.value.trim(),
        course_id: parseInt(editCourse.value, 10),
        year_level: editYearLevel.value,
        semester: editSemester.value,
        preferred_schedule: editSchedule.value,
      };

      try {
        saveEditBtn.disabled = true;
        saveEditBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

        const response = await fetch(`/api/student/records/${studentId}`, {
          method: "PUT",
          headers: CEC.authHeaders(),
          body: JSON.stringify(payload),
        });

        const resData = await response.json();

        if (!response.ok) {
          throw new Error(resData.msg || "Failed to update record.");
        }

        closeEditModal();
        showAlert("Student record successfully updated!", "success");
        await loadStudentRecords();
      } catch (err) {
        console.error("Error updating record:", err);
        alert(`Update Failed: ${err.message}`);
      } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.innerHTML = `<i class="fa-solid fa-check"></i> Save Changes`;
      }
    });
  }

  // ---- New Student Registration Modal ----
  if (newStudentRecordBtn) {
    newStudentRecordBtn.addEventListener("click", () => {
      if (newRecordForm) newRecordForm.reset();
      populateCourseSelects();
      newRecordModal.classList.add("active");
    });
  }

  function closeNewModal() {
    if (newRecordModal) newRecordModal.classList.remove("active");
  }

  if (closeNewModalBtn) closeNewModalBtn.addEventListener("click", closeNewModal);
  if (cancelNewBtn) cancelNewBtn.addEventListener("click", closeNewModal);

  if (newRecordForm) {
    newRecordForm.addEventListener("submit", async function (ev) {
      ev.preventDefault();

      const payload = {
        first_name: document.getElementById("newFirstName").value.trim(),
        middle_name: document.getElementById("newMiddleName").value.trim(),
        last_name: document.getElementById("newLastName").value.trim(),
        suffix: document.getElementById("newSuffix").value.trim(),
        birthdate: document.getElementById("newBirthdate").value,
        email: document.getElementById("newEmail").value.trim(),
        phone_number: document.getElementById("newPhone").value.trim(),
        home_address: document.getElementById("newAddress").value.trim(),
        course_id: parseInt(newCourse.value, 10),
        year_level: document.getElementById("newYearLevel").value,
        semester: document.getElementById("newSemester").value,
        preferred_schedule: document.getElementById("newSchedule").value,
        enrollment_type_id: parseInt(document.getElementById("newEnrollmentType").value, 10) || 2,
      };

      try {
        saveNewBtn.disabled = true;
        saveNewBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating...`;

        const response = await fetch("/api/student/records", {
          method: "POST",
          headers: CEC.authHeaders(),
          body: JSON.stringify(payload),
        });

        const resData = await response.json();

        if (!response.ok) {
          throw new Error(resData.msg || "Failed to create student record.");
        }

        closeNewModal();
        showAlert("New student record registered successfully!", "success");
        await loadStudentRecords();
      } catch (err) {
        console.error("Error creating student record:", err);
        alert(`Creation Failed: ${err.message}`);
      } finally {
        saveNewBtn.disabled = false;
        saveNewBtn.innerHTML = `<i class="fa-solid fa-check"></i> Register Student Record`;
      }
    });
  }

  // ---- Filtering & Search Listeners ----
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.getAttribute("data-filter") || "all";
      loadStudentRecords();
    });
  });

  // Stat card click to filter
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("click", () => {
      const filter = card.getAttribute("data-filter");
      if (!filter) return;
      currentFilter = filter;
      filterPills.forEach((p) => {
        p.classList.toggle("active", p.getAttribute("data-filter") === filter);
      });
      loadStudentRecords();
    });
  });

  // Debounced search
  let searchTimeout = null;
  if (recordSearchInput) {
    recordSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadStudentRecords();
      }, 350);
    });
  }

  if (courseFilterSelect) {
    courseFilterSelect.addEventListener("change", () => {
      loadStudentRecords();
    });
  }

  if (yearFilterSelect) {
    yearFilterSelect.addEventListener("change", () => {
      loadStudentRecords();
    });
  }

  if (refreshRecordsBtn) {
    refreshRecordsBtn.addEventListener("click", async () => {
      refreshRecordsBtn.disabled = true;
      refreshRecordsBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> Refreshing...`;
      await loadStudentRecords();
      refreshRecordsBtn.disabled = false;
      refreshRecordsBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Refresh`;
    });
  }

  // Print Master List
  if (printMasterListBtn) {
    printMasterListBtn.addEventListener("click", () => {
      if (printTimestamp) {
        const now = new Date();
        printTimestamp.textContent = `Generated on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      }
      window.print();
    });
  }

  // Helper Escape HTML
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize
  loadStudentRecords();
})();
