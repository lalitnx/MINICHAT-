# 💬 MiniChat

A privacy-focused, real-time chat app where messages **self-destruct** after they are seen. Built with the MERN stack and Socket.io, with a WhatsApp-style interface, a 3D animated login screen, and **Nova AI**, a built-in assistant powered by Google Gemini.

> Final-year B.Tech CSE major project.

---

## ✨ Features

- **Real-time messaging** with Socket.io (WhatsApp-style chat UI)
- **Self-destructing messages**: after a message is seen, it is deleted following a hidden random delay
- **Expiry animation**: scan-line and particle-dissolve effect when a message disappears
- **Auto-deletion** using MongoDB TTL indexes
- **Keep a message**: save a message, and the sender is notified
- **Screenshot deterrents** (best-effort only, not true DRM)
- **Nova AI assistant**: ask questions, get code help, and get live web answers using Gemini with Google Search grounding (with source citations)
- **Content moderation** using the Google Gemini API
- **Secure authentication** with JWT and bcrypt
- **3D animated login screen** (React Three Fiber) and smooth UI animations (Framer Motion)
- **Dark theme**

---

## 🛠️ Tech Stack

| Layer      | Technologies                                         |
| ---------- | ---------------------------------------------------- |
| Frontend   | React, React Three Fiber, Framer Motion              |
| Backend    | Node.js, Express.js, Socket.io                       |
| Database   | MongoDB (Mongoose), TTL indexes                      |
| Auth       | JWT, bcrypt                                          |
| AI         | Google Gemini API (moderation + Nova AI with Search) |
| Deployment | Vercel (client), Render (server), MongoDB Atlas (DB) |

---

## 📁 Project Structure

```
MINICHAT/
├── client/     # React frontend
├── server/     # Express + Socket.io backend
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- A MongoDB database (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone the repository

```bash
git clone https://github.com/lalitnx/MINICHAT-.git
cd MINICHAT-
```

### 2. Set up the server

```bash
cd server
npm install
cp .env.example .env
```

Open `server/.env` and fill in your values:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
GEMINI_API_KEY=your_gemini_api_key
```

Start the server:

```bash
npm run dev
```

### 3. Set up the client

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

The app will be available at `http://localhost:5173` (or the port shown in your terminal).

---

## 🔐 Environment Variables

| Variable         | Description                                    |
| ---------------- | ---------------------------------------------- |
| `PORT`           | Port the server runs on                        |
| `MONGO_URI`      | MongoDB connection string                      |
| `JWT_SECRET`     | Secret used to sign JWT tokens                 |
| `GEMINI_API_KEY` | Google Gemini API key (moderation + Nova AI)   |

> ⚠️ Never commit your `.env` file. It is already listed in `.gitignore`.

---

## 🤖 Nova AI

Nova is a built-in bot user in every account. Open the chat with Nova to:

- Ask general questions and get explanations
- Get help writing or understanding code
- Ask about recent news, scores and facts, answered using live Google Search, with source links

If no `GEMINI_API_KEY` is set, Nova will tell you how to add one.

---

## ⚠️ Privacy Notes

- Messages between users are deleted automatically after being seen.
- Screenshot protection on the web is best-effort and cannot be guaranteed.
- Nova AI messages are kept so you can refer back to them, and your prompts to Nova are sent to Google's Gemini API.

---

## 🗺️ Roadmap

- [ ] Status / stories with 24-hour expiry
- [ ] Razorpay payment integration
- [ ] End-to-end encryption

---

## 👨‍💻 Author

**Lalit**
Final-year B.Tech CSE student, Bikaner Technical University

GitHub: [@lalitnx](https://github.com/lalitnx)

---

## 📄 License

This project is licensed under the MIT License. Add a `LICENSE` file to the repo if you want to use this.
