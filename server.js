const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Session
app.use(session({
  secret: "secret-ai",
  resave: false,
  saveUninitialized: true
}));

// ✅ Tambahkan route auth
app.use("/auth", require("./routes/auth"));

// Routes AI dan export
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// Pages
app.get("/", (req, res) => res.sendFile(__dirname + "/views/login.html"));
app.get("/register", (req, res) => res.sendFile(__dirname + "/views/register.html"));
app.get("/dashboard", (req, res) => {
  if(!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/views/dashboard.html");
});

// Serve uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(8080, () => console.log("SERVER RUNNING ON 8080"));
