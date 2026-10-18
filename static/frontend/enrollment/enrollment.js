const API_BASE_URL = "";

// =========================================
// BACK BUTTON
// =========================================
const backButton = document.getElementById("backButton");
if (backButton) {
  backButton.addEventListener("click", function () {
    window.history.back();
  });
}

const loginButton = document.getElementById("loginButton");
if (loginButton) {
  loginButton.addEventListener("click", function () {
    window.location.href = "/index.html";
  });
}

// =========================================
// PROCEED TO PAGE 2 (form1.html logic)
// =========================================
const proceedNext = document.getElementById("proceedNext");
if (proceedNext) {
  proceedNext.addEventListener("click", function () {
    const enrollmentForm = document.getElementById("enrollmentForm");

    if (!enrollmentForm.checkValidity()) {
      enrollmentForm.reportValidity();
      return;
    }

    // Helper function to format YYYY-MM-DD into MM/DD/YY
    const rawBirthdate = document.getElementById("birthdate").value;
    let formattedBirthdate = rawBirthdate;

    if (rawBirthdate) {
      const [year, month, day] = rawBirthdate.split("-");
      if (year && month && day) {
        const shortYear = year.slice(-2);
        formattedBirthdate = `${month}/${day}/${shortYear}`;
      }
    }

    const studentInformation = {
      first_name: document.getElementById("first-name").value,
      middle_name: document.getElementById("middle-name").value,
      last_name: document.getElementById("last-name").value,
      suffix: document.getElementById("suffix").value || null,
      birthdate: formattedBirthdate,
      phone_number: document.getElementById("phone").value, // Changed key from "phone number" to phone_number
      email: document.getElementById("email").value,
      home_address: document.getElementById("home-address").value,
    };

    sessionStorage.setItem(
      "studentInformation",
      JSON.stringify(studentInformation)
    );

    window.location.href = "form2.html";
  });
}

// =========================================
// TRACK APPLICATION & STATUS DISPLAY
// =========================================
async function trackApplication() {
  const trackingInput = document.getElementById("trackingNumber");
  if (!trackingInput) return;

  const trackingNumber = trackingInput.value.trim();

  if (!trackingNumber) {
    alert("Please enter your tracking number.");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/enrollments/${encodeURIComponent(trackingNumber)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`Tracking record not found (HTTP ${response.status})`);
    }

    const data = await response.json();

    if (response.ok) {
      displayTrackingResult(data);
    } else {
      alert(`Error: ${data.msg || "Enrollment record not found."}`);
    }
  } catch (error) {
    console.error("Error tracking application:", error);
    alert(`Tracking Error: ${error.message}`);
  }
}

