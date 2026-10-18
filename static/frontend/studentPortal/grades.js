/* Student grades page. Uses shared/app.js (CEC). */

CEC.initUserMenu();

const academicYearSelect = document.getElementById("academicYearSelect");
const semesterSelect = document.getElementById("semesterSelect");
const viewGradesBtn = document.getElementById("viewGradesBtn");
const resultsPlaceholder = document.getElementById("resultsPlaceholder");
const gradesTable = document.getElementById("gradesTable");
const gradesTableBody = document.getElementById("gradesTableBody");

async function loadGrades() {
  const academicYear = academicYearSelect.value;
  const semester = semesterSelect.value;

  if (!academicYear || !semester) {
    resultsPlaceholder.style.display = "block";
    resultsPlaceholder.textContent =
      "Please select both an academic year and a semester.";
    gradesTable.style.display = "none";
    return;
  }

  resultsPlaceholder.style.display = "block";
  resultsPlaceholder.textContent = "Loading grades...";
  gradesTable.style.display = "none";

  try {
    // TODO: replace with the real grades endpoint once available
    const response = await fetch(
      `${CEC.API_URL}/api/getGrades?academicYear=${encodeURIComponent(
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
        "Grades are not available for the selected term yet.";
      return;
    }

    const grades = await response.json();

    if (!Array.isArray(grades) || grades.length === 0) {
      resultsPlaceholder.textContent =
        "No grades found for the selected term.";
      return;
    }

    gradesTableBody.innerHTML = grades
      .map(
        (g) => `
          <tr>
            <td>${g.subjectCode ?? ""}</td>
            <td>${g.descriptiveTitle ?? ""}</td>
            <td>${g.units ?? ""}</td>
            <td>${g.grade ?? ""}</td>
            <td>${g.remarks ?? ""}</td>
          </tr>
        `
      )
      .join("");

    resultsPlaceholder.style.display = "none";
    gradesTable.style.display = "table";
  } catch (error) {
    console.error(error);
    resultsPlaceholder.textContent =
      "Something went wrong loading grades. Please try again.";
  }
}

viewGradesBtn.addEventListener("click", loadGrades);

CEC.requireAuth();
