
# SnapURL — URL Shortener


A full-featured URL shortener built with Node.js, Express, MongoDB and Vanilla JS.

---

## Features

- 🔗 Shorten long URLs to short links
- 📊 Click tracking per link
- 📱 QR code generator + download
- 🕐 Link history with date and time
- ✏️ Custom aliases
- ⏳ Link expiry (1 / 7 / 30 days)
- 🌙 Dark / Light mode toggle
- 🔍 Search your links
- 🗑️ Delete links

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Frontend | HTML, CSS, Vanilla JS |

---

## Project Structure

```

snapurl/
├── server.js        ← Express server + all API routes
├── package.json     ← dependencies
├── .env             ← config (create this manually)
└── public/
    ├── index.html   ← main UI
    ├── style.css    ← styles + dark/light mode
    └── script.js   ← frontend logic
```

---

## ⚙️ How to Run This Project Locally

### ✅ Step 1 — Install Node.js

Download from → https://nodejs.org/en/download (choose LTS version)

After install verify:
```bash
node -v
npm -v
```

---

### ✅ Step 2 — Install MongoDB

Download from → https://www.mongodb.com/try/download/community

After install verify:
```bash
mongod --version
```

---

### ✅ Step 3 — Clone This Project

```bash
git clone https://github.com/sonuchandra458/snapurl.git
cd snapurl
```

---

### ✅ Step 4 — Install Dependencies

```bash
npm install
```

---

### ✅ Step 5 — Create .env File

Create a new file named `.env` in the root folder and paste:

```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/snapurl
BASE_URL=http://localhost:3000
```

---

### ✅ Step 6 — Start MongoDB

Open a **new terminal** and run:

**Mac / Linux:**
```bash
mongod --dbpath ~/data/db
```

**Windows:**
```bash
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
```

> Keep this terminal open the whole time

---

### ✅ Step 7 — Start the Server

In your main terminal:
```bash
node server.js
```

You should see:
```
✅  MongoDB connected
🚀  SnapURL running → http://localhost:3000
```

---

### ✅ Step 8 — Open in Browser

```
http://localhost:3000
```

🎉 Your URL shortener is running!

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/shorten` | Create short URL |
| GET | `/api/history` | Get user link history |
| DELETE | `/api/url/:id` | Delete a link |
| GET | `/:code` | Redirect to original URL |

---

## Author

Made by ** arpita ,krishna ,Sonu Chandra and kashak **
GitHub → https://github.com/sonuchandra458
```

---