function displayTrackingResult(data) {
  const modal = document.getElementById("trackingModal");
  if (!modal) return;

  const student = data.student_info || {};

  // Tracking ID
  setText("trackModalEnrollmentId", data.enrollment_id || "—");

  // Status Pill
  const statusPill = document.getElementById("trackModalStatusPill");
  if (statusPill) {
    const statusText = data.status || "Pending";
    statusPill.textContent = statusText;
    statusPill.className = "track-status-pill";
    if (statusText.toLowerCase() === "approved") {
      statusPill.classList.add("approved");
    } else if (statusText.toLowerCase() === "rejected" || statusText.toLowerCase() === "invalid") {
      statusPill.classList.add("rejected");
    }
  }

  // Personal Info
  setText("trackFirstName", student.first_name || "—");
  setText("trackMiddleName", student.middle_name || "—");
  setText("trackLastName", student.last_name || "—");
  setText("trackSuffix", student.suffix || "N/A");

  // Birthdate formatting MM/DD/YY
  let formattedBirthdate = student.birthdate || "—";
  if (student.birthdate) {
    try {
      const d = new Date(student.birthdate);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const yy = String(d.getFullYear()).slice(-2);
        formattedBirthdate = `${mm}/${dd}/${yy}`;
      }
    } catch (_) {}
  }
  setText("trackBirthdate", formattedBirthdate);

  setText("trackPhone", student.phone_number || "—");
  setText("trackAddress", student.home_address || "—");
  setText("trackEmail", student.email || "—");

  // Academic Info
  setText("trackCourse", student.course || "—");
  setText("trackSchedule", student.preferred_schedule || "—");

  const yearMap = { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year" };
  const semMap = { "1": "1st Semester", "2": "2nd Semester" };
  setText("trackYear", yearMap[student.year] || (student.year ? `${student.year} Year` : "—"));
  setText("trackSemester", semMap[student.semester] || (student.semester ? `${student.semester} Semester` : "—"));

  // Documents in Process
  const docsContainer = document.getElementById("trackDocumentsList");
  if (docsContainer) {
    docsContainer.innerHTML = "";

    const isOverallEnrolled = (data.status || "").toLowerCase() === "enrolled" || (data.status || "").toLowerCase() === "approved";
    const isOverallRejected = (data.status || "").toLowerCase() === "rejected";

    if (data.documents && data.documents.length > 0) {
      data.documents.forEach((doc) => {
        const row = document.createElement("div");
        row.className = "track-doc-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "track-doc-name";
        nameSpan.textContent = `${doc.requirement_name}:`;

        const statusSpan = document.createElement("span");
        statusSpan.className = "track-doc-status";

        if (isOverallEnrolled || doc.status === "Submitted") {
          statusSpan.classList.add("approved");
          statusSpan.textContent = "Approved";
        } else if (isOverallRejected || doc.status === "Invalid") {
          statusSpan.classList.add("invalid");
          statusSpan.textContent = "Invalid";
        } else {
          statusSpan.classList.add("processing");
          statusSpan.textContent = "Processing";
        }

        row.appendChild(nameSpan);
        row.appendChild(statusSpan);
        docsContainer.appendChild(row);
      });
    } else {
      const reqs = data.requirements && data.requirements.length > 0
        ? data.requirements
        : [
            "Senior High School Grades",
            "Scholarship Documents",
            "Good Moral",
            "Diploma",
            "Form 137",
          ];

      reqs.forEach((reqName) => {
        const row = document.createElement("div");
        row.className = "track-doc-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "track-doc-name";
        nameSpan.textContent = `${reqName}:`;

        const statusSpan = document.createElement("span");
        statusSpan.className = "track-doc-status";

        if (isOverallEnrolled) {
          statusSpan.classList.add("approved");
          statusSpan.textContent = "Approved";
        } else if (isOverallRejected) {
          statusSpan.classList.add("invalid");
          statusSpan.textContent = "Invalid";
        } else {
          statusSpan.classList.add("processing");
          statusSpan.textContent = "Processing";
        }

        row.appendChild(nameSpan);
        row.appendChild(statusSpan);
        docsContainer.appendChild(row);
      });
    }
  }

  // Show the tracking modal
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function closeTrackingModal() {
  const modal = document.getElementById("trackingModal");
  if (modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }
}

// =========================================
// ENROLLEE TYPE SELECTION HANDLERS
// =========================================
const old_student_div = document.getElementById("old-student-div");
if (old_student_div) {
  old_student_div.addEventListener("click", function () {
    setEnrollmentType(1, "Old/Returnee Student");
  });
}

const new_student_div = document.getElementById("new-student-div");
if (new_student_div) {
  new_student_div.addEventListener("click", function () {
    setEnrollmentType(2, "New Student");
  });
}

const transferee_div = document.getElementById("transferee-div");
if (transferee_div) {
  transferee_div.addEventListener("click", function () {
    setEnrollmentType(3, "Transferee Student");
  });
}

function setEnrollmentType(id, name) {
  const enrollmentType = { enrollment_type_id: id, enrollment_type_name: name };
  sessionStorage.removeItem("studentInformation");
  sessionStorage.setItem("enrollmentType", JSON.stringify(enrollmentType));
  window.location.href = "form1.html";
}

// =========================================
// INITIALIZATION LOGIC (DOM LOAD)
// =========================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Set page subtitle based on selected Enrollment Type
  let enrollmentType = sessionStorage.getItem("enrollmentType");
  if (enrollmentType) {
    enrollmentType = JSON.parse(enrollmentType);
    const sub_title = document.getElementById("sub-title");
    if (sub_title) {
      sub_title.innerText = `${enrollmentType["enrollment_type_name"]} Enrollment Form`;
    }
  }

  // 2. Load Courses (form2.html)
  const courseSelect = document.getElementById("course");
  if (courseSelect) {
    await loadCourses(courseSelect);
  }

  // 3. Fetch Document Requirements via POST /api/requirements (form2.html)
  const reqList = document.getElementById("requirements-list");
  if (reqList && enrollmentType) {
    await loadRequirements(enrollmentType.enrollment_type_id, reqList);
  }

  // 4. Handle final enrollment submission — show confirmation modal first
  const finalEnrollmentForm = document.getElementById("finalEnrollmentForm");
  if (finalEnrollmentForm) {
    finalEnrollmentForm.addEventListener("submit", showConfirmModal);
  }

  // 5. Wire the modal confirm button to do the real submission
  const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");
  if (confirmSubmitBtn) {
    confirmSubmitBtn.addEventListener("click", handleFormSubmission);
  }

  // 6. Wire the success modal go-back button
  const successGoBackBtn = document.getElementById("successGoBackBtn");
  if (successGoBackBtn) {
    successGoBackBtn.addEventListener("click", function () {
      sessionStorage.clear();
      window.location.href = "enrollmentWebsite.html";
    });
  }

  // 7. Wire tracking modal listeners (s.png modal)
  const closeTrackModalBtn = document.getElementById("closeTrackModalBtn");
  if (closeTrackModalBtn) {
    closeTrackModalBtn.addEventListener("click", closeTrackingModal);
  }

  const trackingModal = document.getElementById("trackingModal");
  if (trackingModal) {
    trackingModal.addEventListener("click", function (e) {
      if (e.target === trackingModal) {
        closeTrackingModal();
      }
    });
  }

  const trackingInput = document.getElementById("trackingNumber");
  if (trackingInput) {
    trackingInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        trackApplication();
      }
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeTrackingModal();
    }
  });
});

