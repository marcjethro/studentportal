/* =========================================================
   SHARED FRONTEND HELPERS (global `CEC` namespace)

   Consolidates the auth + navbar logic that used to be
   copy-pasted into every role's script. Backend is served
   from the same origin, so API_URL is "" and all calls use
   absolute paths like /api/...

   Canonical routes:
     - login page:        /
     - change password:   /changepass/changepassword.html
   ========================================================= */

(function (window) {
  "use strict";

  var API_URL = "";

  var ROUTES = {
    login: "/",
    changePassword: "/changepass/changepassword.html",
  };

  function getMessageEl() {
    return document.getElementById("message");
  }

  function setMessage(text) {
    var el = getMessageEl();
    if (el) el.textContent = text;
  }

  function getToken() {
    return localStorage.getItem("token");
  }

  function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getToken(),
    };
  }

  function redirect(url, delay) {
    if (delay) {
      setTimeout(function () {
        window.location.href = url;
      }, delay);
    } else {
      window.location.href = url;
    }
  }

  /* Returns true if a token exists; otherwise redirects to login. */
  function requireAuth() {
    if (!getToken()) {
      setMessage("You must be logged in. Redirecting...");
      redirect(ROUTES.login, 1500);
      return false;
    }
    return true;
  }

  function handleAuthFailure() {
    setMessage("Session expired. Please login again.");
    clearSession();
    redirect(ROUTES.login, 1500);
  }

  function logout() {
    clearSession();
    redirect(ROUTES.login);
  }

  /* ---------------------------------------------------------
     USER DETAILS
     Fetches GET /api/getUserDetails and writes the name/role
     into the elements identified by opts.
       opts.nameId     - element id for the username (default "officerName")
       opts.roleId     - element id for the role (default "officerRole")
       opts.welcomeId  - optional element id, gets "Welcome, <name>"
       opts.defaultName- fallback label when username is missing
     Returns the user object (or null on failure).
     --------------------------------------------------------- */
  async function loadUserDetails(opts) {
    opts = opts || {};
    var nameId = opts.nameId || "officerName";
    var roleId = opts.roleId || "officerRole";
    var defaultName = opts.defaultName || "User";

    try {
      var response = await fetch(API_URL + "/api/getUserDetails", {
        method: "GET",
        headers: authHeaders(),
      });

      if (response.status === 401) {
        handleAuthFailure();
        return null;
      }

      if (!response.ok) return null;

      var user = await response.json();

      var nameEl = document.getElementById(nameId);
      if (nameEl) nameEl.textContent = user.username || defaultName;

      if (opts.welcomeId) {
        var welcomeEl = document.getElementById(opts.welcomeId);
        if (welcomeEl)
          welcomeEl.textContent = "Welcome, " + (user.username || defaultName);
      }

      if (user.role) {
        var roleEl = document.getElementById(roleId);
        if (roleEl) roleEl.textContent = user.role;
      }

      return user;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /* ---------------------------------------------------------
     USER MENU (avatar dropdown + logout + change password
     + optional academics submenu). Wires up whatever elements
     are present on the page, so it is safe to call everywhere.
     --------------------------------------------------------- */
  function initUserMenu() {
    var avatarBtn = document.getElementById("avatarBtn");
    var avatarDropdown = document.getElementById("avatarDropdown");

    if (avatarBtn && avatarDropdown) {
      avatarBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        avatarDropdown.classList.toggle("open");
      });
    }

    var academicsBtn = document.getElementById("academicsBtn");
    var academicsSubmenu = document.getElementById("academicsSubmenu");

    if (academicsBtn && academicsSubmenu) {
      academicsBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        academicsSubmenu.classList.toggle("open");
      });
    }

    document.addEventListener("click", function (event) {
      if (
        avatarDropdown &&
        !avatarDropdown.contains(event.target) &&
        event.target !== avatarBtn
      ) {
        avatarDropdown.classList.remove("open");
      }

      if (
        academicsSubmenu &&
        academicsBtn &&
        !academicsSubmenu.contains(event.target) &&
        event.target !== academicsBtn &&
        !academicsBtn.contains(event.target)
      ) {
        academicsSubmenu.classList.remove("open");
      }
    });

    var changePasswordBtn = document.getElementById("changePasswordBtn");
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener("click", function () {
        redirect(ROUTES.changePassword);
      });
    }

    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }
  }

  window.CEC = {
    API_URL: API_URL,
    ROUTES: ROUTES,
    getToken: getToken,
    clearSession: clearSession,
    authHeaders: authHeaders,
    setMessage: setMessage,
    requireAuth: requireAuth,
    handleAuthFailure: handleAuthFailure,
    logout: logout,
    loadUserDetails: loadUserDetails,
    initUserMenu: initUserMenu,
  };
})(window);
