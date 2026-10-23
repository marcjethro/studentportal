/* =========================================================
   REGISTRAR DASHBOARD
   Uses shared/app.js (CEC) + shared/announcements.js.
   Aggregates data from existing endpoints:
     - GET /api/student/records       (student + enrollment stats)
     - GET /api/documents/stats       (document request stats)
     - GET /api/enrollments?status=all (recent applications table)
     - GET /api/announcements         (via CEC.announcements.load)
   ========================================================= */

(function () {
  "use strict";

  CEC.initUserMenu();

  if (!CEC.requireAuth()) return;

  /* ---------- helpers ---------- */
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

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

  /* ---------- student / enrollment stats ---------- */
  async function loadStudentStats() {
    try {
      var data = await getJSON("/api/student/records");
      if (!data) return;
      var s = data.stats || {};
      setText("statTotalStudents", s.total != null ? s.total : 0);
      setText("statEnrolled", s.enrolled != null ? s.enrolled : 0);
      setText("statPending", s.pending != null ? s.pending : 0);
      setText("statPrograms", s.programs_count != null ? s.programs_count : 0);
    } catch (e) {
      console.error(e);
      ["statTotalStudents", "statEnrolled", "statPending", "statPrograms"].forEach(function (id) {
        setText(id, "—");
      });
    }
  }

  /* ---------- document request stats ---------- */
  async function loadDocumentStats() {
    try {
      var data = await getJSON("/api/documents/stats");
      if (!data) return;
      setText("statDocPending", data.pending_review != null ? data.pending_review : 0);
      setText("statDocApproved", data.approved_total != null ? data.approved_total : 0);
      setText("statDocReleased", data.released_total != null ? data.released_total : 0);
      setText("statDocRejected", data.rejected_total != null ? data.rejected_total : 0);
    } catch (e) {
      console.error(e);
      ["statDocPending", "statDocApproved", "statDocReleased", "statDocRejected"].forEach(function (id) {
        setText(id, "—");
      });
    }
  }

  /* ---------- recent enrollment applications ---------- */
  function statusBadge(enr) {
    var status = (enr.status || "").toLowerCase();
    if (status === "enrolled") {
      return '<span class="status-badge enrolled"><i class="fa-solid fa-circle-check"></i> Enrolled</span>';
    }
    if (status === "pending") {
      if (enr.all_documents_submitted) {
        return '<span class="status-badge ready"><i class="fa-solid fa-clipboard-check"></i> Ready to Enroll</span>';
      }
      return '<span class="status-badge pending"><i class="fa-solid fa-clock"></i> Pending</span>';
    }
    return '<span class="status-badge none">' + escapeHtml(enr.status || "—") + "</span>";
  }

  function renderRecentEnrollments(enrollments) {
    var body = document.getElementById("recentEnrollmentsBody");
    if (!body) return;

    if (!Array.isArray(enrollments) || enrollments.length === 0) {
      body.innerHTML =
        '<tr><td colspan="5"><div class="table-empty-state">' +
        '<i class="fa-solid fa-inbox"></i>' +
        "<h3>No enrollment applications yet</h3>" +
        "<p>New and returning student applications will appear here.</p>" +
        "</div></td></tr>";
      return;
    }

    // Newest first (enrollment_id is a random string, so prefer pending first
    // then keep backend order reversed for a "recent" feel).
    var rows = enrollments.slice(0, 8);

    body.innerHTML = rows
      .map(function (enr) {
        var info = enr.student_info || {};
        var name = info.full_name || "Unknown Student";
        var program = info.course || "—";
        var year = info.year || "";
        var sem = info.semester || "";
        var yearSem = [year, sem].filter(Boolean).join(" · ");
        var docs = (enr.submitted_documents || 0) + "/" + (enr.total_documents || 0);

        return (
          "<tr>" +
          '<td><span class="cell-primary">' + escapeHtml(enr.enrollment_id || "—") + "</span>" +
          '<div class="cell-sub">' + escapeHtml(enr.enrollment_type || "Student") + "</div></td>" +
          "<td>" + escapeHtml(name) + "</td>" +
          "<td>" + escapeHtml(program) +
          (yearSem ? '<div class="cell-sub">' + escapeHtml(yearSem) + "</div>" : "") +
          "</td>" +
          '<td>' + escapeHtml(docs) + " submitted</td>" +
          "<td>" + statusBadge(enr) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  async function loadRecentEnrollments() {
    try {
      var data = await getJSON("/api/enrollments?status=all");
      if (!data) return;
      var list = Array.isArray(data) ? data : data.enrollments || [];
      // Pending applications first, then the rest — newest-ish on top.
      list = list.slice().reverse();
      list.sort(function (a, b) {
        var ap = (a.status || "").toLowerCase() === "pending" ? 0 : 1;
        var bp = (b.status || "").toLowerCase() === "pending" ? 0 : 1;
        return ap - bp;
      });
      renderRecentEnrollments(list);
    } catch (e) {
      console.error(e);
      var body = document.getElementById("recentEnrollmentsBody");
      if (body) {
        body.innerHTML =
          '<tr><td colspan="5"><div class="table-empty-state">' +
          '<i class="fa-solid fa-triangle-exclamation"></i>' +
          "<h3>Unable to load applications</h3>" +
          "<p>Please try refreshing.</p>" +
          "</div></td></tr>";
      }
    }
  }

  /* ---------- greeting ---------- */
  async function loadGreeting() {
    var user = await CEC.loadUserDetails({ defaultName: "Registrar" });
    if (user) {
      var name = (user.full_name && user.full_name.trim()) || user.username || "Registrar";
      setText("dashGreeting", "Welcome, " + name);
    }
  }

  /* ---------- orchestrate ---------- */
  function loadAll() {
    loadStudentStats();
    loadDocumentStats();
    loadRecentEnrollments();
    if (CEC.announcements && typeof CEC.announcements.load === "function") {
      CEC.announcements.load("announcementsList");
    }
  }

  loadGreeting();
  loadAll();

  var refreshBtn = document.getElementById("refreshDashBtn");
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
