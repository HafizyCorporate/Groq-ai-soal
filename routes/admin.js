const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') next();
    else res.status(403).send("Hanya Admin yang boleh masuk!");
};

router.get("/dashboard", isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "../views/admin.html"));
});

router.get("/users", isAdmin, (req, res) => {
    db.all("SELECT id, username, role FROM users", [], (err, rows) => res.json(rows));
});

router.post("/update-role", isAdmin, (req, res) => {
    db.run("UPDATE users SET role = ? WHERE id = ?", [req.body.role, req.body.id], () => res.json({ success: true }));
});

module.exports = router;

