/* Admin dashboard. Uses shared/app.js (CEC) and
   shared/announcements.js. */

CEC.initUserMenu();

const content = document.getElementById("content");
const dashboardBtn = document.getElementById("dashboardBtn");
const announcementsBtn = document.getElementById("announcementsBtn");
const userAccountsBtn = document.getElementById("userAccountsBtn");

// Modal elements for User Accounts
const userModal = document.getElementById("userModal");
const modalTitle = document.getElementById("modalTitle");
const userForm = document.getElementById("userForm");
const formId = document.getElementById("formId");
const formUsername = document.getElementById("formUsername");
const formEmail = document.getElementById("formEmail");
const formRole = document.getElementById("formRole");
const roleDisplay = document.getElementById("roleDisplay");
const formPassword = document.getElementById("formPassword");
const passwordHint = document.getElementById("passwordHint");
const cancelBtn = document.getElementById("cancelBtn");

let allUsers = [];
let allRoles = [];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setActiveNav(activeItem) {
  document.querySelectorAll(".nav-item").forEach(function (item) {
    item.classList.remove("active");
  });
  if (activeItem) activeItem.classList.add("active");
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function fetchJSON(url) {
  const res = await fetch(`${CEC.API_URL}${url}`, { headers: CEC.authHeaders() });
  if (res.status === 401) {
    CEC.handleAuthFailure();
    return null;
  }
  if (!res.ok) throw new Error(`Request failed: ${url} (${res.status})`);
  return res.json();
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function loadDashboardStats() {
  // Users + roles distribution
  try {
    const users = await fetchJSON("/api/auth/users");
    if (users) {
      allUsers = users;
      setStat("adStatUsers", users.length);

      const counts = {};
      users.forEach((u) => {
        const r = (u.role || "unknown").toLowerCase();
        counts[r] = (counts[r] || 0) + 1;
      });

      setStat("adStatStudents", counts["student"] || 0);
      setStat("adStatStaff", users.length - (counts["student"] || 0));

      renderRoleDistribution(counts, users.length);
      renderRecentUsers(users);
    }
  } catch (e) {
    console.error(e);
    ["adStatUsers", "adStatStudents", "adStatStaff"].forEach((id) => setStat(id, "—"));
  }

  // Courses
  try {
    const courses = await fetchJSON("/api/student/courses");
    setStat("adStatCourses", Array.isArray(courses) ? courses.length : 0);
  } catch (e) {
    console.error(e);
    setStat("adStatCourses", "—");
  }

  // Enrollments
  try {
    const data = await fetchJSON("/api/enrollments?status=all");
    const list = Array.isArray(data) ? data : (data && data.enrollments) || [];
    let enrolled = 0, pending = 0;
    list.forEach((e) => {
      const s = (e.status || "").toLowerCase();
      if (s === "enrolled") enrolled++;
      else if (s === "pending") pending++;
    });
    setStat("adStatEnrolled", enrolled);
    setStat("adStatPending", pending);
  } catch (e) {
    console.error(e);
    setStat("adStatEnrolled", "—");
    setStat("adStatPending", "—");
  }
}

function renderRoleDistribution(counts, total) {
  const wrap = document.getElementById("roleDist");
  if (!wrap) return;

  const entries = Object.keys(counts)
    .map((k) => ({ role: k, n: counts[k] }))
    .sort((a, b) => b.n - a.n);

  if (entries.length === 0 || total === 0) {
    wrap.innerHTML = '<p class="admin-empty">No accounts yet.</p>';
    return;
  }

  wrap.innerHTML = entries
    .map((e) => {
      const pct = total ? Math.round((e.n / total) * 100) : 0;
      return `
        <div class="role-row">
          <div class="top"><span>${escapeHtml(e.role)}</span><span>${e.n}</span></div>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
        </div>`;
    })
    .join("");
}

function renderRecentUsers(users) {
  const body = document.getElementById("recentUsersBody");
  if (!body) return;

  if (!users || users.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="admin-empty">No accounts found.</td></tr>';
    return;
  }

  // Most recently created = highest user_id first
  const recent = users
    .slice()
    .sort((a, b) => (b.user_id || 0) - (a.user_id || 0))
    .slice(0, 6);

  body.innerHTML = recent
    .map(
      (u) => `
      <tr>
        <td class="cell-username">${escapeHtml(u.username || "")}</td>
        <td>${escapeHtml(u.email || "")}</td>
        <td><span class="role-chip">${escapeHtml(u.role || "")}</span></td>
      </tr>`
    )
    .join("");
}

function showDashboard() {
  setActiveNav(dashboardBtn);
  content.innerHTML = `
    <div class="admin-dash">
      <section class="admin-hero">
        <div class="admin-hero-text">
          <span class="eyebrow"><i class="fa-solid fa-shield-halved"></i> Administration</span>
          <h1 id="adminGreeting">Admin Dashboard</h1>
          <p>Overview of accounts, programs, and enrollment activity across the portal.</p>
        </div>
        <button class="admin-refresh" id="adminRefreshBtn" type="button">
          <i class="fa-solid fa-arrows-rotate"></i> Refresh
        </button>
      </section>

      <div class="admin-section-label"><i class="fa-solid fa-users"></i> Accounts</div>
      <section class="admin-stat-grid">
        <div class="admin-stat clickable" id="statCardUsers">
          <div class="ic indigo"><i class="fa-solid fa-users"></i></div>
          <div><div class="v" id="adStatUsers">—</div><div class="l">Total Accounts</div></div>
        </div>
        <div class="admin-stat">
          <div class="ic green"><i class="fa-solid fa-user-graduate"></i></div>
          <div><div class="v" id="adStatStudents">—</div><div class="l">Student Accounts</div></div>
        </div>
        <div class="admin-stat">
          <div class="ic blue"><i class="fa-solid fa-user-tie"></i></div>
          <div><div class="v" id="adStatStaff">—</div><div class="l">Staff Accounts</div></div>
        </div>
        <div class="admin-stat">
          <div class="ic purple"><i class="fa-solid fa-book"></i></div>
          <div><div class="v" id="adStatCourses">—</div><div class="l">Programs Offered</div></div>
        </div>
      </section>

      <div class="admin-section-label"><i class="fa-solid fa-file-signature"></i> Enrollment</div>
      <section class="admin-stat-grid">
        <div class="admin-stat">
          <div class="ic green"><i class="fa-solid fa-circle-check"></i></div>
          <div><div class="v" id="adStatEnrolled">—</div><div class="l">Officially Enrolled</div></div>
        </div>
        <div class="admin-stat">
          <div class="ic amber"><i class="fa-solid fa-clock"></i></div>
          <div><div class="v" id="adStatPending">—</div><div class="l">Pending Enrollment</div></div>
        </div>
      </section>

      <div class="admin-dash-grid">
        <section class="admin-panel">
          <div class="admin-panel-head">
            <h3>Recent Accounts</h3>
            <button class="link" id="goUsersBtn" type="button">Manage users &rarr;</button>
          </div>
          <table class="admin-mini-table">
            <thead>
              <tr><th>Username</th><th>Email</th><th>Role</th></tr>
            </thead>
            <tbody id="recentUsersBody">
              <tr><td colspan="3" class="admin-empty">Loading accounts...</td></tr>
            </tbody>
          </table>
        </section>

        <section class="admin-panel">
          <div class="admin-panel-head">
            <h3>Accounts by Role</h3>
          </div>
          <div class="role-dist" id="roleDist">
            <p class="admin-empty">Loading distribution...</p>
          </div>
        </section>
      </div>
    </div>
  `;

  // Greeting name (reuse cached navbar name if present)
  const navName = document.getElementById("officerName");
  const greet = document.getElementById("adminGreeting");
  if (greet && navName && navName.textContent.trim() && navName.textContent.trim() !== "Admin") {
    greet.textContent = "Welcome, " + navName.textContent.trim();
  }

  const refreshBtn = document.getElementById("adminRefreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      refreshBtn.disabled = true;
      const original = refreshBtn.innerHTML;
      refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Refreshing...';
      loadDashboardStats();
      setTimeout(function () {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = original;
      }, 800);
    });
  }

  const goUsersBtn = document.getElementById("goUsersBtn");
  if (goUsersBtn) {
    goUsersBtn.addEventListener("click", function () {
      window.location.hash = "useraccounts";
      showUserAccounts();
    });
  }
  const statCardUsers = document.getElementById("statCardUsers");
  if (statCardUsers) {
    statCardUsers.addEventListener("click", function () {
      window.location.hash = "useraccounts";
      showUserAccounts();
    });
  }

  loadDashboardStats();
}

