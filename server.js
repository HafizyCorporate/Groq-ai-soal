const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();

// AUTO CREATE UPLOADS
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: "secret-ai",
  resave: false,
  saveUninitialized: true
}));

// ROUTES
app.use("/auth", require("./routes/auth")); // optional kalau ada
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// PAGES
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "/views/login.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "/views/register.html")));
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "/views/dashboard.html"));
});

app.listen(process.env.PORT || 8080, () => console.log("SERVER RUNNING"));
