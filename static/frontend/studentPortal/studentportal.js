/* Student portal dashboard. Uses shared/app.js (CEC) and
   shared/announcements.js. */

CEC.initUserMenu();

if (CEC.requireAuth()) {
  CEC.loadUserDetails({
    nameId: "userName",
    roleId: "userRole",
    welcomeId: "welcomeName",
    defaultName: "Student",
  });

  CEC.announcements.load("announcementsList");
}
