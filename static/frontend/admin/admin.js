/* Admin dashboard. Uses shared/app.js (CEC) and
   shared/announcements.js. */

CEC.initUserMenu();

const content = document.getElementById("content");
const dashboardBtn = document.getElementById("dashboardBtn");
const announcementsBtn = document.getElementById("announcementsBtn");

function setActiveNav(activeItem) {
  document.querySelectorAll(".nav-item").forEach(function (item) {
    item.classList.remove("active");
  });
  if (activeItem) activeItem.classList.add("active");
}

function showDashboard() {
  setActiveNav(dashboardBtn);
  content.innerHTML = `
    <div class="welcome-section">
      <h1>Admin Dashboard</h1>
      <p>Select an option from the sidebar.</p>
    </div>
  `;
}

function showAnnouncements() {
  setActiveNav(announcementsBtn);

  content.innerHTML = `
    <div class="announcement-page">
      <div class="page-header">
        <h1>Announcements</h1>
        <p>Create a system-wide announcement.</p>
      </div>

      <div class="announcement-card">
        <form id="announcementForm">
          <div class="form-group">
            <label for="announcementTitle">Announcement Title</label>
            <input
              type="text"
              id="announcementTitle"
              placeholder="Enter announcement title"
              required
            />
          </div>

          <div class="form-group">
            <label for="announcementBody">Announcement Message</label>
            <textarea
              id="announcementBody"
              rows="6"
              placeholder="Enter announcement message"
              required
            ></textarea>
          </div>

          <button type="submit" class="post-announcement-btn">
            <i class="fa-solid fa-paper-plane"></i>
            Post Announcement
          </button>
        </form>

        <div id="announcementMessage" class="announcement-message"></div>
      </div>

      <div class="announcements-list" id="announcementsList">
        <h2>Recent Announcements</h2>
        <p>Loading announcements...</p>
      </div>
    </div>
  `;

  const form = document.getElementById("announcementForm");
  form.addEventListener("submit", function (event) {
    CEC.announcements.post(event, { heading: "Recent Announcements" });
  });

  CEC.announcements.load("announcementsList", "Recent Announcements");
}

dashboardBtn.addEventListener("click", function (event) {
  event.preventDefault();
  showDashboard();
});

announcementsBtn.addEventListener("click", function (event) {
  event.preventDefault();
  showAnnouncements();
});

if (CEC.requireAuth()) {
  CEC.loadUserDetails({ defaultName: "Admin" });
}
