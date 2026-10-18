/* =========================================================
   SHARED ANNOUNCEMENTS (global `CEC.announcements`)

   - load(listId): read-only list render, used by the student
     portal and the admin "Recent Announcements" panel.
   - post(event): admin create handler (POST /api/announcements),
     wired to the announcement form submit.

   Depends on shared/app.js (CEC.getToken / CEC.API_URL).
   ========================================================= */

(function (window) {
  "use strict";

  if (!window.CEC) {
    console.error("shared/app.js must be loaded before announcements.js");
    return;
  }

  var API_URL = CEC.API_URL;

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderItems(listEl, announcements, heading) {
    var html = heading ? "<h2>" + escapeHtml(heading) + "</h2>" : "";

    announcements.forEach(function (a) {
      var title = a.title || "Announcement";
      var body = a.body || "";
      var author = a.author || "Admin";
      var date = a.created_at ? new Date(a.created_at).toLocaleString() : "";

      html +=
        '<div class="announcement-item">' +
        "<h3>" + escapeHtml(title) + "</h3>" +
        "<p>" + escapeHtml(body) + "</p>" +
        '<div class="announcement-info">Posted by ' + escapeHtml(author) +
        (date ? " &bull; " + escapeHtml(date) : "") +
        "</div>" +
        "</div>";
    });

    listEl.innerHTML = html;
  }

  /* ---------------------------------------------------------
     LOAD (read-only)
       listId  - element id of the announcements container
       heading - optional heading rendered above the list
     --------------------------------------------------------- */
  async function load(listId, heading) {
    var listEl = document.getElementById(listId || "announcementsList");
    if (!listEl) return;

    var token = CEC.getToken();

    if (!token) {
      listEl.innerHTML =
        '<p class="no-announcements">Please log in to view announcements.</p>';
      return;
    }

    try {
      var response = await fetch(API_URL + "/api/announcements", {
        method: "GET",
        headers: { Authorization: "Bearer " + token },
      });

      var announcements = await response.json();

      if (!response.ok) {
        throw new Error(
          announcements.msg ||
            announcements.message ||
            "Unable to load announcements."
        );
      }

      if (!Array.isArray(announcements) || announcements.length === 0) {
        listEl.innerHTML =
          (heading ? "<h2>" + escapeHtml(heading) + "</h2>" : "") +
          '<p class="no-announcements">No announcements available.</p>';
        return;
      }

      renderItems(listEl, announcements, heading);
    } catch (error) {
      console.error("Announcement error:", error);
      listEl.innerHTML =
        '<p class="no-announcements">Unable to load announcements: ' +
        escapeHtml(error.message) +
        "</p>";
    }
  }

  /* ---------------------------------------------------------
     POST (admin create)
       event        - the form submit event
       opts.titleId - input id (default "announcementTitle")
       opts.bodyId  - textarea id (default "announcementBody")
       opts.messageId - status container id (default "announcementMessage")
       opts.listId  - list to reload after posting (default "announcementsList")
       opts.heading - heading used when reloading the list
     --------------------------------------------------------- */
  async function post(event, opts) {
    event.preventDefault();
    opts = opts || {};

    var titleEl = document.getElementById(opts.titleId || "announcementTitle");
    var bodyEl = document.getElementById(opts.bodyId || "announcementBody");
    var messageBox = document.getElementById(
      opts.messageId || "announcementMessage"
    );

    var title = (titleEl && titleEl.value.trim()) || "";
    var body = (bodyEl && bodyEl.value.trim()) || "";

    if (!title || !body) {
      messageBox.innerHTML =
        '<p class="error-message">Please fill in all fields.</p>';
      return;
    }

    var token = CEC.getToken();

    if (!token) {
      messageBox.innerHTML =
        '<p class="error-message">You are not logged in. Please log in again.</p>';
      return;
    }

    var button = document.querySelector(".post-announcement-btn");
    if (button) {
      button.disabled = true;
      button.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
    }

    try {
      var response = await fetch(API_URL + "/api/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ title: title, body: body }),
      });

      var data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.msg || data.message || "Failed to post announcement."
        );
      }

      messageBox.innerHTML =
        '<p class="success-message"><i class="fa-solid fa-circle-check"></i> ' +
        escapeHtml(data.msg || "Announcement posted successfully.") +
        "</p>";

      var form = event.target;
      if (form && typeof form.reset === "function") form.reset();

      load(opts.listId || "announcementsList", opts.heading);
    } catch (error) {
      console.error("Announcement error:", error);
      messageBox.innerHTML =
        '<p class="error-message"><i class="fa-solid fa-circle-exclamation"></i> ' +
        escapeHtml(error.message) +
        "</p>";
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML =
          '<i class="fa-solid fa-paper-plane"></i> Post Announcement';
      }
    }
  }

  CEC.announcements = { load: load, post: post };
})(window);
