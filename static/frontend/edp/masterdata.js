/* =========================================================
   EDP MASTER DATA — Course management (CRUD)

   Depends on shared/app.js (CEC) and edp-page.js (which already
   handles auth bootstrap + user menu). This file owns the
   Courses table: list (read), create, update, delete.

   Endpoints:
     GET    /api/student/courses
     POST   /api/student/courses
     PUT    /api/student/courses/<id>
     DELETE /api/student/courses/<id>
   ========================================================= */

(function () {
  "use strict";

  if (!window.CEC) {
    console.error("shared/app.js must be loaded before masterdata.js");
    return;
  }

  var COURSES_URL = "/api/student/courses";

  // DOM refs
  var tableBody = document.getElementById("tableBody");
  var tableStatus = document.getElementById("tableStatus");

  var addBtn = document.getElementById("addCourseBtn");

  var courseModal = document.getElementById("courseModal");
  var courseForm = document.getElementById("courseForm");
  var courseNameInput = document.getElementById("courseNameInput");
  var courseModalTitle = document.getElementById("courseModalTitle");
  var courseModalSub = document.getElementById("courseModalSub");
  var courseFormError = document.getElementById("courseFormError");
  var cancelCourseBtn = document.getElementById("cancelCourseBtn");
  var saveCourseBtn = document.getElementById("saveCourseBtn");

  var deleteModal = document.getElementById("deleteModal");
  var deleteModalText = document.getElementById("deleteModalText");
  var deleteFormError = document.getElementById("deleteFormError");
  var cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  var confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

  // State: course currently being edited/deleted (null => creating)
  var editingCourse = null;
  var deletingCourse = null;

  /* ---------------- helpers ---------------- */
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function setStatus(text, isError) {
    if (!tableStatus) return;
    tableStatus.textContent = text || "";
    tableStatus.style.color = isError ? "#b91c1c" : "#333";
  }

  async function apiRequest(url, method, body) {
    var opts = { method: method, headers: CEC.authHeaders() };
    if (body !== undefined) opts.body = JSON.stringify(body);

    var res = await fetch(url, opts);

    if (res.status === 401) {
      CEC.handleAuthFailure();
      throw new Error("Session expired");
    }

    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      var msg = (data && data.msg) || "Request failed (" + res.status + ")";
      var err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------------- render ---------------- */
  function renderCourses(courses) {
    if (!tableBody) return;

    if (!Array.isArray(courses) || courses.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="4"><div class="table-empty">' +
        '<i class="fa-solid fa-folder-open"></i> No courses yet. Click ' +
        "&ldquo;Add Course&rdquo; to create one.</div></td></tr>";
      return;
    }

    tableBody.innerHTML = courses
      .map(function (c) {
        var count = c.student_count != null ? c.student_count : 0;
        var name = escapeHtml(c.course_name);
        return (
          "<tr>" +
          '<td class="num">' + escapeHtml(c.course_id) + "</td>" +
          "<td>" + name + "</td>" +
          '<td><span class="badge-count">' + escapeHtml(count) + "</span></td>" +
          '<td class="actions">' +
          '<button class="icon-btn edit" title="Edit" ' +
          'data-id="' + escapeHtml(c.course_id) + '" ' +
          'data-name="' + name + '">' +
          '<i class="fa-solid fa-pen-to-square"></i></button>' +
          '<button class="icon-btn delete" title="Delete" ' +
          'data-id="' + escapeHtml(c.course_id) + '" ' +
          'data-name="' + name + '" ' +
          'data-count="' + escapeHtml(count) + '">' +
          '<i class="fa-solid fa-trash"></i></button>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    // Wire row buttons
    tableBody.querySelectorAll(".icon-btn.edit").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openCourseModal({
          course_id: Number(btn.getAttribute("data-id")),
          course_name: btn.getAttribute("data-name"),
        });
      });
    });
    tableBody.querySelectorAll(".icon-btn.delete").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openDeleteModal({
          course_id: Number(btn.getAttribute("data-id")),
          course_name: btn.getAttribute("data-name"),
          student_count: Number(btn.getAttribute("data-count")) || 0,
        });
      });
    });
  }

  async function loadCourses() {
    setStatus("Loading courses...", false);
    try {
      var courses = await apiRequest(COURSES_URL, "GET");
      renderCourses(courses);
      var n = Array.isArray(courses) ? courses.length : 0;
      setStatus(n + (n === 1 ? " course" : " courses") + " total.", false);
    } catch (e) {
      console.error(e);
      setStatus("Unable to load courses: " + e.message, true);
      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="4"><div class="table-empty">' +
          '<i class="fa-solid fa-triangle-exclamation"></i> Failed to load courses.' +
          "</div></td></tr>";
      }
    }
  }

  /* ---------------- course add/edit modal ---------------- */
  function openCourseModal(course) {
    editingCourse = course || null;
    if (courseFormError) courseFormError.textContent = "";

    if (editingCourse) {
      courseModalTitle.textContent = "Edit Course";
      courseModalSub.textContent = "Update the name of this academic program.";
      courseNameInput.value = editingCourse.course_name || "";
    } else {
      courseModalTitle.textContent = "Add Course";
      courseModalSub.textContent = "Enter the name of the academic program.";
      courseNameInput.value = "";
    }

    courseModal.classList.add("open");
    courseModal.setAttribute("aria-hidden", "false");
    courseNameInput.focus();
  }

  function closeCourseModal() {
    courseModal.classList.remove("open");
    courseModal.setAttribute("aria-hidden", "true");
    editingCourse = null;
  }

  async function submitCourse(event) {
    event.preventDefault();
    if (courseFormError) courseFormError.textContent = "";

    var name = (courseNameInput.value || "").trim();
    if (!name) {
      courseFormError.textContent = "Course name is required.";
      courseNameInput.focus();
      return;
    }

    saveCourseBtn.disabled = true;
    var originalLabel = saveCourseBtn.innerHTML;
    saveCourseBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
      if (editingCourse) {
        await apiRequest(COURSES_URL + "/" + editingCourse.course_id, "PUT", {
          course_name: name,
        });
        setStatus("Course updated.", false);
      } else {
        await apiRequest(COURSES_URL, "POST", { course_name: name });
        setStatus("Course created.", false);
      }
      closeCourseModal();
      await loadCourses();
    } catch (e) {
      console.error(e);
      courseFormError.textContent = e.message;
    } finally {
      saveCourseBtn.disabled = false;
      saveCourseBtn.innerHTML = originalLabel;
    }
  }

  /* ---------------- delete modal ---------------- */
  function openDeleteModal(course) {
    deletingCourse = course;
    if (deleteFormError) deleteFormError.textContent = "";

    var warning = "";
    if (course.student_count > 0) {
      warning =
        " <strong>Note:</strong> this course has " +
        course.student_count +
        " enrolled student record(s) and cannot be deleted until they are reassigned.";
    }

    deleteModalText.innerHTML =
      "Are you sure you want to delete <strong>" +
      escapeHtml(course.course_name) +
      "</strong>? This action cannot be undone." +
      warning;

    confirmDeleteBtn.disabled = course.student_count > 0;

    deleteModal.classList.add("open");
    deleteModal.setAttribute("aria-hidden", "false");
  }

  function closeDeleteModal() {
    deleteModal.classList.remove("open");
    deleteModal.setAttribute("aria-hidden", "true");
    deletingCourse = null;
  }

  async function confirmDelete() {
    if (!deletingCourse) return;
    if (deleteFormError) deleteFormError.textContent = "";

    confirmDeleteBtn.disabled = true;
    var originalLabel = confirmDeleteBtn.innerHTML;
    confirmDeleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

    try {
      await apiRequest(COURSES_URL + "/" + deletingCourse.course_id, "DELETE");
      setStatus("Course deleted.", false);
      closeDeleteModal();
      await loadCourses();
    } catch (e) {
      console.error(e);
      deleteFormError.textContent = e.message;
    } finally {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.innerHTML = originalLabel;
    }
  }

  /* ---------------- wire up ---------------- */
  if (addBtn) addBtn.addEventListener("click", function () { openCourseModal(null); });
  if (courseForm) courseForm.addEventListener("submit", submitCourse);
  if (cancelCourseBtn) cancelCourseBtn.addEventListener("click", closeCourseModal);
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener("click", confirmDelete);

  // Backdrop click + ESC close
  [courseModal, deleteModal].forEach(function (modal) {
    if (!modal) return;
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        if (modal === courseModal) closeCourseModal();
        else closeDeleteModal();
      }
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (courseModal.classList.contains("open")) closeCourseModal();
      if (deleteModal.classList.contains("open")) closeDeleteModal();
    }
  });

  // Initial load (only if authenticated — edp-page.js redirects otherwise)
  if (CEC.getToken()) {
    loadCourses();
  }
})();
