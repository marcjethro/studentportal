/* Shared student sub-page bootstrap (academics, enrollment,
   document process, profile). Loads the navbar menu + user
   details including the program subtitle. Uses shared/app.js. */

CEC.initUserMenu();

if (CEC.requireAuth()) {
  CEC.loadUserDetails({
    nameId: "userName",
    roleId: "userRole",
    welcomeId: "welcomeName",
    subtitleId: "programSubtitle",
    defaultName: "Student",
  });
}
