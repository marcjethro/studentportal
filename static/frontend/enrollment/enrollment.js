const API_BASE_URL = "https://studentportal-8ct3.onrender.com";

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
// TRACK APPLICATION
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
    // Send GET request to /api/enrollments/<string:enrollment_id>
    const response = await fetch(
      `${API_BASE_URL}/api/enrollments/${encodeURIComponent(trackingNumber)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    // Safely check content type before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const htmlText = await response.text();
      console.error("Server returned non-JSON response:", htmlText);
      throw new Error(
        `Tracking record not found or server error (HTTP ${response.status})`
      );
    }

    const data = await response.json();

    if (response.ok) {
      // Unpack response matching GET /api/enrollments/<string:enrollment_id> payload structure
      const student = data.student_info || {};
      const fullName = `${student.first_name || ""} ${
        student.middle_name || ""
      } ${student.last_name || ""} ${student.suffix || ""}`.trim();

      alert(
        `📋 ENROLLMENT STATUS\n` +
          `------------------------------------\n` +
          `Tracking ID: ${data.enrollment_id}\n` +
          `Status: ${data.status}\n` +
          `Student: ${fullName}\n` +
          `Course: ${student.course || "N/A"}\n` +
          `Year/Sem: ${student.year || "N/A"} - ${
            student.semester || "N/A"
          }\n` +
          `Enrollment Type: ${data.enrollment_type}\n` +
          `Schedule: ${student.preferred_schedule || "N/A"}`
      );
    } else {
      alert(`Error: ${data.msg || "Enrollment record not found."}`);
    }
  } catch (error) {
    console.error("Error tracking application:", error);
    alert(`Tracking Error: ${error.message}`);
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

  // 4. Handle final enrollment submission (form2.html)
  const finalEnrollmentForm = document.getElementById("finalEnrollmentForm");
  if (finalEnrollmentForm) {
    finalEnrollmentForm.addEventListener("submit", handleFormSubmission);
  }
});

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

// Helper: Submit Final Enrollment Form
async function handleFormSubmission(e) {
  e.preventDefault();

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

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "SUBMITTING...";

  try {
    const response = await fetch(`${API_BASE_URL}/api/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      alert(`Success! Tracking Code: ${result.enrollment_id}\n\n${result.msg}`);
      sessionStorage.clear();
      window.location.href = "enrollmentWebsite.html";
    } else {
      alert(`Error: ${result.msg || "Failed to submit enrollment."}`);
    }
  } catch (err) {
    console.error("Submission error:", err);
    alert("Connection error. Could not reach server.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "SUBMIT ENROLLMENT FORM";
  }
}
