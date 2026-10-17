// ================= PROFILE DROPDOWN =================

const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");

profileBtn.addEventListener("click", function (event) {

    event.stopPropagation();

    profileDropdown.classList.toggle("show");

});


// Close profile dropdown when clicking outside

document.addEventListener("click", function () {

    profileDropdown.classList.remove("show");

});


// ================= LOGOUT =================

document.getElementById("logoutBtn").addEventListener("click", () => {

    localStorage.removeItem("token");
    localStorage.removeItem("role");

    window.location.href = "../index.html";

});


// ================= CHANGE PASSWORD =================

document
    .getElementById("changePasswordBtn")
    .addEventListener("click", () => {

        window.location.href = "../changepass/changepassword.html";

    });


// ================= BACKEND API =================

const API_URL =
    "https://studentportal-8ct3.onrender.com";


// ================= ANNOUNCEMENTS BUTTON =================

const announcementsBtn =
    document.getElementById("announcementsBtn");

const content =
    document.getElementById("content");


// ================= OPEN ANNOUNCEMENTS =================

announcementsBtn.addEventListener("click", function (event) {

    event.preventDefault();


    // Remove active class from all navigation items

    document
        .querySelectorAll(".nav-item")
        .forEach(function (item) {

            item.classList.remove("active");

        });


    // Make Announcements active

    announcementsBtn.classList.add("active");


    // Show Announcement page

    content.innerHTML = `

        <div class="announcement-page">

            <!-- PAGE HEADER -->

            <div class="page-header">

                <h1>Announcements</h1>

                <p>
                    Create a system-wide announcement.
                </p>

            </div>


            <!-- CREATE ANNOUNCEMENT -->

            <div class="announcement-card">

                <form id="announcementForm">


                    <!-- TITLE -->

                    <div class="form-group">

                        <label for="announcementTitle">
                            Announcement Title
                        </label>

                        <input
                            type="text"
                            id="announcementTitle"
                            placeholder="Enter announcement title"
                            required
                        >

                    </div>


                    <!-- MESSAGE -->

                    <div class="form-group">

                        <label for="announcementBody">
                            Announcement Message
                        </label>

                        <textarea
                            id="announcementBody"
                            rows="6"
                            placeholder="Enter announcement message"
                            required
                        ></textarea>

                    </div>


                    <!-- POST BUTTON -->

                    <button
                        type="submit"
                        class="post-announcement-btn"
                    >

                        <i class="fa-solid fa-paper-plane"></i>

                        Post Announcement

                    </button>


                </form>


                <!-- SUCCESS / ERROR MESSAGE -->

                <div
                    id="announcementMessage"
                    class="announcement-message"
                ></div>

            </div>


            <!-- EXISTING ANNOUNCEMENTS -->

            <div
                class="announcements-list"
                id="announcementsList"
            >

                <h2>Recent Announcements</h2>

                <p>
                    Loading announcements...
                </p>

            </div>

        </div>

    `;


    // Get announcement form

    const announcementForm =
        document.getElementById("announcementForm");


    // Connect form to POST function

    announcementForm.addEventListener(
        "submit",
        postAnnouncement
    );


    // Load announcements from backend

    loadAnnouncements();

});


// ================= POST ANNOUNCEMENT =================

async function postAnnouncement(event) {

    event.preventDefault();


    // Get title

    const title =
        document
            .getElementById("announcementTitle")
            .value
            .trim();


    // Get message

    const body =
        document
            .getElementById("announcementBody")
            .value
            .trim();


    // Message box

    const messageBox =
        document.getElementById(
            "announcementMessage"
        );


    // Check empty fields

    if (!title || !body) {

        messageBox.innerHTML = `

            <p class="error-message">

                Please fill in all fields.

            </p>

        `;

        return;

    }


    // Get admin token

    const token =
        localStorage.getItem("token");


    // Check login

    if (!token) {

        messageBox.innerHTML = `

            <p class="error-message">

                You are not logged in.
                Please log in again.

            </p>

        `;

        return;

    }


    // Get button

    const button =
        document.querySelector(
            ".post-announcement-btn"
        );


    // Disable button

    button.disabled = true;


    button.innerHTML = `

        <i class="fa-solid fa-spinner fa-spin"></i>

        Posting...

    `;


    try {

        // POST request

        const response =
            await fetch(
                `${API_URL}/api/announcements`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({

                        title: title,

                        body: body

                    })

                }
            );


        // Get response

        const data =
            await response.json();


        // Check error

        if (!response.ok) {

            throw new Error(

                data.msg ||
                data.message ||
                "Failed to post announcement."

            );

        }


        // Show success message

        messageBox.innerHTML = `

            <p class="success-message">

                <i class="fa-solid fa-circle-check"></i>

                ${
                    data.msg ||
                    "Announcement posted successfully."
                }

            </p>

        `;


        // Clear form

        document
            .getElementById("announcementForm")
            .reset();


        // Reload announcements

        loadAnnouncements();


    } catch (error) {

        console.error(
            "Announcement error:",
            error
        );


        messageBox.innerHTML = `

            <p class="error-message">

                <i class="fa-solid fa-circle-exclamation"></i>

                ${error.message}

            </p>

        `;

    } finally {

        // Enable button

        button.disabled = false;


        button.innerHTML = `

            <i class="fa-solid fa-paper-plane"></i>

            Post Announcement

        `;

    }

}


// ================= GET ANNOUNCEMENTS =================

async function loadAnnouncements() {

  // Get announcement list container

  const list =
      document.getElementById("announcementsList");


  // Get login token

  const token =
      localStorage.getItem("token");


  // Check if user is logged in

  if (!token) {

      list.innerHTML = `

          <h2>Recent Announcements</h2>

          <p class="error-message">

              You are not logged in.
              Please log in again.

          </p>

      `;

      return;
  }


  try {

      // GET announcements

      const response =
          await fetch(
              `${API_URL}/api/announcements`,
              {

                  method: "GET",

                  headers: {

                      "Authorization":
                          `Bearer ${token}`

                  }

              }
          );


      // Get backend response

      const announcements =
          await response.json();


      console.log(
          "GET announcements response:",
          response.status
      );

      console.log(
          "Announcements:",
          announcements
      );


      // Check for backend error

      if (!response.ok) {

          throw new Error(

              announcements.msg ||
              announcements.message ||
              `Failed to load announcements. Status: ${response.status}`

          );

      }


      // Check if there are no announcements

      if (
          !announcements ||
          announcements.length === 0
      ) {

          list.innerHTML = `

              <h2>Recent Announcements</h2>

              <p class="no-announcements">

                  No announcements available.

              </p>

          `;

          return;
      }


      // Create announcement HTML

      let html = `

          <h2>Recent Announcements</h2>

      `;


      // Loop through announcements

      announcements.forEach(
          function (announcement) {

              const date =
                  new Date(
                      announcement.created_at
                  );


              const formattedDate =
                  date.toLocaleString();


              html += `

                  <div class="announcement-item">

                      <h3>
                          ${announcement.title}
                      </h3>


                      <p>
                          ${announcement.body}
                      </p>


                      <div class="announcement-info">

                          Posted by:
                          ${announcement.author}

                          <br>

                          ${formattedDate}

                      </div>

                  </div>

              `;

          }
      );


      // Display announcements

      list.innerHTML = html;


  } catch (error) {

      console.error(
          "Error loading announcements:",
          error
      );


      list.innerHTML = `

          <h2>Recent Announcements</h2>

          <p class="error-message">

              ${error.message}

          </p>

      `;

  }

}

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

menuBtn.addEventListener("click", function () {
  sidebar.classList.toggle("show");
});