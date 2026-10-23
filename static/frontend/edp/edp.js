/* EDP dashboard. Uses shared/app.js (CEC).

   Pulls live data from existing endpoints:
     GET /api/documents/stats        (EDP-specific pipeline counts)
     GET /api/documents/requests     (release queue preview)
     GET /api/student/courses        (program count)
     GET /api/enrollments?status=all (enrollment counts)

   The role check is a convenience so other roles don't land
   here; real access control is enforced by the backend. */

(function () {
  "use strict";

  CEC.initUserMenu();

  if (!CEC.requireAuth()) return;

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
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

  /* ---- greeting + role guard ---- */
  async function loadGreeting() {
    var user = await CEC.loadUserDetails({ defaultName: "EDP Officer" });
    if (user) {
      var name = (user.full_name && user.full_name.trim()) || user.username || "EDP Officer";
      setText("heroGreeting", "Welcome, " + name);
      if ((user.role || "").toLowerCase() !== "edp" && (user.role || "").toLowerCase() !== "admin") {
        CEC.setMessage("Access denied. Redirecting...");
        setTimeout(function () {
          window.location.href = CEC.ROUTES.login;
        }, 1500);
      }
    }
  }

  /* ---- document pipeline stats ---- */
  async function loadDocStats() {
    try {
      var d = await getJSON("/api/documents/stats");
      if (!d) return;
      // EDP role returns: awaiting_preparation, ready_for_pickup,
      // released_total, pending_registrar, total
      setText("statPendingRegistrar", d.pending_registrar != null ? d.pending_registrar : 0);
      setText("statAwaitingPrep", d.awaiting_preparation != null ? d.awaiting_preparation : 0);
      setText("statReady", d.ready_for_pickup != null ? d.ready_for_pickup : 0);
      setText("statReleased", d.released_total != null ? d.released_total : 0);
      setText("statTotalRequests", d.total != null ? d.total : 0);
    } catch (e) {
      console.error(e);
      ["statPendingRegistrar", "statAwaitingPrep", "statReady", "statReleased", "statTotalRequests"]
        .forEach(function (id) { setText(id, "—"); });
    }
  }

  /* ---- institution stats ---- */
  async function loadCourses() {
    try {
      var courses = await getJSON("/api/student/courses");
      setText("statCourses", Array.isArray(courses) ? courses.length : 0);
    } catch (e) {
      console.error(e);
      setText("statCourses", "—");
    }
  }

  async function loadEnrollments() {
    try {
      var data = await getJSON("/api/enrollments?status=all");
      var list = Array.isArray(data) ? data : (data && data.enrollments) || [];
      var enrolled = 0, pending = 0;
      list.forEach(function (e) {
        var s = (e.status || "").toLowerCase();
        if (s === "enrolled") enrolled++;
        else if (s === "pending") pending++;
      });
      setText("statEnrolled", enrolled);
      setText("statPendingEnroll", pending);
    } catch (e) {
      console.error(e);
      setText("statEnrolled", "—");
      setText("statPendingEnroll", "—");
    }
  }

  /* ---- release queue preview ---- */
  function badgeFor(status) {
    var s = (status || "").toLowerCase();
    if (s === "released")
      return '<span class="badge released"><i class="fa-solid fa-box-open"></i> Released</span>';
    if (s === "ready for pickup")
      return '<span class="badge ready"><i class="fa-solid fa-box"></i> Ready</span>';
    if (s === "approved")
      return '<span class="badge approved"><i class="fa-solid fa-print"></i> To Prepare</span>';
    if (s === "pending")
      return '<span class="badge pending"><i class="fa-solid fa-clock"></i> Pending</span>';
    return '<span class="badge none">' + escapeHtml(status || "—") + "</span>";
  }

  async function loadQueuePreview() {
    var body = document.getElementById("queuePreviewBody");
    try {
      var data = await getJSON("/api/documents/requests");
      var list = Array.isArray(data) ? data : (data && data.requests) || [];

      // Show the items most relevant to EDP first: approved (to prepare),
      // then ready for pickup, then others — newest first within the list.
      var priority = { "approved": 0, "ready for pickup": 1, "pending": 2 };
      list = list.slice().sort(function (a, b) {
        var pa = priority[(a.status || "").toLowerCase()];
        var pb = priority[(b.status || "").toLowerCase()];
        if (pa == null) pa = 9;
        if (pb == null) pb = 9;
        return pa - pb;
      });

      var rows = list.slice(0, 7);
      if (!body) return;

      if (rows.length === 0) {
        body.innerHTML =
          '<tr><td colspan="4"><div class="table-empty">' +
          '<i class="fa-solid fa-inbox"></i><h3>No document requests</h3>' +
          "<p>Requests awaiting release will appear here.</p></div></td></tr>";
        return;
      }

      body.innerHTML = rows.map(function (r) {
        var copies = r.copies ? " &times;" + escapeHtml(r.copies) : "";
        return (
          "<tr>" +
          '<td><span class="cell-strong">' + escapeHtml(r.request_id || "—") + "</span></td>" +
          "<td>" + escapeHtml(r.student_name || "—") +
          '<div class="cell-sub">' + escapeHtml(r.course_name || "") + "</div></td>" +
          "<td>" + escapeHtml(r.document_name || "Document") + copies + "</td>" +
          "<td>" + badgeFor(r.status) + "</td>" +
          "</tr>"
        );
      }).join("");
    } catch (e) {
      console.error(e);
      if (body) {
        body.innerHTML =
          '<tr><td colspan="4"><div class="table-empty">' +
          '<i class="fa-solid fa-triangle-exclamation"></i><h3>Unable to load queue</h3>' +
          "<p>Please try refreshing.</p></div></td></tr>";
      }
    }
  }

  function loadAll() {
    loadDocStats();
    loadCourses();
    loadEnrollments();
    loadQueuePreview();
  }

  loadGreeting();
  loadAll();

  var refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      refreshBtn.disabled = true;
      var original = refreshBtn.innerHTML;
      refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Refreshing...';
      loadAll();
      setTimeout(function () {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = original;
      }, 800);
    });
  }
})();
