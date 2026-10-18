/* EDP dashboard. Uses shared/app.js (CEC).

   The role check is a convenience so other roles don't land
   here; real access control is enforced by the backend. */

CEC.initUserMenu();

async function initEdpDashboard() {
  const user = await CEC.loadUserDetails({ defaultName: "EDP Officer" });

  if (user && (user.role || "").toLowerCase() !== "edp") {
    CEC.setMessage("Access denied. Redirecting...");
    setTimeout(function () {
      window.location.href = CEC.ROUTES.login;
    }, 1500);
  }
}

if (CEC.requireAuth()) {
  initEdpDashboard();
}
