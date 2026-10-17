/* =========================================================
         CONFIG
         ========================================================= */

         const API_URL = "https://studentportal-8ct3.onrender.com";

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
            VIEW SCHEDULE
            --------------------------------------------------------- */
   
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
               `${API_URL}/api/getSchedule?academicYear=${encodeURIComponent(
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
   
         /* ---------------------------------------------------------
            INIT
            --------------------------------------------------------- */
   
         requireAuth();