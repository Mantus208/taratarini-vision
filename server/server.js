require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

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
app.use("/api", require("./routes/office"));

// Galat /api route par JSON 404 do (React page nahi)
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Ye API route nahi mila" }),
);

// React build serve karo (production)
const dist = path.join(__dirname, "../client/dist");
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  const index = path.join(dist, "index.html");
  if (!fs.existsSync(index)) {
    return res
      .status(404)
      .send(
        "Frontend build nahi mila. Development me client alag chalao (npm run dev), ya client me npm run build karo.",
      );
  }
  res.sendFile(index);
});

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
