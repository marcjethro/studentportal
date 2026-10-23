/* =========================================================
   STUDENT PROFILE PAGE — profile.js
   Fetches /api/student/profile and populates the profile
   form. Handles tab switching, save, and reset.
   ========================================================= */

(function () {
  "use strict";

  // ---- DOM refs ----
  var profileForm        = document.getElementById("profileForm");
  var profileAlert       = document.getElementById("profileAlert");
  var saveBtn            = document.getElementById("saveProfileBtn");
  var cancelBtn          = document.getElementById("cancelProfileBtn");

  // Left panel
  var profileFullName    = document.getElementById("profileFullName");
  var profileBadge       = document.getElementById("profileEnrollmentStatus");
  var profileCourse      = document.getElementById("profileCourse");
  var qiYear             = document.getElementById("qiYear");
  var qiSemester         = document.getElementById("qiSemester");
  var qiSchedule         = document.getElementById("qiSchedule");
  var historyList        = document.getElementById("enrollmentHistoryList");

  // Personal tab fields
  var pFirstName  = document.getElementById("pFirstName");
  var pMiddleName = document.getElementById("pMiddleName");
  var pLastName   = document.getElementById("pLastName");
  var pSuffix     = document.getElementById("pSuffix");
  var pBirthdate  = document.getElementById("pBirthdate");
  var pPhone      = document.getElementById("pPhone");
  var pEmail      = document.getElementById("pEmail");
  var pAddress    = document.getElementById("pAddress");

  // Academic tab fields
  var pCourseSelect = document.getElementById("pCourse");
  var pYearLevel    = document.getElementById("pYearLevel");
  var pSemester     = document.getElementById("pSemester");
  var pSchedule     = document.getElementById("pSchedule");

  // Cached data
  var currentProfile   = null;
  var currentEnrollments = [];

  // ---- Tab switching ----
  document.querySelectorAll(".profile-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = this.getAttribute("data-tab");
      document.querySelectorAll(".profile-tab").forEach(function (t) {
        t.classList.remove("active");
      });
      document.querySelectorAll(".tab-panel").forEach(function (p) {
        p.classList.remove("active");
      });
      this.classList.add("active");
      document.getElementById("tab-" + target).classList.add("active");
    });
  });

  // ---- Helpers ----
  function showAlert(msg, type) {
    profileAlert.textContent = msg;
    profileAlert.className = "profile-alert " + (type || "success");
    profileAlert.style.display = "flex";
    setTimeout(function () {
      profileAlert.style.display = "none";
    }, 5000);
  }

  function setVal(el, val) {
    if (!el) return;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.value = val || "";
    } else if (el.tagName === "SELECT") {
      // Try exact match first
      for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].value === val) {
          el.value = val;
          return;
        }
      }
      // Partial match (case-insensitive)
      if (val) {
        var lc = val.toLowerCase();
        for (var j = 0; j < el.options.length; j++) {
          if (el.options[j].value.toLowerCase().includes(lc)) {
            el.value = el.options[j].value;
            return;
          }
        }
      }
    }
  }

  function populateForm(profile) {
    setVal(pFirstName,  profile.first_name);
    setVal(pMiddleName, profile.middle_name);
    setVal(pLastName,   profile.last_name);
    setVal(pSuffix,     profile.suffix);
    setVal(pBirthdate,  profile.birthdate_iso || "");
    setVal(pPhone,      profile.phone_number);
    setVal(pEmail,      profile.email);
    setVal(pAddress,    profile.home_address);

    // Academic
    if (profile.course_id) setVal(pCourseSelect, String(profile.course_id));
    setVal(pYearLevel, profile.year);
    setVal(pSemester,  profile.semester);
    setVal(pSchedule,  profile.preferred_schedule);
  }

  function updateLeftPanel(profile, enrollments) {
    // Full name
    profileFullName.textContent = profile.full_name || (profile.first_name + " " + profile.last_name);
    profileCourse.textContent   = profile.course || "—";

    // Quick info
    qiYear.textContent     = profile.year     || "—";
    qiSemester.textContent = profile.semester || "—";
    qiSchedule.textContent = profile.preferred_schedule || "—";

    // Status badge
    var latestStatus = "No Records";
    if (enrollments && enrollments.length > 0) {
      latestStatus = enrollments[enrollments.length - 1].status || "Pending";
    }
    profileBadge.textContent = latestStatus;
    profileBadge.className = "profile-badge " + latestStatus.toLowerCase().replace(/\s+/g, "-");

    // Enrollment history
    if (!enrollments || enrollments.length === 0) {
      historyList.innerHTML = '<p class="history-empty">No enrollment records found.</p>';
      return;
    }

    var html = "";
    var sorted = enrollments.slice().reverse();
    sorted.forEach(function (e) {
      var type = (e.enrollment_type || "Enrollment").replace(/Student/i, "").trim();
      var badgeCls = "enroll-status-badge " + (e.status || "");
      html += '<div class="enrollment-history-item">' +
              '  <div class="enroll-id">' + (e.enrollment_id || "—") + '</div>' +
              '  <div class="enroll-type">' + type + '</div>' +
              '  <span class="' + badgeCls + '">' + (e.status || "—") + '</span>' +
              '</div>';
    });
    historyList.innerHTML = html;
  }

  // ---- Load courses ----
  async function loadCourses() {
    try {
      var res = await fetch("/api/student/courses", {
        headers: CEC.authHeaders()
      });
      if (!res.ok) return;
      var courses = await res.json();
      pCourseSelect.innerHTML = "";
      courses.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value  = String(c.course_id);
        opt.textContent = c.course_name;
        pCourseSelect.appendChild(opt);
      });
    } catch (e) {
      console.error("Failed to load courses:", e);
    }
  }

  // ---- Load profile ----
  async function loadProfile() {
    try {
      var res = await fetch("/api/student/profile", {
        headers: CEC.authHeaders()
      });

      if (res.status === 401) {
        CEC.handleAuthFailure();
        return;
      }

      if (!res.ok) {
        showAlert("Failed to load profile data. Please refresh.", "error");
        return;
      }

      var data = await res.json();
      currentProfile    = data.profile;
      currentEnrollments = data.enrollments || [];

      if (!currentProfile) {
        // Show no-profile notice above form
        var notice = document.createElement("div");
        notice.className = "no-profile-notice";
        notice.innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>' +
          '<div><strong>Profile not yet set up.</strong> Your enrollment information will appear here once your enrollment is approved. You can still fill in your details below and save them.</div>';
        profileForm.insertAdjacentElement("beforebegin", notice);

        profileFullName.textContent = "—";
        profileBadge.textContent = "No Records";
        profileBadge.className = "profile-badge no-profile";
        historyList.innerHTML = '<p class="history-empty">No enrollment records found.</p>';
        return;
      }

      populateForm(currentProfile);
      updateLeftPanel(currentProfile, currentEnrollments);

    } catch (e) {
      console.error(e);
      showAlert("Connection error. Could not load profile.", "error");
    }
  }

  // ---- Reset ----
  cancelBtn.addEventListener("click", function () {
    if (currentProfile) {
      populateForm(currentProfile);
      showAlert("Changes discarded.", "success");
    } else {
      profileForm.reset();
    }
  });

  // ---- Save ----
  profileForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    var payload = {
      first_name:         pFirstName.value.trim(),
      middle_name:        pMiddleName.value.trim(),
      last_name:          pLastName.value.trim(),
      suffix:             pSuffix.value.trim(),
      birthdate:          pBirthdate.value.trim(),
      phone_number:       pPhone.value.trim(),
      email:              pEmail.value.trim(),
      home_address:       pAddress.value.trim(),
      course_id:          parseInt(pCourseSelect.value, 10) || null,
      year_level:         pYearLevel.value,
      semester:           pSemester.value,
      preferred_schedule: pSchedule.value,
    };

    try {
      var res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: CEC.authHeaders(),
        body: JSON.stringify(payload),
      });

      var data = await res.json();

      if (!res.ok) {
        showAlert((data.msg || "Failed to save profile."), "error");
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
        return;
      }

      currentProfile = data.profile;
      updateLeftPanel(currentProfile, currentEnrollments);

      // Also refresh the welcome header subtitle from the updated details
      var user = await (await fetch("/api/getUserDetails", { headers: CEC.authHeaders() })).json();
      var subtitleEl = document.getElementById("programSubtitle");
      if (subtitleEl && user.course_name) {
        var parts = [user.course_name];
        if (user.year_level) parts.push(user.year_level);
        if (user.semester)   parts.push(user.semester);
        subtitleEl.textContent = parts.join(" · ");
      }

      showAlert("Profile saved successfully!", "success");

    } catch (err) {
      console.error(err);
      showAlert("Connection error. Could not save profile.", "error");
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
  });

  // ---- Init ----
  (async function init() {
    await loadCourses();
    await loadProfile();
  })();

})();