/* =========================================================
   ANNOUNCEMENTS
   ========================================================= */

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

/* =========================================================
   USER ACCOUNTS
   ========================================================= */

async function loadRoles() {
  try {
    const response = await fetch(`${CEC.API_URL}/api/auth/roles`, {
      method: "GET",
      headers: CEC.authHeaders(),
    });

    if (response.status === 401) {
      CEC.handleAuthFailure();
      return;
    }

    if (!response.ok) return;

    allRoles = await response.json();
  } catch (error) {
    console.error("Error loading roles:", error);
  }
}

async function loadUsers() {
  const userMsg = document.getElementById("userAccountsMessage");
  try {
    const response = await fetch(`${CEC.API_URL}/api/auth/users`, {
      method: "GET",
      headers: CEC.authHeaders(),
    });

    if (response.status === 401) {
      CEC.handleAuthFailure();
      return;
    }

    if (!response.ok) {
      if (userMsg) userMsg.textContent = "Failed to load user accounts.";
      return;
    }

    allUsers = await response.json();
    if (userMsg) userMsg.textContent = "";
    renderUsers();
  } catch (error) {
    console.error("Error loading users:", error);
    if (userMsg) userMsg.textContent = "Could not reach the server. Please try again.";
  }
}

function renderUsers() {
  const tableBody = document.getElementById("usersTableBody");
  const emptyState = document.getElementById("emptyState");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!allUsers || allUsers.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  allUsers.forEach((user) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td class="cell-id">${user.user_id}</td>
      <td class="cell-username">${escapeHtml(user.username || "")}</td>
      <td>${escapeHtml(user.email || "")}</td>
      <td class="cell-role">${escapeHtml(user.role || "")}</td>
      <td class="row-actions">
        <a data-action="edit" data-id="${user.user_id}">Update</a>
        <span class="divider">/</span>
        <a data-action="delete" data-id="${user.user_id}">Delete</a>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

async function deleteUser(id) {
  const userMsg = document.getElementById("userAccountsMessage");
  try {
    const response = await fetch(`${CEC.API_URL}/api/auth/users/${id}`, {
      method: "DELETE",
      headers: CEC.authHeaders(),
    });

    if (response.status === 401) {
      CEC.handleAuthFailure();
      return;
    }

    if (!response.ok) {
      if (userMsg) userMsg.textContent = "Could not delete user.";
      return;
    }

    if (userMsg) userMsg.textContent = "";
    await loadUsers();
  } catch (error) {
    console.error("Error deleting user:", error);
    if (userMsg) userMsg.textContent = "Could not reach the server.";
  }
}

function closeModal() {
  if (userModal) userModal.style.display = "none";
}

async function openModal(mode, user) {
  if (!userModal) return;
  userForm.reset();

  if (mode === "edit" && user) {
    modalTitle.textContent = "Update User";
    formId.value = user.user_id;
    formUsername.value = user.username || "";
    formEmail.value = user.email || "";

    formRole.style.display = "none";
    roleDisplay.style.display = "block";
    roleDisplay.textContent = `Current role: ${capitalize(
      user.role || ""
    )} (role can't be changed here)`;

    formPassword.value = "";
    formPassword.required = false;
    passwordHint.textContent = "Leave blank to keep the current password.";
  } else {
    modalTitle.textContent = "Add New User";
    formId.value = "";

    if (allRoles.length === 0) {
      await loadRoles();
    }

    formRole.innerHTML = allRoles
      .map(
        (r) =>
          `<option value="${r.role_id}">${escapeHtml(
            capitalize(r.name)
          )}</option>`
      )
      .join("");

    formRole.style.display = "block";
    roleDisplay.style.display = "none";

    formPassword.required = true;
    passwordHint.textContent = "Required for new accounts.";
  }

  userModal.style.display = "flex";
}

function initUserModal() {
  if (!userModal) return;

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeModal);
  }

  userModal.addEventListener("click", (event) => {
    if (event.target === userModal) closeModal();
  });

  userForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userMsg = document.getElementById("userAccountsMessage");
    const isEdit = Boolean(formId.value);
    let payload;

    if (isEdit) {
      payload = {
        username: formUsername.value.trim(),
        email: formEmail.value.trim(),
      };

      if (formPassword.value.trim()) {
        payload.password = formPassword.value.trim();
      }
    } else {
      if (!formPassword.value.trim()) {
        if (userMsg) userMsg.textContent = "Password is required for new accounts.";
        return;
      }

      payload = {
        username: formUsername.value.trim(),
        email: formEmail.value.trim(),
        password: formPassword.value.trim(),
        role_id: parseInt(formRole.value, 10),
      };
    }

    try {
      const response = await fetch(
        isEdit
          ? `${CEC.API_URL}/api/auth/users/${formId.value}`
          : `${CEC.API_URL}/api/auth/users`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: CEC.authHeaders(),
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 401) {
        CEC.handleAuthFailure();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Save user error:", errorData);
        const errMsg =
          errorData?.message ||
          errorData?.error ||
          `Could not save user account. Status: ${response.status}`;
        if (userMsg) userMsg.textContent = errMsg;
        return;
      }

      if (userMsg) userMsg.textContent = "";
      closeModal();
      await loadUsers();
    } catch (error) {
      console.error("Save user network error:", error);
      if (userMsg) userMsg.textContent = "Could not reach the server.";
    }
  });
}

