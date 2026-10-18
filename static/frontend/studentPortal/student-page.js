/* Shared student sub-page bootstrap (academics, enrollment,
   document process). Loads the navbar menu + user details.
   Uses shared/app.js (CEC). */

CEC.initUserMenu();

if (CEC.requireAuth()) {
  CEC.loadUserDetails({
    nameId: "userName",
    roleId: "userRole",
    welcomeId: "welcomeName",
    defaultName: "Student",
  });
}
