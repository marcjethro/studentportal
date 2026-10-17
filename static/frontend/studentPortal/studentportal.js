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
            window.location.href = "index.html";
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
          window.location.href = "index.html";
        }, 1500);
      }

      async function loadStudentDetails() {
        try {
          const response = await fetch(`${API_URL}/api/getUserDetails`, {
            method: "GET",
            headers: authHeaders(),
          });

          if (response.status === 401) {
            handleAuthFailure();
            return;
          }

          if (!response.ok) return;

          const student = await response.json();

          document.getElementById("welcomeName").textContent =
            `Welcome, ${student.username || "Student"}`;

          document.getElementById("userName").textContent =
            student.username || "Student";

          if (student.role) {
            document.getElementById("userRole").textContent = student.role;
          }
        } catch (error) {
          console.error(error);
        }
      }

      const avatarBtn = document.getElementById("avatarBtn");
      const avatarDropdown = document.getElementById("avatarDropdown");

      avatarBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        avatarDropdown.classList.toggle("open");
      });

      const academicsBtn = document.getElementById("academicsBtn");
      const academicsSubmenu = document.getElementById("academicsSubmenu");

      academicsBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        academicsSubmenu.classList.toggle("open");
      });

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

      document.getElementById("changePasswordBtn").addEventListener("click", () => {
        window.location.href = "../changepass/changepassword.html";
      });

      document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        window.location.href = "../index.html";
      });

      if (requireAuth()) {
        loadStudentDetails();
      }

async function loadAnnouncements() {
    const announcementsList = document.getElementById("announcementsList");

    if (!announcementsList) {
        return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
        announcementsList.innerHTML =
            `<p class="no-announcements">Please log in to view announcements.</p>`;
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/announcements`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const announcements = await response.json();

        if (!response.ok) {
            throw new Error(
                announcements.msg ||
                announcements.message ||
                "Unable to load announcements."
            );
        }

        if (!Array.isArray(announcements) || announcements.length === 0) {
            announcementsList.innerHTML =
                `<p class="no-announcements">No announcements available.</p>`;
            return;
        }

        announcementsList.innerHTML = "";

        announcements.forEach(announcement => {
            const item = document.createElement("div");
            item.className = "announcement-item";

            const title = announcement.title || "Announcement";
            const body = announcement.body || "";
            const author = announcement.author || "Admin";

            let date = "";

            if (announcement.created_at) {
                date = new Date(announcement.created_at).toLocaleString();
            }

            item.innerHTML = `
                <h3>${title}</h3>
                <p>${body}</p>
                <div class="announcement-info">
                    Posted by ${author}
                    ${date ? ` • ${date}` : ""}
                </div>
            `;

            announcementsList.appendChild(item);
        });

    } catch (error) {
        console.error("Announcement error:", error);

        announcementsList.innerHTML = `
            <p class="no-announcements">
                Unable to load announcements: ${error.message}
            </p>
        `;
    }
}

loadAnnouncements();