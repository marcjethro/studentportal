const API_URL = "https://studentportal-8ct3.onrender.com";

const message = document.getElementById("message");
const tableBody = document.getElementById("usersTableBody");
const emptyState = document.getElementById("emptyState");

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

let allUsers = [];
let allRoles = [];

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
  setTimeout(() => {
    window.location.href = "../index.html";
  }, 1500);
}

/* ---------------------------------------------------------
         OFFICER INFO
         --------------------------------------------------------- */

async function loadOfficerDetails() {
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

    const officer = await response.json();

    document.getElementById("officerName").textContent =
      officer.username || "EDP Officer";

    if (officer.role) {
      document.getElementById("officerRole").textContent = officer.role;
    }
  } catch (error) {
    console.error(error);
  }
}

/* ---------------------------------------------------------
         LOAD ROLES (for the Add User dropdown)
         --------------------------------------------------------- */

async function loadRoles() {
  try {
    const response = await fetch(`${API_URL}/api/auth/roles`, {
      method: "GET",
      headers: authHeaders(),
    });

    if (response.status === 401) {
      handleAuthFailure();
      return;
    }

    if (!response.ok) return;

    allRoles = await response.json();

    formRole.innerHTML = allRoles
      .map(
        (r) =>
          `<option value="${r.role_id}">${escapeHtml(
            capitalize(r.name)
          )}</option>`
      )
      .join("");
  } catch (error) {
    console.error(error);
  }
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ---------------------------------------------------------
         LOAD USERS
         --------------------------------------------------------- */

async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/api/auth/users`, {
      method: "GET",
      headers: authHeaders(),
    });

    if (response.status === 401) {
      handleAuthFailure();
      return;
    }

    if (!response.ok) {
      message.textContent = "Failed to load user accounts.";
      return;
    }

    allUsers = await response.json();

    message.textContent = "";

    renderUsers();
  } catch (error) {
    console.error(error);
    message.textContent = "Could not reach the server. Please try again.";
  }
}

/* ---------------------------------------------------------
         RENDER
         --------------------------------------------------------- */

function renderUsers() {
  tableBody.innerHTML = "";

  if (allUsers.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }

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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------
         ROW ACTIONS (update / delete)
         --------------------------------------------------------- */

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

async function deleteUser(id) {
  try {
    const response = await fetch(`${API_URL}/api/auth/users/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (response.status === 401) {
      handleAuthFailure();
      return;
    }

    if (!response.ok) {
      message.textContent = "Could not delete user.";
      return;
    }

    message.textContent = "";
    await loadUsers();
  } catch (error) {
    console.error(error);
    message.textContent = "Could not reach the server.";
  }
}

/* ---------------------------------------------------------
         MODAL (add / edit)

         The API only lets PATCH change username/email/password —
         role can't be updated after creation. So the role field
         is an editable dropdown when adding, and a read-only line
         when editing.
         --------------------------------------------------------- */

function openModal(mode, user) {
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

    formRole.style.display = "block";
    roleDisplay.style.display = "none";

    formPassword.required = true;
    passwordHint.textContent = "Required for new accounts.";
  }

  userModal.style.display = "flex";
}

function closeModal() {
  userModal.style.display = "none";
}

document.getElementById("addUserBtn").addEventListener("click", () => {
  openModal("add");
});

document.getElementById("cancelBtn").addEventListener("click", closeModal);

userModal.addEventListener("click", (event) => {
  if (event.target === userModal) closeModal();
});

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const isEdit = Boolean(formId.value);

  let payload;

  if (isEdit) {
    // PATCH only accepts username, email, password — no role.
    payload = {
      username: formUsername.value.trim(),
      email: formEmail.value.trim(),
    };

    if (formPassword.value.trim()) {
      payload.password = formPassword.value.trim();
    }
  } else {
    if (!formPassword.value.trim()) {
      message.textContent = "Password is required for new accounts.";
      return;
    }

    payload = {
      username: formUsername.value.trim(),
      email: formEmail.value.trim(),
      password: formPassword.value.trim(),
      role_id: parseInt(formRole.value),
    };
  }

  try {
    const response = await fetch(
      isEdit
        ? `${API_URL}/api/auth/users/${formId.value}`
        : `${API_URL}/api/auth/users`,
      {
        method: isEdit ? "PATCH" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      }
    );

    if (response.status === 401) {
      handleAuthFailure();
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);

      console.error("Add user error:", errorData);

      message.textContent =
        errorData?.message ||
        errorData?.error ||
        `Could not save user account. Status: ${response.status}`;

      return;
    }

    message.textContent = "";
    closeModal();
    await loadUsers();
  } catch (error) {
    console.error(error);
    message.textContent = "Could not reach the server.";
  }
});

/* ---------------------------------------------------------
         BACK
         --------------------------------------------------------- */

document.getElementById("backBtn").addEventListener("click", () => {
  window.history.back();
});

/* ---------------------------------------------------------
         INIT
         --------------------------------------------------------- */

if (requireAuth()) {
  loadOfficerDetails();
  loadRoles();
  loadUsers();
}
