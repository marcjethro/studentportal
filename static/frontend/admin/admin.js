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

function showDashboard() {
  setActiveNav(dashboardBtn);
  content.innerHTML = `
    <div class="welcome-section">
      <h1>Admin Dashboard</h1>
      <p>Select an option from the sidebar.</p>
    </div>
  `;
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
