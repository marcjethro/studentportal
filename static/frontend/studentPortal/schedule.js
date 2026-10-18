/* Student schedule page. Uses shared/app.js (CEC). */

CEC.initUserMenu();

const academicYearSelect = document.getElementById("academicYearSelect");
const semesterSelect = document.getElementById("semesterSelect");
const viewScheduleBtn = document.getElementById("viewScheduleBtn");
const resultsPlaceholder = document.getElementById("resultsPlaceholder");
const scheduleTable = document.getElementById("scheduleTable");
const scheduleTableBody = document.getElementById("scheduleTableBody");

async function loadSchedule() {
  const academicYear = academicYearSelect.value;
  const semester = semesterSelect.value;

  if (!academicYear || !semester) {
    resultsPlaceholder.style.display = "block";
    resultsPlaceholder.textContent =
      "Please select both an academic year and a semester.";
    scheduleTable.style.display = "none";
    return;
  }

  resultsPlaceholder.style.display = "block";
  resultsPlaceholder.textContent = "Loading schedule...";
  scheduleTable.style.display = "none";

  try {
    // TODO: replace with the real schedule endpoint once available
    const response = await fetch(
      `${CEC.API_URL}/api/getSchedule?academicYear=${encodeURIComponent(
        academicYear
      )}&semester=${encodeURIComponent(semester)}`,
      { method: "GET", headers: CEC.authHeaders() }
    );

    if (response.status === 401) {
      CEC.handleAuthFailure();
      return;
    }

    if (!response.ok) {
      resultsPlaceholder.textContent =
        "Schedule is not available for the selected term yet.";
      return;
    }

    const schedule = await response.json();

    if (!Array.isArray(schedule) || schedule.length === 0) {
      resultsPlaceholder.textContent =
        "No schedule found for the selected term.";
      return;
    }

    scheduleTableBody.innerHTML = schedule
      .map(
        (s) => `
          <tr>
            <td>${s.subjectCode ?? ""}</td>
            <td>${s.descriptiveTitle ?? ""}</td>
            <td>${s.day ?? ""}</td>
            <td>${s.time ?? ""}</td>
            <td>${s.room ?? ""}</td>
            <td>${s.instructor ?? ""}</td>
          </tr>
        `
      )
      .join("");

    resultsPlaceholder.style.display = "none";
    scheduleTable.style.display = "table";
  } catch (error) {
    console.error(error);
    resultsPlaceholder.textContent =
      "Something went wrong loading the schedule. Please try again.";
  }
}

viewScheduleBtn.addEventListener("click", loadSchedule);

CEC.requireAuth();
