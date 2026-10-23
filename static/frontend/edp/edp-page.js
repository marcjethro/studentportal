/* Shared EDP sub-page bootstrap (master data, record
   release queue). Uses shared/app.js (CEC). */

CEC.initUserMenu();

if (CEC.requireAuth()) {
  CEC.loadUserDetails({ defaultName: "EDP Officer" });
}
