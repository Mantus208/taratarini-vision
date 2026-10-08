require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ---------- CORS: client (Static Site) ko server se baat karne dena ----------
// Render me CORS_ORIGINS = client ka address (https://....onrender.com), koma se kai de sakte ho
const ALLOWED = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS",
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// JSON body padhna zaroori hai (photo evidence ke liye limit 2mb)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// body na aaye to req.body undefined na rahe, taaki route crash na kare
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// server jaaga hai ya nahi dekhne ke liye (login ke bina chalta hai)
app.get("/api/health", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() }),
);

const limiter = (max) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    message: {
      error: "Too many attempts. Please try again after 15 minutes.",
    },
  });
app.use("/api/auth/login", limiter(20));
app.use("/api/auth/forgot", limiter(10));
app.use("/api/auth/signup", limiter(20));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/collection", require("./routes/collection"));
app.use("/api", require("./routes/office"));

// Galat /api route par JSON 404 do (React page nahi)
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Ye API route nahi mila" }),
);

// Agar client ka build isi server ke saath hai (purana mixed setup) to wahi serve karo.
// Alag server service par client build nahi hota, wahan sirf API ka jawab milta hai.
const dist = path.join(__dirname, "../client/dist");
const index = path.join(dist, "index.html");
if (fs.existsSync(index)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(index);
  });
} else {
  app.get("/", (req, res) =>
    res.json({ ok: true, service: "taratarini-vision-api" }),
  );
}

// error handler
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log("Server chalu: port " + port));
  })
  .catch((e) => {
    console.error("MongoDB connect nahi hua:", e.message);
    process.exit(1);
  });
