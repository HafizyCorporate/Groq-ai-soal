const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

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
app.use("/auth", require("./routes/auth"));
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// PAGES
app.get("/", (req, res) => res.sendFile(__dirname + "/views/login.html"));
app.get("/register", (req, res) => res.sendFile(__dirname + "/views/register.html"));
app.get("/dashboard", (req, res) => {
  if(!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/views/dashboard.html");
});

// Serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(8080, () => console.log("SERVER RUNNING ON 8080"));
