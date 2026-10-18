
         const API_URL = "";

         const form = document.getElementById("changePasswordForm");
         const message = document.getElementById("message");
         const submitBtn = document.getElementById("submitBtn");
   
         const oldPassInput = document.getElementById("old_password");
         const newPassInput = document.getElementById("new_password");
         const confirmPassInput = document.getElementById("confirmpass");
   
         // Redirect to login if there's no token at all.
         const token = localStorage.getItem("token");
   
         if (!token) {
           message.textContent = "You must be logged in. Redirecting...";
           message.style.color = "#f87171";
           setTimeout(() => {
             window.location.href = "index.html";
           }, 1500);
         }
   
         form.addEventListener("submit", async (event) => {
           event.preventDefault();
   
           const old_password = oldPassInput.value;
           const new_password = newPassInput.value;
           const confirmPassword = confirmPassInput.value;
   
           if (new_password !== confirmPassword) {
             message.textContent = "New passwords do not match.";
             message.style.color = "#f87171";
             return;
           }
   
           if (new_password === old_password) {
             message.textContent =
               "New password must be different from the current password.";
             message.style.color = "#f87171";
             return;
           }
   
           const activeToken = localStorage.getItem("token");
   
           if (!activeToken) {
             window.location.href = "index.html";
             return;
           }
   
           submitBtn.disabled = true;
           message.textContent = "Saving...";
           message.style.color = "white";
   
           try {
             const response = await fetch(`${API_URL}/api/auth/change-password`, {
               method: "POST",
               headers: {
                 "Content-Type": "application/json",
                 Authorization: `Bearer ${activeToken}`,
               },
               body: JSON.stringify({
                   old_password,
                   new_password,
               }),
             });
   
             if (response.status === 401) {
               message.textContent = "Session expired. Please login again.";
               message.style.color = "#f87171";
               localStorage.removeItem("token");
               localStorage.removeItem("role");
               setTimeout(() => {
                 window.location.href = "index.html";
               }, 1500);
               return;
             }
   
             if (!response.ok) {
               message.textContent =
                 "Could not change password. This endpoint isn't confirmed yet — check with your backend team.";
               message.style.color = "#f87171";
               submitBtn.disabled = false;
               return;
             }
   
             message.textContent = "Password changed successfully.";
             message.style.color = "#4ade80";
   
             form.reset();
   
             setTimeout(() => {
               window.location.href = "dashboard.html";
             }, 1200);
           } catch (error) {
             console.error(error);
             message.textContent = "Could not reach the server.";
             message.style.color = "#f87171";
             submitBtn.disabled = false;
           }
         });

         // Return the last page
        const backLink = document.getElementById("backLink");

        backLink.addEventListener("click", function (event) {

          event.preventDefault();

          window.history.back();

        });