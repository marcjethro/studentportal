
         const API_URL = "";

         const message = document.getElementById("message");
   
         function getToken() {
           return localStorage.getItem("token");
         }
   
         function authHeaders() {
           return {
             "Content-Type": "application/json",
             Authorization: `Bearer ${getToken()}`,
           };
         }
   
         function requireAuth() {
           const token = getToken();
   
           if (!token) {
             message.textContent = "You must be logged in. Redirecting...";
             setTimeout(() => {
               window.location.href = "../index.html";
             }, 1500);
             return false;
           }
   
           return true;
         }
   
         function handleAuthFailure() {
           message.textContent = "Session expired. Please login again.";
           localStorage.removeItem("token");
           localStorage.removeItem("role");
           setTimeout(() => {
             window.location.href = "../index.html";
           }, 1500);
         }
   
         /* ---------------------------------------------------------
            AVATAR DROPDOWN
            --------------------------------------------------------- */
   
         const avatarBtn = document.getElementById("avatarBtn");
         const avatarDropdown = document.getElementById("avatarDropdown");
   
         avatarBtn.addEventListener("click", (event) => {
           event.stopPropagation();
           avatarDropdown.classList.toggle("open");
         });
   
         /* ---------------------------------------------------------
            ACADEMICS SUBMENU (Grades / Prospectus / Schedule)
            --------------------------------------------------------- */
   
         const academicsBtn = document.getElementById("academicsBtn");
         const academicsSubmenu = document.getElementById("academicsSubmenu");
   
         academicsBtn.addEventListener("click", (event) => {
           event.stopPropagation();
           academicsSubmenu.classList.toggle("open");
         });
   
         /* ---------------------------------------------------------
            CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
            --------------------------------------------------------- */
   
         document.addEventListener("click", (event) => {
           if (!avatarDropdown.contains(event.target) && event.target !== avatarBtn) {
             avatarDropdown.classList.remove("open");
           }
   
           if (
             !academicsSubmenu.contains(event.target) &&
             event.target !== academicsBtn &&
             !academicsBtn.contains(event.target)
           ) {
             academicsSubmenu.classList.remove("open");
           }
         });
   
         /* ---------------------------------------------------------
            LOGOUT
            --------------------------------------------------------- */
   
         document.getElementById("logoutBtn").addEventListener("click", () => {
           localStorage.removeItem("token");
           localStorage.removeItem("role");
           window.location.href = "../index.html";
         });
   
         /* ---------------------------------------------------------
            VIEW GRADES
            --------------------------------------------------------- */
   
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
               `${API_URL}/api/getGrades?academicYear=${encodeURIComponent(
                 academicYear
               )}&semester=${encodeURIComponent(semester)}`,
               { method: "GET", headers: authHeaders() }
             );
   
             if (response.status === 401) {
               handleAuthFailure();
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
   
       
         requireAuth();