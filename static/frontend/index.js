const API_URL = "";

function redirectForRole(role) {
  if (role === "edp") {
    window.location.href = "../edp/edp.html";
  } else if(role === "admin"){
    window.location.href = "admin/admin.html";
  } else if(role === "registrar"){
    window.location.href = "../registrar/registrar.html"
  } else if (role === "student"){
    window.location.href = "../studentPortal/studentportal.html"
  }
  else {
    window.location.href = "index.html"
  }
}

function redirectIfLoggedIn() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return;

  redirectForRole(role);
}

// Run on page load: if already logged in, skip straight to the
// right dashboard instead of always going to dashboard.html.

// SHOW/HIDE PASSWORD — toggle the eye icon
document
  .getElementById("togglePassword")
  .addEventListener("click", function () {
    const passwordInput = document.getElementById("password");

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      this.classList.remove("fa-eye");
      this.classList.add("fa-eye-slash");
    } else {
      passwordInput.type = "password";
      this.classList.remove("fa-eye-slash");
      this.classList.add("fa-eye");
    }
  });

//LOGIN SYSTEM
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const message = document.getElementById("message");

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      const data = await response.json();

      // Login failed
      if (!response.ok) {
        message.textContent = "Invalid username or password.";
        message.style.color = "red";

        return;
      }

      // Save JWT token and role
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      message.textContent = "Login successful!";
      message.style.color = "lightgreen";

      // Send EDP staff to edp-dashboard.html, everyone else to
      // dashboard.html.
      redirectForRole(data.role);
    } catch (error) {
      console.error(error);

      message.textContent = "Cannot connect to the server.";
      message.style.color = "red";
    }
  });

// GET USER DETAILS
async function getUserDetails() {
  const token = localStorage.getItem("token");

  if (!token) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/getUserDetails`, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      document.getElementById("message").textContent =
        "Session expired. Please login again.";

      localStorage.removeItem("token");

      return;
    }

    const user = await response.json();

    // Display user information
    document.getElementById("displayUsername").textContent = user.username;

    document.getElementById("displayEmail").textContent = user.email;

    document.getElementById("displayRole").textContent = user.role;

    document.getElementById("userDetails").style.display = "block";
  } catch (error) {
    console.error(error);

    document.getElementById("message").textContent =
      "Failed to get user details.";
  }
}
