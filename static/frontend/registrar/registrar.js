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
			window.location.href = "/";
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
		window.location.href = "/";
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
			officer.username || "Registrar";

		if (officer.role) {
			document.getElementById("officerRole").textContent = officer.role;
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

document.addEventListener("click", (event) => {
	if (!avatarDropdown.contains(event.target) && event.target !== avatarBtn) {
		avatarDropdown.classList.remove("open");
	}
	document.getElementById("changePasswordBtn").addEventListener("click", () => {
		window.location.href = "../changepass/changepassword.html";
	});


});

/* ---------------------------------------------------------
	 LOGOUT
	 --------------------------------------------------------- */

document.getElementById("logoutBtn").addEventListener("click", () => {
	localStorage.removeItem("token");
	localStorage.removeItem("role");
	window.location.href = "/";
});

/* ---------------------------------------------------------
	 SIDEBAR NAV (visual active state only — pages not built yet)
	 --------------------------------------------------------- */

document.querySelectorAll(".nav-item").forEach((item) => {
	item.addEventListener("click", () => {
		document
			.querySelectorAll(".nav-item")
			.forEach((el) => el.classList.remove("active"));
		item.classList.add("active");
	});
});

/* ---------------------------------------------------------
	 INIT
	 --------------------------------------------------------- */

if (requireAuth()) {
	loadOfficerDetails();
}