function showUserAccounts() {
  setActiveNav(userAccountsBtn);

  content.innerHTML = `
    <div class="useraccounts-page">
      <div class="page-header">
        <h1>User Accounts</h1>
        <p>Manage administrative and user accounts.</p>
      </div>

      <div class="useraccounts-panel">
        <div class="panel-header">
          <h2>User Accounts:</h2>
          <button class="add-link" id="addUserBtn">+ Add New User</button>
        </div>

        <p id="userAccountsMessage" class="user-message"></p>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="usersTableBody"></tbody>
          </table>

          <p class="empty-state" id="emptyState" style="display: none">
            No user accounts found.
          </p>
        </div>
      </div>
    </div>
  `;

  const addUserBtn = document.getElementById("addUserBtn");
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      openModal("add");
    });
  }

  const tableBody = document.getElementById("usersTableBody");
  if (tableBody) {
    tableBody.addEventListener("click", async (event) => {
      const link = event.target.closest("a[data-action]");
      if (!link) return;

      const action = link.dataset.action;
      const id = link.dataset.id;
      const user = allUsers.find((u) => String(u.user_id) === String(id));

      if (!user) return;

      if (action === "edit") {
        openModal("edit", user);
      } else if (action === "delete") {
        if (confirm(`Delete account "${user.username}"?`)) {
          await deleteUser(id);
        }
      }
    });
  }

  loadRoles();
  loadUsers();
}

/* =========================================================
   NAVIGATION / ROUTING
   ========================================================= */

dashboardBtn.addEventListener("click", function (event) {
  event.preventDefault();
  window.location.hash = "dashboard";
  showDashboard();
});

announcementsBtn.addEventListener("click", function (event) {
  event.preventDefault();
  window.location.hash = "announcements";
  showAnnouncements();
});

if (userAccountsBtn) {
  userAccountsBtn.addEventListener("click", function (event) {
    event.preventDefault();
    window.location.hash = "useraccounts";
    showUserAccounts();
  });
}

function handleInitialRoute() {
  const hash = window.location.hash;
  if (hash === "#useraccounts" || hash === "#users") {
    showUserAccounts();
  } else if (hash === "#announcements") {
    showAnnouncements();
  } else {
    showDashboard();
  }
}

window.addEventListener("hashchange", function () {
  handleInitialRoute();
});

/* =========================================================
   INIT
   ========================================================= */

if (CEC.requireAuth()) {
  CEC.loadUserDetails({ defaultName: "Admin" });
  initUserModal();
  handleInitialRoute();
}
