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
   STUDENT INFO
   --------------------------------------------------------- */

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
   INIT
   --------------------------------------------------------- */

if (requireAuth()) {
  loadStudentDetails();
}