
const message = document.getElementById("message");

function getToken() {
  return localStorage.getItem("token");
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
   INIT
   --------------------------------------------------------- */

requireAuth();