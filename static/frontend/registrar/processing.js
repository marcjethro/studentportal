(function () {
  "use strict";

  var allRequests = [];
  var activeFilter = "Pending";
  var selectedRequest = null;
  var currentActionTab = "approve";

  CEC.initUserMenu();

  if (!CEC.requireAuth()) {
    return;
  }

  CEC.loadUserDetails({
    nameId: "officerName",
    roleId: "officerRole",
    defaultName: "Registrar",
  });

  // DOM Elements
  var statPending = document.getElementById("statPending");
  var statApproved = document.getElementById("statApproved");
  var statRejected = document.getElementById("statRejected");
  var statTotal = document.getElementById("statTotal");

  var queueTableBody = document.getElementById("queueTableBody");
  var emptyState = document.getElementById("emptyState");
  var searchInput = document.getElementById("searchQueue");
  var refreshBtn = document.getElementById("refreshBtn");

  var reviewModal = document.getElementById("reviewModal");
  var closeReviewModalBtn = document.getElementById("closeReviewModalBtn");
  var closeReviewFooterBtn = document.getElementById("closeReviewFooterBtn");

  var tabApproveBtn = document.getElementById("tabApproveBtn");
  var tabRejectBtn = document.getElementById("tabRejectBtn");
  var approveSection = document.getElementById("approveSection");
  var rejectSection = document.getElementById("rejectSection");

  var submitApproveBtn = document.getElementById("submitApproveBtn");
  var submitRejectBtn = document.getElementById("submitRejectBtn");
  var registrarRemarksInput = document.getElementById("registrarRemarks");
  var rejectionReasonInput = document.getElementById("rejectionReason");

  // Load stats
  async function loadStats() {
    try {
      var res = await fetch("/api/documents/stats", {
        headers: CEC.authHeaders(),
      });
      if (!res.ok) return;
      var stats = await res.json();
      if (statPending) statPending.textContent = stats.pending_review || 0;
      if (statApproved) statApproved.textContent = stats.approved_total || 0;
      if (statRejected) statRejected.textContent = stats.rejected_total || 0;
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

  // Filter & Render
  function renderQueue() {
    var query = (searchInput.value || "").toLowerCase().trim();

    var filtered = allRequests.filter(function (req) {
      if (activeFilter === "Pending" && req.status !== "Pending") return false;
      if (activeFilter === "Approved" && !["Approved", "Ready for Pickup", "Released"].includes(req.status)) return false;
      if (activeFilter === "Rejected" && req.status !== "Rejected") return false;

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

      tr.innerHTML =
        "<td><span class='tracking-code'>" + r.request_id + "</span></td>" +
        "<td><strong>" + r.student_name + "</strong><br><span style='font-size:12px; color:#334155;'>ID: " + (r.student_number || "N/A") + " (" + (r.course_name || "General") + ")</span></td>" +
        "<td><strong>" + r.document_name + "</strong><br><span style='font-size:12px; color:#334155;'>" + r.copies + " copy/copies</span></td>" +
        "<td>" + r.purpose + "</td>" +
        "<td>" + submittedDate + "</td>" +
        "<td><span class='badge " + badgeClass + "'>" + icon + " " + r.status + "</span></td>" +
        "<td><button class='action-btn review-btn' data-id='" + r.request_id + "'>" +
        (r.status === "Pending" ? "<i class='fa-solid fa-gavel'></i> Review &amp; Approve" : "<i class='fa-solid fa-eye'></i> View Details") +
        "</button></td>";

      queueTableBody.appendChild(tr);
    });

    document.querySelectorAll(".review-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = this.getAttribute("data-id");
        openReviewModal(id);
      });
    });
  }

  // Open Review Modal
  async function openReviewModal(requestId) {
    try {
      var res = await fetch("/api/documents/requests/" + requestId, {
        headers: CEC.authHeaders(),
      });
      if (!res.ok) {
        alert("Failed to load request details");
        return;
      }
      var r = await res.json();
      selectedRequest = r;

      document.getElementById("reviewTrackingCode").textContent = r.request_id;
      document.getElementById("reviewStudentName").textContent = r.student_name;
      document.getElementById("reviewStudentId").textContent = r.student_number || "N/A";
      document.getElementById("reviewCourse").textContent = (r.course_name || "N/A") + (r.year_level ? " (" + r.year_level + ")" : "");
      document.getElementById("reviewContact").textContent = (r.contact_number || "N/A") + " / " + (r.email || "N/A");

      document.getElementById("reviewDocType").textContent = r.document_name;
      document.getElementById("reviewCopies").textContent = r.copies + " copy/copies";
      document.getElementById("reviewPurpose").textContent = r.purpose;
      document.getElementById("reviewDate").textContent = r.created_at || "N/A";
      document.getElementById("reviewInstructions").textContent = r.special_instructions || "None provided";
      document.getElementById("reviewStatus").textContent = r.status;

      // Status-based action box visibility
      var interactiveActionBox = document.getElementById("interactiveActionBox");
      var reviewCompletedBox = document.getElementById("reviewCompletedBox");

      if (r.status === "Pending") {
        interactiveActionBox.style.display = "block";
        reviewCompletedBox.style.display = "none";
        registrarRemarksInput.value = "Scholastic records and student clearances verified. Approved for EDP printing.";
        rejectionReasonInput.value = "";
        switchActionTab("approve");
      } else {
        interactiveActionBox.style.display = "none";
        reviewCompletedBox.style.display = "block";

        var completedHtml = "<strong>Current Status: " + r.status + "</strong><br>";
        if (r.registrar_name) {
          completedHtml += "<span>Reviewed by: " + r.registrar_name + " on " + (r.registrar_reviewed_at || "N/A") + "</span><br>";
        }
        if (r.registrar_remarks) {
          completedHtml += "<span style='color:#0369a1;'>Registrar Remarks: " + r.registrar_remarks + "</span><br>";
        }
        if (r.rejection_reason) {
          completedHtml += "<span style='color:#b91c1c;'>Rejection Reason: " + r.rejection_reason + "</span><br>";
        }
        if (r.edp_name) {
          completedHtml += "<span>Handled by EDP: " + r.edp_name + "</span><br>";
        }
        if (r.pickup_location) {
          completedHtml += "<span>Releasing Counter: " + r.pickup_location + "</span><br>";
        }
        reviewCompletedBox.innerHTML = completedHtml;
      }

      // Render timeline
      var timelineContainer = document.getElementById("reviewTimeline");
      timelineContainer.innerHTML = "";
      if (r.logs && r.logs.length > 0) {
        r.logs.forEach(function (log) {
          var item = document.createElement("div");
          item.style.padding = "6px 0";
          item.style.borderBottom = "1px solid #f1f5f9";
          item.innerHTML =
            "<div style='font-size:12px; font-weight:700; color:#1e293b;'>" + log.action + " &bull; <span style='font-weight:normal; color:#334155;'>" + (log.created_at || "") + "</span></div>" +
            "<div style='font-size:12px; color:#334155;'>" + log.notes + "</div>";
          timelineContainer.appendChild(item);
        });
      }

      reviewModal.classList.add("open");
    } catch (e) {
      console.error(e);
      alert("Error fetching details");
    }
  }

  function switchActionTab(tab) {
    currentActionTab = tab;
    if (tab === "approve") {
      tabApproveBtn.className = "tab-btn active approve-tab";
      tabRejectBtn.className = "tab-btn";
      approveSection.style.display = "block";
      rejectSection.style.display = "none";
    } else {
      tabApproveBtn.className = "tab-btn";
      tabRejectBtn.className = "tab-btn active reject-tab";
      approveSection.style.display = "none";
      rejectSection.style.display = "block";
    }
  }

  tabApproveBtn.addEventListener("click", function () {
    switchActionTab("approve");
  });

  tabRejectBtn.addEventListener("click", function () {
    switchActionTab("reject");
  });

  // Submit Approval
  submitApproveBtn.addEventListener("click", async function () {
    if (!selectedRequest) return;

    submitApproveBtn.disabled = true;
    submitApproveBtn.textContent = "Approving...";

    try {
      var res = await fetch("/api/documents/requests/" + selectedRequest.request_id + "/registrar-review", {
        method: "POST",
        headers: CEC.authHeaders(),
        body: JSON.stringify({
          action: "approve",
          remarks: registrarRemarksInput.value.trim(),
        }),
      });

      var data = await res.json();
      if (!res.ok) {
        alert(data.msg || "Failed to approve request");
        submitApproveBtn.disabled = false;
        submitApproveBtn.textContent = "Approve for EDP Release";
        return;
      }

      alert("Request " + selectedRequest.request_id + " approved! Forwarded to EDP queue.");
      reviewModal.classList.remove("open");
      loadRequests();
    } catch (e) {
      console.error(e);
      alert("Network error");
    } finally {
      submitApproveBtn.disabled = false;
      submitApproveBtn.textContent = "Approve for EDP Release";
    }
  });

  // Submit Rejection
  submitRejectBtn.addEventListener("click", async function () {
    if (!selectedRequest) return;

    var reason = rejectionReasonInput.value.trim();
    if (!reason) {
      alert("Please provide a reason for rejection.");
      return;
    }

    if (!confirm("Are you sure you want to reject this request?")) {
      return;
    }

    submitRejectBtn.disabled = true;
    submitRejectBtn.textContent = "Rejecting...";

    try {
      var res = await fetch("/api/documents/requests/" + selectedRequest.request_id + "/registrar-review", {
        method: "POST",
        headers: CEC.authHeaders(),
        body: JSON.stringify({
          action: "reject",
          rejection_reason: reason,
        }),
      });

      var data = await res.json();
      if (!res.ok) {
        alert(data.msg || "Failed to reject request");
        submitRejectBtn.disabled = false;
        submitRejectBtn.textContent = "Confirm Rejection";
        return;
      }

      alert("Request " + selectedRequest.request_id + " has been rejected.");
      reviewModal.classList.remove("open");
      loadRequests();
    } catch (e) {
      console.error(e);
      alert("Network error");
    } finally {
      submitRejectBtn.disabled = false;
      submitRejectBtn.textContent = "Confirm Rejection";
    }
  });

  // Modal Closures
  closeReviewModalBtn.addEventListener("click", function () {
    reviewModal.classList.remove("open");
  });

  closeReviewFooterBtn.addEventListener("click", function () {
    reviewModal.classList.remove("open");
  });

  // Filter Pill clicks
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

  // Stat card clicks
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
