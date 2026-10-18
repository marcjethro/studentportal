const API_URL = "";


// =========================================
// BACK BUTTON
// =========================================

const backButton = document.getElementById("backButton");

if (backButton) {
    backButton.addEventListener("click", function () {
        window.history.back();
    });
}


// =========================================
// NEW STUDENT PAGE 1
// SAVE INFORMATION AND GO TO PAGE 2
// =========================================

const proceedNext = document.getElementById("proceedNext");

if (proceedNext) {

    proceedNext.addEventListener("click", function () {

        const enrollmentForm = document.getElementById("enrollmentForm");

        // Make sure the form exists
        if (!enrollmentForm) {
            return;
        }

        // Check required fields
        if (!enrollmentForm.checkValidity()) {
            enrollmentForm.reportValidity();
            return;
        }


        // Collect Page 1 information
        const studentInformation = {

            first_name: document.getElementById("first-name").value.trim(),

            middle_name: document.getElementById("middle-name").value.trim(),

            last_name: document.getElementById("last-name").value.trim(),

            suffix: document.getElementById("suffix").value.trim(),

            birthdate: document.getElementById("birthdate").value,

            phone: document.getElementById("phone").value.trim(),

            email: document.getElementById("email").value.trim(),

            home_address: document.getElementById("home-address").value.trim(),


            // Guardian information
            guardian_last_name:
                document.getElementById("guardian-last-name").value.trim(),

            guardian_first_name:
                document.getElementById("guardian-first-name").value.trim(),

            guardian_middle_name:
                document.getElementById("guardian-middle-name").value.trim(),

            guardian_phone:
                document.getElementById("guardian-phone").value.trim(),

            guardian_address:
                document.getElementById("guardian-address").value.trim()
        };


        // Save Page 1 information temporarily
        sessionStorage.setItem(
            "studentInformation",
            JSON.stringify(studentInformation)
        );


        // Go to Page 2
        window.location.href = "new-student2.html";

    });

}