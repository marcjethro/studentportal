
   const API_URL = "";

   const message = document.getElementById("message");
   const usernameInput = document.getElementById("text");
   const recoverBtn = document.getElementById("buttonBtn");
   const backBtn = document.getElementById("backBtn");
   
   backBtn.addEventListener("click", () => {
     window.location.href = "../index.html";
   });
   
   recoverBtn.addEventListener("click", async () => {
     const username = usernameInput.value.trim();
   
     if (!username) {
       message.textContent = "Please enter your username.";
       message.style.color = "red";
       return;
     }
   
     recoverBtn.disabled = true;
     message.textContent = "Sending...";
     message.style.color = "black";
   
     try {
       const response = await fetch(`${API_URL}/api/auth/forget-password`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
         },
         body: JSON.stringify({ username }),
       });
   
       if (!response.ok) {
         message.textContent =
           "Could not process this request. Please check the username and try again.";
         message.style.color = "red";
         recoverBtn.disabled = false;
         return;
       }
   
       const data = await response.json();
   
       message.textContent =
         data.msg ||
         "If that username exists, recovery instructions have been sent.";
       message.style.color = "green";
   
       usernameInput.value = "";
       recoverBtn.disabled = false;
     } catch (error) {
       console.error(error);
       message.textContent = "Could not reach the server.";
       message.style.color = "red";
       recoverBtn.disabled = false;
     }
   });