/* Student portal dashboard. Uses shared/app.js (CEC) and
   shared/announcements.js. */

(function () {
  "use strict";

  CEC.initUserMenu();

  if (!CEC.requireAuth()) return;

  CEC.loadUserDetails({
    nameId: "userName",
    roleId: "userRole",
    welcomeId: "welcomeName",
    subtitleId: "programSubtitle",
    defaultName: "Student",
  });

  // Keep announcements (shared panel)
  CEC.announcements.load("announcementsList");

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function getJSON(url) {
    var res = await fetch(url, { headers: CEC.authHeaders() });
    if (res.status === 401) {
      CEC.handleAuthFailure();
      return null;
    }
    if (!res.ok) throw new Error("Request failed: " + url + " (" + res.status + ")");
    return res.json();
  }

  function setEnrollmentBadge(state, label) {
    var badge = document.getElementById("enrollmentBadge");
    if (!badge) return;
    badge.className = "welcome-hero-badge " + state;
    var icon =
      state === "enrolled"
        ? "fa-circle-check"
        : state === "pending"
        ? "fa-clock"
        : "fa-circle-info";
    badge.innerHTML =
      '<i class="fa-solid ' + icon + '"></i><span>' + label + "</span>";
  }

  /* ---- Enrollment status (from /api/student/profile) ---- */
  async function loadEnrollmentStatus() {
    try {
      var data = await getJSON("/api/student/profile");
      if (!data) return;

      var enrollments = Array.isArray(data.enrollments) ? data.enrollments : [];
      if (enrollments.length === 0) {
        setText("statEnrollStatus", "Not Enrolled");
        setEnrollmentBadge("none", "Not yet enrolled");
        return;
      }

      // Latest enrollment = last in list; prefer a pending one if present.
      var pending = null;
      for (var i = 0; i < enrollments.length; i++) {
        if ((enrollments[i].status || "").toLowerCase() === "pending") {
          pending = enrollments[i];
        }
      }
      var latest = pending || enrollments[enrollments.length - 1];
      var status = (latest.status || "").toLowerCase();

      if (status === "enrolled") {
        setText("statEnrollStatus", "Enrolled");
        setEnrollmentBadge("enrolled", "Officially Enrolled");
      } else if (status === "pending") {
        setText("statEnrollStatus", "Pending");
        setEnrollmentBadge("pending", "Enrollment Pending");
      } else {
        setText("statEnrollStatus", latest.status || "—");
        setEnrollmentBadge("none", latest.status || "Status unknown");
      }
    } catch (e) {
      console.error(e);
      setText("statEnrollStatus", "—");
      setEnrollmentBadge("none", "Status unavailable");
    }
  }

  /* ---- Document request stats (from /api/documents/stats) ---- */
  async function loadDocumentStats() {
    try {
      var data = await getJSON("/api/documents/stats");
      if (!data) return;

      var total = data.total || 0;
      var pending = (data.pending || 0) + (data.approved || 0);
      var ready = (data.ready_for_pickup || 0) + (data.released || 0);

      setText("statDocTotal", total);
      setText("statDocPending", pending);
      setText("statDocReady", ready);
    } catch (e) {
      console.error(e);
      setText("statDocTotal", "—");
      setText("statDocPending", "—");
      setText("statDocReady", "—");
    }
  }

  loadEnrollmentStatus();
  loadDocumentStats();
})();