// =========================================
// SHOW CONFIRMATION MODAL
// =========================================
function showConfirmModal(e) {
  e.preventDefault();

  const storedInformation = sessionStorage.getItem("studentInformation");
  if (!storedInformation) {
    alert("Student information missing. Returning to step 1.");
    window.location.href = "enrollmentWebsite.html";
    return;
  }

  const info = JSON.parse(storedInformation);

  // --- Enrollee personal details ---
  setText("confirmFirstName",  info.first_name  || "—");
  setText("confirmMiddleName", info.middle_name || "—");
  setText("confirmLastName",   info.last_name   || "—");
  setText("confirmSuffix",     info.suffix      || "N/A");
  setText("confirmBirthdate",  info.birthdate   || "—");
  setText("confirmPhone",      info.phone_number || info.phone || "—");
  setText("confirmAddress",    info.home_address || "—");
  setText("confirmEmail",      info.email        || "—");

  // --- Photo (if previously uploaded on form1) ---
  const savedPhoto = sessionStorage.getItem("studentPhoto");
  const photoImg   = document.getElementById("confirmPhoto");
  const photoPlaceholder = document.getElementById("confirmPhotoPlaceholder");
  if (savedPhoto && photoImg && photoPlaceholder) {
    photoImg.src = savedPhoto;
    photoImg.classList.remove("hidden");
    photoPlaceholder.style.display = "none";
  }

  // --- Academic details from the form selects ---
  const courseSelect   = document.getElementById("course");
  const courseText     = courseSelect
    ? courseSelect.options[courseSelect.selectedIndex]?.text || "—"
    : "—";
  setText("confirmCourse",    courseText);
  setText("confirmSchedule",  getSelectText("schedule")  || "—");

  const yearMap = { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year" };
  const semMap  = { "1": "1st Semester", "2": "2nd Semester" };
  setText("confirmYear",     yearMap[document.getElementById("year")?.value]     || "—");
  setText("confirmSemester", semMap[document.getElementById("semester")?.value]   || "—");

  // --- Open modal ---
  const modal = document.getElementById("confirmModal");
  if (modal) {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
  }
}

// Helper: set inner text safely
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Helper: get displayed text of a <select>
function getSelectText(id) {
  const sel = document.getElementById(id);
  if (!sel) return "";
  return sel.options[sel.selectedIndex]?.text || "";
}

// Helper: Fetch Courses
async function loadCourses(selectElem) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/courses`);
    const courses = await res.json();

    selectElem.innerHTML = `<option value="" selected disabled>Select Course / Program</option>`;
    courses.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.course_id;
      opt.textContent = c.course_name;
      selectElem.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load courses:", err);
    selectElem.innerHTML = `<option value="" disabled>Error loading courses</option>`;
  }
}

// Helper: Fetch Requirements
async function loadRequirements(typeId, listElem) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/requirements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollment_type_id: typeId }),
    });

    if (!res.ok) throw new Error("Failed to load requirements");

    const requirements = await res.json();
    listElem.innerHTML = "";

    if (requirements.length === 0) {
      listElem.innerHTML = "<li>No document requirements specified.</li>";
      return;
    }

    requirements.forEach((req) => {
      const li = document.createElement("li");
      li.textContent = req.requirement_name;
      listElem.appendChild(li);
    });
  } catch (err) {
    console.error("Error fetching requirements:", err);
    listElem.innerHTML = "<li>Unable to fetch document requirements.</li>";
  }
}

// Helper: Submit Final Enrollment Form (called after modal confirmation)
async function handleFormSubmission() {
  const storedInformation = sessionStorage.getItem("studentInformation");
  const storedEnrollmentType = sessionStorage.getItem("enrollmentType");

  if (!storedInformation || !storedEnrollmentType) {
    alert("Student information missing. Returning to step 1.");
    window.location.href = "enrollmentWebsite.html";
    return;
  }

  const studentInformation = JSON.parse(storedInformation);
  const enrollmentType = JSON.parse(storedEnrollmentType);

  const payload = {
    ...studentInformation,
    course_id: parseInt(document.getElementById("course").value, 10),
    year_level: parseInt(document.getElementById("year").value, 10),
    semester: parseInt(document.getElementById("semester").value, 10),
    preferred_schedule: document.getElementById("schedule").value,
    enrollment_type_id: enrollmentType.enrollment_type_id,
  };

  const confirmBtn = document.getElementById("confirmSubmitBtn");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "SUBMITTING...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      // Close the confirmation modal
      const confirmModal = document.getElementById("confirmModal");
      if (confirmModal) {
        confirmModal.classList.remove("active");
        confirmModal.setAttribute("aria-hidden", "true");
      }

      // Populate and open the success modal
      const trackingEl = document.getElementById("successTrackingNumber");
      if (trackingEl) trackingEl.textContent = result.enrollment_id || "—";

      const successModal = document.getElementById("successModal");
      if (successModal) {
        successModal.classList.add("active");
        successModal.setAttribute("aria-hidden", "false");
      }

      // sessionStorage is cleared when the user clicks "GO BACK LOGIN PAGE"
    } else {
      alert(`Error: ${result.msg || "Failed to submit enrollment."}`);
    }
  } catch (err) {
    console.error("Submission error:", err);
    alert("Connection error. Could not reach server.");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "CONFIRM SUBMISSION FORM";
    }
  }
}
