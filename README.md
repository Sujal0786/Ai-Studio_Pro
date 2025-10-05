# 🚀 AI Studio Pro: Setup & Execution Guide

Welcome to **AI Studio Pro** — an advanced AI workspace built with **React (Vite)**, **Firebase (Firestore/Auth)**, and **Gemini API** integration.  
This guide will walk you through the complete process of setting up, configuring, and running your project locally.

---

## 🧩 1. Prerequisites

Before starting, make sure you have these installed:

- **Node.js** → version **18** or later  
- **npm** (Node Package Manager)  
- A **Firebase project** created in your Google Cloud Console  
- A **Gemini API Key** from Google AI Studio

---

## 📁 2. Project Structure

Ensure your folder layout matches this structure:

```
/ai-studio-pro
├── node_modules/
├── src/
│   ├── App.jsx          # Main application logic (includes AI call)
│   ├── index.css        # Tailwind CSS directives
│   └── main.jsx         # React entry point & Firebase initialization
├── index.html           # HTML container
├── package.json         # Project dependencies
├── tailwind.config.js   # Tailwind setup
└── README.md            # This file
```

---

## ⚙️ 3. Installation

Navigate to your project folder and install dependencies:

```bash
cd ai-studio-pro
npm install
```

---

## 🔐 4. Environment Keys Configuration (**CRITICAL**)

Your app **will not run** until you correctly configure Firebase and Gemini credentials.

---

### 🧠 A. Firebase Configuration (in `src/main.jsx`)

1. Go to your [Firebase Console](https://console.firebase.google.com/).  
2. Create a new Firebase project (or use an existing one).  
3. In **Project Settings → General → Your Apps**, select **Web App** (`</>`).  
4. Copy your **Firebase SDK configuration**.  
5. Paste it inside your `src/main.jsx` file:

```javascript
// src/main.jsx
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY", // 🔑 API key
  authDomain: "your-project-id.firebaseapp.com", // Authentication domain
  projectId: "your-project-id", // Project ID
  storageBucket: "your-project-id.appspot.com", // Cloud storage bucket
  messagingSenderId: "YOUR_SENDER_ID", // Messaging ID
  appId: "YOUR_APP_ID", // Firebase App ID
  measurementId: "YOUR_MEASUREMENT_ID" // Optional (Analytics)
};
```

#### 🔍 Key Descriptions:
| Key | Purpose |
|-----|----------|
| **apiKey** | Identifies your Firebase project and authorizes API calls. |
| **authDomain** | Used for Firebase Authentication redirects (login/signup). |
| **projectId** | Unique Firebase project identifier. |
| **storageBucket** | Used for hosting uploaded files/images. |
| **messagingSenderId** | Connects Firebase Cloud Messaging (if used). |
| **appId** | Unique app instance identifier for your Firebase project. |
| **measurementId** | Used for analytics (optional). |

---

### 🤖 B. Gemini API Key (in `src/App.jsx`)

1. Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/).  
2. Open your `src/App.jsx` file.  
3. Find the function `callGeminiAPI` (around line 40).  
4. Replace the placeholder key with your real one:

```javascript
// Inside callGeminiAPI()
const apiKey = "REPLACE_WITH_YOUR_GEMINI_API_KEY";
```

💡 **Tip:** For better security, store this key in a `.env` file and load it with `import.meta.env.VITE_GEMINI_KEY`.

---

## 🧭 5. Run the Application

Once all configurations are complete, launch your local development server:

```bash
npm run dev
```

Then open the provided **localhost URL** (usually `http://localhost:5173`) in your browser.

---

## 💾 6. Optional Enhancements

- **Environment Variables:**  
  Create a `.env` file in the root:
  ```bash
  VITE_FIREBASE_API_KEY=your_key_here
  VITE_GEMINI_KEY=your_gemini_key_here
  ```
  And reference them in your code as `import.meta.env.VITE_FIREBASE_API_KEY`.

- **Deploying to Firebase Hosting:**  
  ```bash
  npm run build
  firebase deploy
  ```

---

## 🧰 Tech Stack

| Tool | Purpose |
|------|----------|
| **Vite + React** | Frontend framework for fast local development |
| **Firebase Firestore** | Cloud database for persistent data |
| **Firebase Auth** | User authentication (email, Google, etc.) |
| **Gemini API** | AI model for text/image generation |
| **Tailwind CSS** | UI styling and responsiveness |

---

## 🏁 Done!

You’re all set! 🎉  
Run your app, log in with Firebase Auth, and start generating with Gemini AI.

---

**Author:** AI Studio Pro Team  
**License:** MIT  
**Last Updated:** October 2025
