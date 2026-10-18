/* Shared registrar sub-page bootstrap (processing, student
   records, validation queue). Uses shared/app.js (CEC). */

CEC.initUserMenu();

if (CEC.requireAuth()) {
  CEC.loadUserDetails({ defaultName: "Registrar" });
}
