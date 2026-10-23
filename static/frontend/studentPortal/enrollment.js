/* =========================================================
   STUDENT ENROLLMENT TAB SCRIPT (enrollment.js)
   Handles student re-enrollment as an Old/Returnee Student.
   No new account is made; updates student data connected
   with the account.
   ========================================================= */

(function () {
  "use strict";

  // Bootstrap shared auth and navbar
  CEC.initUserMenu();
  if (!CEC.requireAuth()) return;

  CEC.loadUserDetails({
    nameId: "userName",
    roleId: "userRole",
    welcomeId: "welcomeName",
    subtitleId: "programSubtitle",
    defaultName: "Student",
  });

  // ---- State ----
  let studentData = null;
  let activeEnrollment = null;
  let allEnrollments = [];
  let availableCourses = [];
  let oldStudentRequirements = [];
  let hasPendingEnrollment = false;

  // ---- DOM Elements ----
  const enrollmentAlert = document.getElementById("enrollmentAlert");
  const refreshEnrollmentBtn = document.getElementById("refreshEnrollmentBtn");

  // Stat Elements
  const statStatusVal = document.getElementById("statStatusVal");
  const statTrackingVal = document.getElementById("statTrackingVal");
  const statProgramVal = document.getElementById("statProgramVal");
  const statDocsVal = document.getElementById("statDocsVal");

  // Active Enrollment Box
  const activeEnrollmentBox = document.getElementById("activeEnrollmentBox");
  const noActiveEnrollmentBox = document.getElementById("noActiveEnrollmentBox");
  const activeTrackingId = document.getElementById("activeTrackingId");
  const activeStatusBadge = document.getElementById("activeStatusBadge");
  const activeTypeBadge = document.getElementById("activeTypeBadge");
  const activeCourseTerm = document.getElementById("activeCourseTerm");
  const activeSchedule = document.getElementById("activeSchedule");
  const activeDocsProgress = document.getElementById("activeDocsProgress");
  const activeDocsList = document.getElementById("activeDocsList");
  const copyTrackingBtn = document.getElementById("copyTrackingBtn");

  // Re-enrollment Form
  const reenrollForm = document.getElementById("reenrollForm");
  const accountUsername = document.getElementById("accountUsername");
  const accountEmail = document.getElementById("accountEmail");
  const studentFullName = document.getElementById("studentFullName");
  const reEnrollCourse = document.getElementById("reEnrollCourse");
  const reEnrollYear = document.getElementById("reEnrollYear");
  const reEnrollSemester = document.getElementById("reEnrollSemester");
  const reEnrollSchedule = document.getElementById("reEnrollSchedule");
  const reEnrollPhone = document.getElementById("reEnrollPhone");
  const reEnrollAddress = document.getElementById("reEnrollAddress");
  const reEnrollSubmitBtn = document.getElementById("reEnrollSubmitBtn");
  const formStatusNotice = document.getElementById("formStatusNotice");

  // History Table
  const enrollmentHistoryBody = document.getElementById("enrollmentHistoryBody");

  // Confirmation Modal
  const confirmModal = document.getElementById("confirmReenrollModal");
  const closeConfirmModalBtn = document.getElementById("closeConfirmModalBtn");
  const cancelConfirmModalBtn = document.getElementById("cancelConfirmModalBtn");
  const proceedSubmitBtn = document.getElementById("proceedSubmitBtn");
  const reviewProgram = document.getElementById("reviewProgram");
  const reviewYearSem = document.getElementById("reviewYearSem");
  const reviewSchedule = document.getElementById("reviewSchedule");
  const reviewContact = document.getElementById("reviewContact");

  // Success Modal
  const successModal = document.getElementById("successReenrollModal");
  const closeSuccessModalBtn = document.getElementById("closeSuccessModalBtn");
  const doneSuccessModalBtn = document.getElementById("doneSuccessModalBtn");
  const successTrackingCode = document.getElementById("successTrackingCode");
  const successProgram = document.getElementById("successProgram");
  const copySuccessCodeBtn = document.getElementById("copySuccessCodeBtn");

  // ---- Alert Helper ----
  function showAlert(msg, type = "success") {
    if (!enrollmentAlert) return;
    enrollmentAlert.textContent = msg;
    enrollmentAlert.className = `enrollment-alert ${type}`;
    enrollmentAlert.style.display = "flex";
    setTimeout(() => {
      enrollmentAlert.style.display = "none";
    }, 6000);
  }

  // ---- Fetch & Load Data ----
  async function loadEnrollmentDetails() {
    try {
      const response = await fetch("/api/student/enrollment-details", {
        method: "GET",
        headers: CEC.authHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          CEC.handleAuthFailure();
          return;
        }
        throw new Error(`Failed to load details (HTTP ${response.status})`);
      }

      const data = await response.json();
      studentData = data;
      activeEnrollment = data.active_enrollment;
      allEnrollments = data.enrollments || [];
      availableCourses = data.courses || [];
      oldStudentRequirements = data.requirements || [];
      hasPendingEnrollment = !!data.has_pending_enrollment;

      renderStats();
      renderActiveEnrollment();
      populateForm();
      renderHistoryTable();
    } catch (err) {
      console.error("Error loading enrollment details:", err);
      showAlert("Could not load your enrollment records. Please refresh.", "error");
    }
  }

  // ---- Render Quick Stat Cards ----
  function renderStats() {
    const profile = studentData?.profile;

    // Status Card
    if (activeEnrollment) {
      const isEnrolled = (activeEnrollment.status || "").toLowerCase() === "enrolled";
      statStatusVal.textContent = isEnrolled ? "Officially Enrolled" : "Pending Verification";
      statStatusVal.style.color = isEnrolled ? "#166534" : "#b45309";
      statTrackingVal.textContent = activeEnrollment.enrollment_id || "—";
    } else {
      statStatusVal.textContent = "Eligible to Re-enroll";
      statStatusVal.style.color = "#0284c7";
      statTrackingVal.textContent = "None";
    }

    // Program Card
    if (profile && profile.course) {
      statProgramVal.textContent = `${profile.course} (${profile.year || "—"})`;
    } else {
      statProgramVal.textContent = "Not Selected";
    }

    // Clearance Documents Card
    if (activeEnrollment && activeEnrollment.documents) {
      const total = activeEnrollment.documents.length;
      const submitted = activeEnrollment.submitted_documents || 0;
      statDocsVal.textContent = `${submitted} of ${total} Submitted`;
      statDocsVal.style.color = submitted === total && total > 0 ? "#166534" : "#b45309";
    } else {
      statDocsVal.textContent = "2 Required for Returnees";
      statDocsVal.style.color = "#64748b";
    }
  }

  // ---- Render Active Enrollment & Document Verification Checklist ----
  function renderActiveEnrollment() {
    if (!activeEnrollment) {
      activeEnrollmentBox.style.display = "none";
      noActiveEnrollmentBox.style.display = "block";
      return;
    }

    activeEnrollmentBox.style.display = "flex";
    noActiveEnrollmentBox.style.display = "none";

    const isEnrolled = (activeEnrollment.status || "").toLowerCase() === "enrolled";
    activeTrackingId.textContent = activeEnrollment.enrollment_id || "—";

    activeStatusBadge.className = `card-badge ${isEnrolled ? "enrolled" : "pending"}`;
    activeStatusBadge.innerHTML = isEnrolled
      ? `<i class="fa-solid fa-circle-check"></i> Officially Enrolled`
      : `<i class="fa-solid fa-clock"></i> Pending Verification`;

    activeTypeBadge.textContent = activeEnrollment.enrollment_type || "Old/Returnee Student";

    const sInfo = activeEnrollment.student_info || studentData?.profile || {};
    activeCourseTerm.textContent = `${sInfo.course || "—"} · ${sInfo.year || sInfo.year_level || "—"} (${sInfo.semester || "—"})`;
    activeSchedule.textContent = sInfo.preferred_schedule || "Regular Schedule";

    // Documents Checklist
    const docs = activeEnrollment.documents || [];
    const submittedCount = activeEnrollment.submitted_documents || docs.filter(d => d.status === "Submitted").length;
    const totalCount = docs.length || oldStudentRequirements.length || 2;

    activeDocsProgress.textContent = `${submittedCount} of ${totalCount} Office Verified`;

    activeDocsList.innerHTML = "";

    // If documents are initialized on enrollment
    if (docs.length > 0) {
      docs.forEach((doc) => {
        const isDocSubmitted = (doc.status || "").toLowerCase() === "submitted";
        const docItem = document.createElement("div");
        docItem.className = `doc-check-item ${isDocSubmitted ? "submitted" : "pending"}`;
        docItem.innerHTML = `
          <div class="doc-check-left">
            <div class="doc-icon-wrap">
              <i class="fa-solid ${isDocSubmitted ? "fa-circle-check" : "fa-file-lines"}"></i>
            </div>
            <div>
              <p class="doc-name">${escapeHtml(doc.requirement_name || "Clearance Document")}</p>
              <p class="doc-sub">${
                isDocSubmitted
                  ? `Confirmed by Registrar Office ${doc.verified_at ? "· " + doc.verified_at : ""}`
                  : "Must be submitted physically to the Office of the Registrar"
              }</p>
            </div>
          </div>
          <span class="doc-status-pill ${isDocSubmitted ? "submitted" : "pending"}">
            ${isDocSubmitted ? '<i class="fa-solid fa-check"></i> Submitted' : '<i class="fa-solid fa-hourglass-half"></i> Pending Office Submission'}
          </span>
        `;
        activeDocsList.appendChild(docItem);
      });
    } else {
      // Fallback display from oldStudentRequirements
      oldStudentRequirements.forEach((req) => {
        const docItem = document.createElement("div");
        docItem.className = "doc-check-item pending";
        docItem.innerHTML = `
          <div class="doc-check-left">
            <div class="doc-icon-wrap">
              <i class="fa-solid fa-file-lines"></i>
            </div>
            <div>
              <p class="doc-name">${escapeHtml(req.requirement_name)}</p>
              <p class="doc-sub">Must be submitted physically to the Office of the Registrar</p>
            </div>
          </div>
          <span class="doc-status-pill pending">
            <i class="fa-solid fa-hourglass-half"></i> Pending Office Submission
          </span>
        `;
        activeDocsList.appendChild(docItem);
      });
    }
  }

  // ---- Populate Re-enrollment Form ----
  function populateForm() {
    const user = studentData?.user || {};
    const profile = studentData?.profile || {};

    accountUsername.textContent = user.username || "—";
    accountEmail.textContent = user.email || "—";

    const parts = [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].filter(Boolean);
    studentFullName.value = parts.join(" ") || user.username || "Student";

    // Populate course select
    reEnrollCourse.innerHTML = '<option value="">-- Select Degree Program --</option>';
    availableCourses.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.course_id;
      opt.textContent = c.course_name;
      if (profile.course_id && parseInt(profile.course_id, 10) === parseInt(c.course_id, 10)) {
        opt.selected = true;
      }
      reEnrollCourse.appendChild(opt);
    });

    // Populate year level
    if (profile.year) {
      selectMatchingOption(reEnrollYear, profile.year);
    }

    // Populate semester
    if (profile.semester) {
      selectMatchingOption(reEnrollSemester, profile.semester);
    }

    // Populate schedule
    if (profile.preferred_schedule) {
      selectMatchingOption(reEnrollSchedule, profile.preferred_schedule);
    }

    // Contact info
    reEnrollPhone.value = profile.phone_number || "";
    reEnrollAddress.value = profile.home_address || "";

    // Manage button state if pending application exists
    if (hasPendingEnrollment) {
      reEnrollSubmitBtn.disabled = true;
      reEnrollSubmitBtn.innerHTML = `<i class="fa-solid fa-clock"></i> Re-enrollment Application Pending`;
      formStatusNotice.style.display = "flex";
      formStatusNotice.innerHTML = `
        <i class="fa-solid fa-circle-exclamation"></i>
        <div>
          <strong>Re-enrollment Under Review:</strong> You already have an active pending re-enrollment application (Tracking ID: <strong>${activeEnrollment?.enrollment_id || "—"}</strong>). Please submit your physical Study Load and Clearance Form to the Registrar to finalize your enrollment.
        </div>
      `;
    } else {
      reEnrollSubmitBtn.disabled = false;
      reEnrollSubmitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Re-enrollment Application`;
      formStatusNotice.style.display = "none";
    }
  }

  // ---- Render Enrollment History Table ----
  function renderHistoryTable() {
    enrollmentHistoryBody.innerHTML = "";

    if (!allEnrollments || allEnrollments.length === 0) {
      enrollmentHistoryBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">
            No past enrollment records found.
          </td>
        </tr>
      `;
      return;
    }

    allEnrollments.forEach((e) => {
      const tr = document.createElement("tr");
      const isEnrolled = (e.status || "").toLowerCase() === "enrolled";
      const sInfo = e.student_info || {};
      const docsCount = e.documents ? `${e.submitted_documents || 0}/${e.documents.length}` : "—";

      tr.innerHTML = `
        <td><strong style="font-family: monospace; color: navy;">${escapeHtml(e.enrollment_id)}</strong></td>
        <td><span class="card-badge type-badge">${escapeHtml(e.enrollment_type || "Old/Returnee")}</span></td>
        <td>${escapeHtml(sInfo.course || "—")}</td>
        <td>${escapeHtml(sInfo.year || sInfo.year_level || "—")} · ${escapeHtml(sInfo.semester || "—")}</td>
        <td>
          <span class="status-badge ${isEnrolled ? "enrolled" : "pending"}">
            <i class="fa-solid ${isEnrolled ? "fa-circle-check" : "fa-clock"}"></i>
            ${escapeHtml(e.status || "Pending")}
          </span>
        </td>
        <td>${docsCount} Submitted</td>
      `;
      enrollmentHistoryBody.appendChild(tr);
    });
  }

  // ---- Form Submission & Review Modal ----
  if (reenrollForm) {
    reenrollForm.addEventListener("submit", function (ev) {
      ev.preventDefault();

      if (hasPendingEnrollment) {
        alert("You already have an active re-enrollment application pending verification.");
        return;
      }

      if (!reEnrollCourse.value) {
        alert("Please select a degree program.");
        reEnrollCourse.focus();
        return;
      }

      if (!reEnrollYear.value) {
        alert("Please select your year level.");
        reEnrollYear.focus();
        return;
      }

      if (!reEnrollSemester.value) {
        alert("Please select your semester.");
        reEnrollSemester.focus();
        return;
      }

      // Populate review modal
      const selectedCourseText = reEnrollCourse.options[reEnrollCourse.selectedIndex].text;
      reviewProgram.textContent = selectedCourseText;
      reviewYearSem.textContent = `${reEnrollYear.value} · ${reEnrollSemester.value}`;
      reviewSchedule.textContent = reEnrollSchedule.value;
      reviewContact.textContent = `${reEnrollPhone.value || "—"} (${reEnrollAddress.value || "—"})`;

      // Open review modal
      confirmModal.classList.add("active");
    });
  }

  // Close Review Modal
  function closeConfirmModal() {
    if (confirmModal) confirmModal.classList.remove("active");
  }

  if (closeConfirmModalBtn) closeConfirmModalBtn.addEventListener("click", closeConfirmModal);
  if (cancelConfirmModalBtn) cancelConfirmModalBtn.addEventListener("click", closeConfirmModal);

  // Proceed Submit Re-enrollment
  if (proceedSubmitBtn) {
    proceedSubmitBtn.addEventListener("click", async function () {
      const payload = {
        course_id: parseInt(reEnrollCourse.value, 10),
        year_level: reEnrollYear.value,
        semester: reEnrollSemester.value,
        preferred_schedule: reEnrollSchedule.value,
        phone_number: reEnrollPhone.value.trim(),
        home_address: reEnrollAddress.value.trim(),
      };

      try {
        proceedSubmitBtn.disabled = true;
        proceedSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;

        const response = await fetch("/api/student/reenroll", {
          method: "POST",
          headers: CEC.authHeaders(),
          body: JSON.stringify(payload),
        });

        const resData = await response.json();

        if (!response.ok) {
          throw new Error(resData.msg || "Failed to submit re-enrollment.");
        }

        // Close confirmation modal
        closeConfirmModal();

        // Populate and open success modal
        successTrackingCode.textContent = resData.enrollment_id || "—";
        const selectedCourseText = reEnrollCourse.options[reEnrollCourse.selectedIndex].text;
        successProgram.textContent = `${selectedCourseText} (${payload.year_level}, ${payload.semester})`;

        successModal.classList.add("active");

        showAlert("Re-enrollment application successfully submitted!", "success");

        // Reload fresh enrollment details
        await loadEnrollmentDetails();
      } catch (err) {
        console.error("Re-enrollment error:", err);
        alert(`Submission Failed: ${err.message}`);
      } finally {
        proceedSubmitBtn.disabled = false;
        proceedSubmitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Confirm Re-enrollment`;
      }
    });
  }

  // Close Success Modal
  function closeSuccessModal() {
    if (successModal) successModal.classList.remove("active");
  }

  if (closeSuccessModalBtn) closeSuccessModalBtn.addEventListener("click", closeSuccessModal);
  if (doneSuccessModalBtn) doneSuccessModalBtn.addEventListener("click", closeSuccessModal);

  // ---- Copy Tracking Code Helpers ----
  function copyTextToClipboard(text, btnEl) {
    if (!text || text === "—") return;
    navigator.clipboard.writeText(text).then(() => {
      const originalHtml = btnEl.innerHTML;
      btnEl.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
      setTimeout(() => {
        btnEl.innerHTML = originalHtml;
      }, 2000);
    });
  }

  if (copyTrackingBtn) {
    copyTrackingBtn.addEventListener("click", () => {
      copyTextToClipboard(activeTrackingId.textContent, copyTrackingBtn);
    });
  }

  if (copySuccessCodeBtn) {
    copySuccessCodeBtn.addEventListener("click", () => {
      copyTextToClipboard(successTrackingCode.textContent, copySuccessCodeBtn);
    });
  }

  // Refresh Button
  if (refreshEnrollmentBtn) {
    refreshEnrollmentBtn.addEventListener("click", async () => {
      refreshEnrollmentBtn.disabled = true;
      refreshEnrollmentBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> Refreshing...`;
      await loadEnrollmentDetails();
      refreshEnrollmentBtn.disabled = false;
      refreshEnrollmentBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Refresh`;
    });
  }

  // ---- Helper Utilities ----
  function selectMatchingOption(selectEl, textVal) {
    if (!selectEl || !textVal) return;
    const clean = textVal.trim().toLowerCase();
    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      if (opt.value.toLowerCase() === clean || opt.text.toLowerCase().includes(clean)) {
        opt.selected = true;
        return;
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize on page load
  loadEnrollmentDetails();
})();
