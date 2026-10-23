(function () {
  "use strict";

  var currentRequests = [];
  var documentTypes = [];
  var activeFilter = "All";
  var currentDetailRequest = null;

  CEC.initUserMenu();

  if (!CEC.requireAuth()) {
    return;
  }

  CEC.loadUserDetails({
    nameId: "userName",
    roleId: "userRole",
    welcomeId: "welcomeName",
    subtitleId: "programSubtitle",
    defaultName: "Student",
  }).then(function (user) {
    if (user) {
      // Pre-fill the request form from student profile if available
      var info = user.student_info;
      var nameInput = document.getElementById("studentName");
      if (nameInput && !nameInput.value) {
        nameInput.value = (info && info.full_name) || user.full_name || user.username || "";
      }
      var emailInput = document.getElementById("studentEmail");
      if (emailInput && !emailInput.value) {
        emailInput.value = (info && info.email) || user.email || "";
      }
      var contactInput = document.getElementById("studentContact");
      if (contactInput && !contactInput.value && info) {
        contactInput.value = info.phone_number || "";
      }
      var courseInput = document.getElementById("studentCourse");
      if (courseInput && !courseInput.value && info) {
        courseInput.value = info.course || "";
      }
      var yearSelect = document.getElementById("studentYear");
      if (yearSelect && info && info.year) {
        for (var i = 0; i < yearSelect.options.length; i++) {
          if (yearSelect.options[i].value === info.year) {
            yearSelect.value = info.year;
            break;
          }
        }
      }
    }
  });

  // DOM Elements
  var statTotal = document.getElementById("statTotal");
  var statPending = document.getElementById("statPending");
  var statReady = document.getElementById("statReady");
  var statReleased = document.getElementById("statReleased");

  var requestsTableBody = document.getElementById("requestsTableBody");
  var emptyState = document.getElementById("emptyState");
  var searchInput = document.getElementById("searchRequests");
  var newRequestBtn = document.getElementById("newRequestBtn");
  var refreshBtn = document.getElementById("refreshBtn");

  var requestModal = document.getElementById("requestModal");
  var closeRequestModalBtn = document.getElementById("closeRequestModalBtn");
  var cancelRequestFormBtn = document.getElementById("cancelRequestFormBtn");
  var requestForm = document.getElementById("requestForm");
  var docTypeSelect = document.getElementById("docTypeSelect");
  var docTypeInfo = document.getElementById("docTypeInfo");

  var detailModal = document.getElementById("detailModal");
  var closeDetailModalBtn = document.getElementById("closeDetailModalBtn");
  var closeDetailFooterBtn = document.getElementById("closeDetailFooterBtn");
  var printClaimStubBtn = document.getElementById("printClaimStubBtn");

  // Fetch document types
  async function loadDocumentTypes() {
    try {
      var res = await fetch("/api/documents/types", {
        headers: CEC.authHeaders(),
      });
      if (!res.ok) return;
      documentTypes = await res.json();

      docTypeSelect.innerHTML = '<option value="">-- Choose Document --</option>';
      documentTypes.forEach(function (dt) {
        var opt = document.createElement("option");
        opt.value = dt.document_type_id;
        opt.textContent = dt.name + (dt.fee > 0 ? " (₱" + dt.fee.toFixed(2) + ")" : " (Free)");
        docTypeSelect.appendChild(opt);
      });
    } catch (e) {
      console.error("Failed to load document types", e);
    }
  }

  // Update dynamic info box when document type is chosen
  docTypeSelect.addEventListener("change", function () {
    var selectedId = parseInt(this.value, 10);
    var dt = documentTypes.find(function (d) {
      return d.document_type_id === selectedId;
    });

    if (dt) {
      docTypeInfo.style.display = "block";
      docTypeInfo.innerHTML =
        "<strong>" + dt.name + "</strong><br>" +
        "<span style='color:#64748b; font-size:12px;'>" + dt.description + "</span><br>" +
        "<div style='margin-top:6px; display:flex; gap:16px; font-weight:600;'>" +
        "<span>⏱ Est. Processing: " + dt.processing_days + " working days</span>" +
        "<span>💰 Processing Fee: " + (dt.fee > 0 ? "₱" + dt.fee.toFixed(2) : "Free") + "</span>" +
        (dt.requires_clearance ? "<span style='color:#d97706;'>⚠️ Requires Clearance</span>" : "") +
        "</div>";
    } else {
      docTypeInfo.style.display = "none";
    }
  });

  // Load statistics
  async function loadStats() {
    try {
      var res = await fetch("/api/documents/stats", {
        headers: CEC.authHeaders(),
      });
      if (!res.ok) return;
      var stats = await res.json();
      if (statTotal) statTotal.textContent = stats.total || 0;
      if (statPending) statPending.textContent = stats.pending || 0;
      if (statReady) statReady.textContent = stats.ready_for_pickup || 0;
      if (statReleased) statReleased.textContent = stats.released || 0;
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  }

  // Fetch student's requests
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
      currentRequests = await res.json();
      renderRequests();
      loadStats();
    } catch (e) {
      console.error("Failed to load requests", e);
    }
  }

  // Filter & Render
  function renderRequests() {
    var query = (searchInput.value || "").toLowerCase().trim();
    var filtered = currentRequests.filter(function (req) {
      // Filter by status tab
      if (activeFilter === "Pending" && req.status !== "Pending") return false;
      if (activeFilter === "Approved" && req.status !== "Approved") return false;
      if (activeFilter === "Ready" && req.status !== "Ready for Pickup") return false;
      if (activeFilter === "Released" && req.status !== "Released") return false;
      if (activeFilter === "Rejected" && req.status !== "Rejected") return false;

      // Filter by search query
      if (query) {
        var match =
          req.request_id.toLowerCase().includes(query) ||
          req.document_name.toLowerCase().includes(query) ||
          req.purpose.toLowerCase().includes(query);
        if (!match) return false;
      }
      return true;
    });

    requestsTableBody.innerHTML = "";

    if (filtered.length === 0) {
      emptyState.style.display = "block";
      document.querySelector(".requests-table").style.display = "none";
      return;
    }

    emptyState.style.display = "none";
    document.querySelector(".requests-table").style.display = "table";

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

      var actionBtnsHtml =
        '<button class="action-btn view-detail-btn" data-id="' + r.request_id + '">' +
        '<i class="fa-solid fa-eye"></i> View & Claim Stub</button>';

      if (r.status === "Pending") {
        actionBtnsHtml +=
          '<button class="action-btn cancel-btn" data-id="' + r.request_id + '">' +
          '<i class="fa-solid fa-xmark"></i> Cancel</button>';
      }

      tr.innerHTML =
        "<td><span class='tracking-code'>" + r.request_id + "</span></td>" +
        "<td><strong>" + r.document_name + "</strong></td>" +
        "<td>" + r.copies + " copy/copies<br><span style='font-size:12px; color:#64748b;'>" + r.purpose + "</span></td>" +
        "<td>" + submittedDate + "</td>" +
        "<td><span class='badge " + badgeClass + "'>" + icon + " " + r.status + "</span></td>" +
        "<td>" + actionBtnsHtml + "</td>";

      requestsTableBody.appendChild(tr);
    });

    // Attach listeners
    document.querySelectorAll(".view-detail-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = this.getAttribute("data-id");
        openDetailModal(id);
      });
    });

    document.querySelectorAll(".cancel-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = this.getAttribute("data-id");
        handleCancelRequest(id);
      });
    });
  }

  // Cancel Request
  async function handleCancelRequest(requestId) {
    if (!confirm("Are you sure you want to cancel request " + requestId + "?")) {
      return;
    }

    try {
      var res = await fetch("/api/documents/requests/" + requestId + "/cancel", {
        method: "POST",
        headers: CEC.authHeaders(),
      });
      var data = await res.json();
      if (!res.ok) {
        alert(data.msg || "Failed to cancel request");
        return;
      }
      alert("Request " + requestId + " was cancelled.");
      loadRequests();
    } catch (e) {
      console.error(e);
      alert("Connection error");
    }
  }

  // Open Detail / Claim Stub Modal
  async function openDetailModal(requestId) {
    try {
      var res = await fetch("/api/documents/requests/" + requestId, {
        headers: CEC.authHeaders(),
      });
      if (!res.ok) {
        alert("Could not load details");
        return;
      }
      var r = await res.json();
      currentDetailRequest = r;

      document.getElementById("detailTrackingCode").textContent = r.request_id;
      document.getElementById("detailDocName").textContent = r.document_name;

      // Update Stepper
      var step1 = document.getElementById("step1");
      var step2 = document.getElementById("step2");
      var step3 = document.getElementById("step3");
      var step4 = document.getElementById("step4");

      [step1, step2, step3, step4].forEach(function (s) {
        s.className = "step-item";
      });

      if (r.status === "Pending") {
        step1.classList.add("active");
      } else if (r.status === "Approved") {
        step1.classList.add("completed");
        step2.classList.add("completed");
        step3.classList.add("active");
      } else if (r.status === "Ready for Pickup") {
        step1.classList.add("completed");
        step2.classList.add("completed");
        step3.classList.add("completed");
        step4.classList.add("active");
      } else if (r.status === "Released") {
        step1.classList.add("completed");
        step2.classList.add("completed");
        step3.classList.add("completed");
        step4.classList.add("completed");
      } else if (r.status === "Rejected") {
        step1.classList.add("completed");
        step2.classList.add("active");
        step2.querySelector(".step-label").textContent = "Registrar Rejected";
      }

      // Status banner inside modal
      var banner = document.getElementById("detailStatusBanner");
      if (r.status === "Ready for Pickup") {
        banner.style.display = "block";
        banner.style.background = "#dcfce7";
        banner.style.borderLeft = "5px solid #16a34a";
        banner.style.color = "#166534";
        banner.innerHTML =
          "<strong><i class='fa-solid fa-circle-check'></i> Ready for Pickup!</strong><br>" +
          "Your physical document is ready. Please proceed to: <strong>" + (r.pickup_location || "EDP Counter Window 2") + "</strong>.<br>" +
          "<span style='font-size:12px;'>Bring a valid Student ID or government-issued ID to claim.</span>";
      } else if (r.status === "Rejected") {
        banner.style.display = "block";
        banner.style.background = "#fee2e2";
        banner.style.borderLeft = "5px solid #dc2626";
        banner.style.color = "#991b1b";
        banner.innerHTML =
          "<strong><i class='fa-solid fa-circle-exclamation'></i> Request Rejected by Registrar</strong><br>" +
          "Reason: " + (r.rejection_reason || "Requirements not met.");
      } else {
        banner.style.display = "none";
      }

      // Claim Stub fields
      document.getElementById("stubTracking").textContent = r.request_id;
      document.getElementById("stubDoc").textContent = r.document_name + " (" + r.copies + " copy/copies)";
      document.getElementById("stubStudent").textContent = r.student_name + (r.student_number ? " (" + r.student_number + ")" : "");
      document.getElementById("stubCourse").textContent = (r.course_name || "N/A") + (r.year_level ? " - " + r.year_level : "");
      document.getElementById("stubPurpose").textContent = r.purpose;
      document.getElementById("stubDate").textContent = r.created_at || "N/A";
      document.getElementById("stubLocation").textContent = r.pickup_location || "EDP Counter Window 2";
      document.getElementById("stubStatus").textContent = r.status;

      // Timeline / Audit logs
      var timelineContainer = document.getElementById("detailTimeline");
      timelineContainer.innerHTML = "";
      if (r.logs && r.logs.length > 0) {
        r.logs.forEach(function (log) {
          var item = document.createElement("div");
          item.className = "timeline-item";
          item.innerHTML =
            "<div class='timeline-dot'></div>" +
            "<div class='timeline-content'>" +
            "<div style='font-weight:700; color:#1e293b;'>" + log.action + " <span style='font-size:12px; color:#64748b; font-weight:normal;'>by " + (log.actor_name || "Staff") + " (" + (log.actor_role || "") + ")</span></div>" +
            "<div style='color:#475569; font-size:12px; margin-top:2px;'>" + log.notes + "</div>" +
            "<div class='timeline-time'>" + (log.created_at || "") + "</div>" +
            "</div>";
          timelineContainer.appendChild(item);
        });
      } else {
        timelineContainer.innerHTML = "<p style='color:#94a3b8; font-size:12px;'>No log entries yet.</p>";
      }

      detailModal.classList.add("open");
    } catch (e) {
      console.error(e);
      alert("Failed to fetch request details");
    }
  }

  // Submit Request Form
  requestForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    var submitBtn = document.getElementById("submitRequestBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    var payload = {
      document_type_id: parseInt(docTypeSelect.value, 10),
      student_name: document.getElementById("studentName").value,
      student_number: document.getElementById("studentNumber").value,
      course_name: document.getElementById("studentCourse").value,
      year_level: document.getElementById("studentYear").value,
      contact_number: document.getElementById("studentContact").value,
      email: document.getElementById("studentEmail").value,
      copies: parseInt(document.getElementById("requestCopies").value, 10),
      purpose: document.getElementById("requestPurpose").value,
      special_instructions: document.getElementById("requestInstructions").value,
    };

    try {
      var res = await fetch("/api/documents/requests", {
        method: "POST",
        headers: CEC.authHeaders(),
        body: JSON.stringify(payload),
      });

      var data = await res.json();
      if (!res.ok) {
        alert(data.msg || "Failed to submit request");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Request";
        return;
      }

      alert("Document request successfully submitted! Your Tracking Reference is: " + data.request.request_id);
      requestModal.classList.remove("open");
      requestForm.reset();
      docTypeInfo.style.display = "none";
      loadRequests();
    } catch (e) {
      console.error(e);
      alert("Network error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Request";
    }
  });

  // Modal Open / Close bindings
  newRequestBtn.addEventListener("click", function () {
    requestModal.classList.add("open");
  });

  closeRequestModalBtn.addEventListener("click", function () {
    requestModal.classList.remove("open");
  });

  cancelRequestFormBtn.addEventListener("click", function () {
    requestModal.classList.remove("open");
  });

  closeDetailModalBtn.addEventListener("click", function () {
    detailModal.classList.remove("open");
  });

  closeDetailFooterBtn.addEventListener("click", function () {
    detailModal.classList.remove("open");
  });

  printClaimStubBtn.addEventListener("click", function () {
    window.print();
  });

  // Filter Pill clicks
  document.querySelectorAll(".pill-btn").forEach(function (pill) {
    pill.addEventListener("click", function () {
      document.querySelectorAll(".pill-btn").forEach(function (p) {
        p.classList.remove("active");
      });
      this.classList.add("active");
      activeFilter = this.getAttribute("data-filter");
      renderRequests();
    });
  });

  // Search input
  searchInput.addEventListener("input", function () {
    renderRequests();
  });

  // Refresh
  refreshBtn.addEventListener("click", function () {
    loadRequests();
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

  // Initial load
  loadDocumentTypes();
  loadRequests();
})();
