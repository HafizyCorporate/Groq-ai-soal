const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(session({
    secret: "ai-soal-rahasia",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static("public"));
app.use("/uploads", express.static(uploadDir));

app.use("/auth", require("./routes/auth"));
app.use("/ai", require("./routes/ai"));
app.use("/export", require("./routes/export"));

app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "views/register.html"));
});

app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.sendFile(path.join(__dirname, "views/dashboard.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
