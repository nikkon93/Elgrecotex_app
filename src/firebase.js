// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWtV9tqv3OKoni90hryN7pj9BdrGEeS5Q",
  authDomain: "elgrecotex-app.firebaseapp.com",
  projectId: "elgrecotex-app",
  storageBucket: "elgrecotex-app.firebasestorage.app",
  messagingSenderId: "587448499630",
  appId: "1:587448499630:web:0b0af9dce071103233dc3f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);