// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCUbJTy-KchWGTzcYeKUDf0Oez9D9YzTvU",
  authDomain: "skillswap-8b711.firebaseapp.com",
  projectId: "skillswap-8b711",
  storageBucket: "skillswap-8b711.firebasestorage.app",
  messagingSenderId: "454467452617",
  appId: "1:454467452617:web:2e976de01711c911195718",
  measurementId: "G-196P2FNXG7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);