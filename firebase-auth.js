// firebase-auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

// ⬇️ Paste your actual Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyDtzfodLw2i94_MLdF8gkkU2s0covy2ec8",
  authDomain: "medimirror-12288.firebaseapp.com",
  projectId: "medimirror-12288",
  storageBucket: "medimirror-12288.firebasestorage.app",
  messagingSenderId: "504600467699",
  appId: "1:504600467699:web:9d13f1babb484c42187f86",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Sign Up Function
function signupUser() {
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(() => {
      // Redirect to profile form
      window.location.href = "profile.html";
    })
    .catch(error => {
      alert(error.message);
    });
}


// Login Function
window.loginUser = function () {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      alert("Login Successful!");
      window.location.href = "index.html";
    })
    .catch((error) => {
      alert("Error: " + error.message);
    });
};
