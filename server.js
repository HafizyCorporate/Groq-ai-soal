const express = require("express");
const session = require("express-session");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "secret-ai",
  resave: false,
  saveUninitialized: true
}));

app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

// Simpan user sementara di memory
const users = {};

// Pages
app.get("/", (req, res) => res.sendFile(__dirname + "/views/login.html"));
app.get("/register", (req, res) => res.sendFile(__dirname + "/views/register.html"));
app.get("/dashboard", (req, res) => {
  if(!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/views/dashboard.html");
});

// Register POST
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).send("Username & password wajib diisi");

  if(users[username]) return res.status(400).send("Username sudah ada");

  users[username] = { username, password };
  req.session.user = username; // langsung login
  res.redirect("/dashboard");
});

// Login POST
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if(!users[username] || users[username].password !== password){
    return res.status(400).send("Username atau password salah");
  }
  req.session.user = username;
  res.redirect("/dashboard");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(8080, () => console.log("SERVER RUNNING ON 8080"));
