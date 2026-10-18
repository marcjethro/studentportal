/* Registrar dashboard — uses shared/app.js (CEC). */

CEC.initUserMenu();

/* Sidebar active-state (visual only — sub-pages navigate via href) */
document.querySelectorAll(".nav-item").forEach(function (item) {
  item.addEventListener("click", function () {
    document
      .querySelectorAll(".nav-item")
      .forEach(function (el) {
        el.classList.remove("active");
      });
    item.classList.add("active");
  });
});

if (CEC.requireAuth()) {
  CEC.loadUserDetails({ defaultName: "Registrar" });
}
