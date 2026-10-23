(function () {
  "use strict";

  var allRequests = [];
  var activeFilter = "Approved"; // Focus on approved requests needing EDP preparation
  var selectedRequest = null;

  CEC.initUserMenu();

  if (!CEC.requireAuth()) {
    return;
  }

  CEC.loadUserDetails({
    nameId: "officerName",
    roleId: "officerRole",
    defaultName: "EDP Officer",
  });

  // DOM Elements
  var statPrep = document.getElementById("statPrep");
  var statReady = document.getElementById("statReady");
  var statReleased = document.getElementById("statReleased");
  var statTotal = document.getElementById("statTotal");

  var queueTableBody = document.getElementById("queueTableBody");
  var emptyState = document.getElementById("emptyState");
  var searchInput = document.getElementById("searchQueue");
  var refreshBtn = document.getElementById("refreshBtn");

  // Ready Modal
  var readyModal = document.getElementById("readyModal");
  var closeReadyModalBtn = document.getElementById("closeReadyModalBtn");
  var cancelReadyBtn = document.getElementById("cancelReadyBtn");
  var confirmReadyBtn = document.getElementById("confirmReadyBtn");
  var pickupLocationInput = document.getElementById("pickupLocation");
  var prepRemarksInput = document.getElementById("prepRemarks");

  // Release Modal
  var releaseModal = document.getElementById("releaseModal");
  var closeReleaseModalBtn = document.getElementById("closeReleaseModalBtn");
  var cancelReleaseBtn = document.getElementById("cancelReleaseBtn");
  var confirmReleaseBtn = document.getElementById("confirmReleaseBtn");
  var releasedToInput = document.getElementById("releasedTo");
  var idPresentedInput = document.getElementById("idPresented");
  var releaseNotesInput = document.getElementById("releaseNotes");

  // Detail Modal
  var detailModal = document.getElementById("detailModal");
  var closeDetailModalBtn = document.getElementById("closeDetailModalBtn");
  var closeDetailFooterBtn = document.getElementById("closeDetailFooterBtn");

  // Load stats
  async function loadStats() {
    try {
      var res = await fetch("/api/documents/stats", {
        headers: CEC.authHeaders(),
      });
      if (!res.ok) return;
      var stats = await res.json();
      if (statPrep) statPrep.textContent = stats.awaiting_preparation || 0;
      if (statReady) statReady.textContent = stats.ready_for_pickup || 0;
      if (statReleased) statReleased.textContent = stats.released_total || 0;
      if (statTotal) statTotal.textContent = stats.total || 0;
    } catch (e) {
      console.error(e);
    }
  }

  // Load requests
  async function loadRequests() {
    try {
      var res = await fetch("/api/documents/requests", {
        headers: CEC.authHeaders(),
      });
      if (res.status === 401) {
        CEC.handleAuthFailure();
        return;
      }
      if (!res.ok) return;
      allRequests = await res.json();
      renderQueue();
      loadStats();
    } catch (e) {
      console.error("Error loading requests", e);
    }
  }

  // Render Queue Table
  function renderQueue() {
    var query = (searchInput.value || "").toLowerCase().trim();

    var filtered = allRequests.filter(function (req) {
      if (activeFilter === "Approved" && req.status !== "Approved") return false;
      if (activeFilter === "Ready" && req.status !== "Ready for Pickup") return false;
      if (activeFilter === "Released" && req.status !== "Released") return false;

      if (query) {
        var match =
          req.request_id.toLowerCase().includes(query) ||
          req.student_name.toLowerCase().includes(query) ||
          (req.student_number || "").toLowerCase().includes(query) ||
          req.document_name.toLowerCase().includes(query) ||
          req.purpose.toLowerCase().includes(query);
        if (!match) return false;
      }
      return true;
    });

    queueTableBody.innerHTML = "";

    if (filtered.length === 0) {
      emptyState.style.display = "block";
      document.querySelector(".queue-table").style.display = "none";
      return;
    }

    emptyState.style.display = "none";
    document.querySelector(".queue-table").style.display = "table";

    filtered.forEach(function (r) {
      var tr = document.createElement("tr");

      var badgeClass = "badge-pending";
      var icon = '<i class="fa-solid fa-clock"></i>';
      if (r.status === "Approved") {
        badgeClass = "badge-approved";
        icon = '<i class="fa-solid fa-gear"></i>';
      } else if (r.status === "Ready for Pickup") {
        badgeClass = "badge-ready";
        icon = '<i class="fa-solid fa-bell"></i>';
      } else if (r.status === "Released") {
        badgeClass = "badge-released";
        icon = '<i class="fa-solid fa-circle-check"></i>';
      } else if (r.status === "Rejected") {
        badgeClass = "badge-rejected";
        icon = '<i class="fa-solid fa-circle-xmark"></i>';
      } else if (r.status === "Cancelled") {
        badgeClass = "badge-cancelled";
        icon = '<i class="fa-solid fa-ban"></i>';
      }

      var submittedDate = r.created_at ? r.created_at.split(" ")[0] : "";
      var registrarNote = r.registrar_remarks || (r.status === "Pending" ? "Pending Registrar Approval" : "-");

      var actionBtnsHtml = '<div class="action-btn-group">';

      if (r.status === "Approved") {
        actionBtnsHtml +=
          '<button class="action-btn btn-ready mark-ready-btn" data-id="' + r.request_id + '">' +
          '<i class="fa-solid fa-print"></i> Mark Ready for Pickup</button>';
      } else if (r.status === "Ready for Pickup") {
        actionBtnsHtml +=
          '<button class="action-btn btn-release release-btn" data-id="' + r.request_id + '">' +
          '<i class="fa-solid fa-handshake"></i> Release Document</button>';
      }

      actionBtnsHtml +=
        '<button class="action-btn view-btn" data-id="' + r.request_id + '">' +
        '<i class="fa-solid fa-eye"></i> Details</button></div>';

      tr.innerHTML =
        "<td><span class='tracking-code'>" + r.request_id + "</span></td>" +
        "<td><strong>" + r.student_name + "</strong><br><span style='font-size:12px; color:#334155;'>ID: " + (r.student_number || "N/A") + " (" + (r.course_name || "General") + ")</span></td>" +
        "<td><strong>" + r.document_name + "</strong><br><span style='font-size:12px; color:#334155;'>" + r.copies + " copy/copies</span></td>" +
        "<td><span style='font-size:12px; color:#334155;'>" + registrarNote + "</span></td>" +
        "<td><span class='badge " + badgeClass + "'>" + icon + " " + r.status + "</span></td>" +
        "<td>" + actionBtnsHtml + "</td>";

      queueTableBody.appendChild(tr);
    });

    // Attach listeners
    document.querySelectorAll(".mark-ready-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = this.getAttribute("data-id");
        openReadyModal(id);
      });
    });

    document.querySelectorAll(".release-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = this.getAttribute("data-id");
        openReleaseModal(id);
      });
    });

    document.querySelectorAll(".view-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = this.getAttribute("data-id");
        openDetailModal(id);
      });
    });
  }

  // Open "Mark Ready" Modal
  function openReadyModal(requestId) {
    selectedRequest = allRequests.find(function (r) {
      return r.request_id === requestId;
    });
    if (!selectedRequest) return;

    document.getElementById("readyTracking").textContent = selectedRequest.request_id;
    document.getElementById("readyStudent").textContent = selectedRequest.student_name;
    document.getElementById("readyDoc").textContent = selectedRequest.document_name + " (" + selectedRequest.copies + " copy/copies)";
    pickupLocationInput.value = selectedRequest.pickup_location || "EDP Releasing Counter Window 2";
    prepRemarksInput.value = "Document printed on official security paper, signed and affixed with school dry seal.";

    readyModal.classList.add("open");
  }

  // Confirm "Ready for Pickup"
  confirmReadyBtn.addEventListener("click", async function () {
    if (!selectedRequest) return;

    confirmReadyBtn.disabled = true;
    confirmReadyBtn.textContent = "Updating...";

    try {
      var res = await fetch("/api/documents/requests/" + selectedRequest.request_id + "/edp-action", {
        method: "POST",
        headers: CEC.authHeaders(),
        body: JSON.stringify({
          action: "ready",
          pickup_location: pickupLocationInput.value.trim(),
          remarks: prepRemarksInput.value.trim(),
        }),
      });

      var data = await res.json();
      if (!res.ok) {
        alert(data.msg || "Failed to update status");
        confirmReadyBtn.disabled = false;
        confirmReadyBtn.textContent = "Confirm Ready for Pickup";
        return;
      }

      alert("Request " + selectedRequest.request_id + " marked Ready for Pickup at " + pickupLocationInput.value.trim() + "!");
      readyModal.classList.remove("open");
      loadRequests();
    } catch (e) {
      console.error(e);
      alert("Network error");
    } finally {
      confirmReadyBtn.disabled = false;
      confirmReadyBtn.textContent = "Confirm Ready for Pickup";
    }
  });

  // Open "Release Document" Modal
  function openReleaseModal(requestId) {
    selectedRequest = allRequests.find(function (r) {
      return r.request_id === requestId;
    });
    if (!selectedRequest) return;

    document.getElementById("releaseTracking").textContent = selectedRequest.request_id;
    document.getElementById("releaseStudent").textContent = selectedRequest.student_name;
    document.getElementById("releaseDoc").textContent = selectedRequest.document_name + " (" + selectedRequest.copies + " copy/copies)";

    releasedToInput.value = selectedRequest.student_name;
    idPresentedInput.value = selectedRequest.student_number ? "School ID #" + selectedRequest.student_number : "Valid Student ID";
    releaseNotesInput.value = "Physical document officially claimed and handed over at counter.";

    releaseModal.classList.add("open");
  }

  // Confirm Release
  confirmReleaseBtn.addEventListener("click", async function () {
    if (!selectedRequest) return;

    var recipient = releasedToInput.value.trim();
    if (!recipient) {
      alert("Please specify the recipient name.");
      return;
    }

    confirmReleaseBtn.disabled = true;
    confirmReleaseBtn.textContent = "Recording Release...";

    try {
      var res = await fetch("/api/documents/requests/" + selectedRequest.request_id + "/edp-action", {
        method: "POST",
        headers: CEC.authHeaders(),
        body: JSON.stringify({
          action: "release",
          released_to: recipient,
          id_presented: idPresentedInput.value.trim(),
          release_notes: releaseNotesInput.value.trim(),
        }),
      });

      var data = await res.json();
      if (!res.ok) {
        alert(data.msg || "Failed to log release");
        confirmReleaseBtn.disabled = false;
        confirmReleaseBtn.textContent = "Confirm Document Release";
        return;
      }

      alert("Document officially released to " + recipient + "!");
      releaseModal.classList.remove("open");
      loadRequests();
    } catch (e) {
      console.error(e);
      alert("Network error");
    } finally {
      confirmReleaseBtn.disabled = false;
      confirmReleaseBtn.textContent = "Confirm Document Release";
    }
  });

  // Open Full Detail Modal
  async function openDetailModal(requestId) {
    try {
      var res = await fetch("/api/documents/requests/" + requestId, {
        headers: CEC.authHeaders(),
      });
      if (!res.ok) return;
      var r = await res.json();

      document.getElementById("detailTrackingCode").textContent = r.request_id;
      document.getElementById("detailDocName").textContent = r.document_name;
      document.getElementById("detailStudentName").textContent = r.student_name + (r.student_number ? " (" + r.student_number + ")" : "");
      document.getElementById("detailCourse").textContent = (r.course_name || "N/A") + (r.year_level ? " - " + r.year_level : "");
      document.getElementById("detailPurpose").textContent = r.purpose;
      document.getElementById("detailStatus").textContent = r.status;
      document.getElementById("detailPickup").textContent = r.pickup_location || "EDP Counter Window 2";

      var releaseInfoBox = document.getElementById("detailReleaseInfoBox");
      if (r.status === "Released") {
        releaseInfoBox.style.display = "block";
        releaseInfoBox.innerHTML =
          "<strong><i class='fa-solid fa-circle-check'></i> Officially Released:</strong><br>" +
          "<span>Released on: " + (r.released_at || "N/A") + "</span><br>" +
          "<span>Claimed by: " + (r.released_to || r.student_name) + "</span><br>" +
          "<span>Release Notes: " + (r.release_notes || "Document physically handed over.") + "</span>";
      } else {
        releaseInfoBox.style.display = "none";
      }

      var timelineEl = document.getElementById("detailTimeline");
      timelineEl.innerHTML = "";
      if (r.logs && r.logs.length > 0) {
        r.logs.forEach(function (log) {
          var item = document.createElement("div");
          item.style.padding = "6px 0";
          item.style.borderBottom = "1px solid #f1f5f9";
          item.innerHTML =
            "<div style='font-size:12px; font-weight:700; color:#1e293b;'>" + log.action + " &bull; <span style='font-weight:normal; color:#334155;'>" + (log.created_at || "") + "</span></div>" +
            "<div style='font-size:12px; color:#334155;'>" + log.notes + "</div>";
          timelineEl.appendChild(item);
        });
      }

      detailModal.classList.add("open");
    } catch (e) {
      console.error(e);
    }
  }

  // Modal Closures
  closeReadyModalBtn.addEventListener("click", function () {
    readyModal.classList.remove("open");
  });
  cancelReadyBtn.addEventListener("click", function () {
    readyModal.classList.remove("open");
  });

  closeReleaseModalBtn.addEventListener("click", function () {
    releaseModal.classList.remove("open");
  });
  cancelReleaseBtn.addEventListener("click", function () {
    releaseModal.classList.remove("open");
  });

  closeDetailModalBtn.addEventListener("click", function () {
    detailModal.classList.remove("open");
  });
  closeDetailFooterBtn.addEventListener("click", function () {
    detailModal.classList.remove("open");
  });

  // Filter Pills
  document.querySelectorAll(".pill-btn").forEach(function (pill) {
    pill.addEventListener("click", function () {
      document.querySelectorAll(".pill-btn").forEach(function (p) {
        p.classList.remove("active");
      });
      this.classList.add("active");
      activeFilter = this.getAttribute("data-filter");
      renderQueue();
    });
  });

  // Stat Card Clicks
  document.querySelectorAll(".stat-card").forEach(function (card) {
    card.addEventListener("click", function () {
      var filter = this.getAttribute("data-filter");
      if (filter) {
        document.querySelectorAll(".pill-btn").forEach(function (p) {
          if (p.getAttribute("data-filter") === filter) {
            p.click();
          }
        });
      }
    });
  });

  searchInput.addEventListener("input", function () {
    renderQueue();
  });

  refreshBtn.addEventListener("click", function () {
    loadRequests();
  });

  loadRequests();
})();
