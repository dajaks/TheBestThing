// ========================
// SERVER SETUP
// ========================
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;


// ========================
// MIDDLEWARE
// ========================
app.use(cors());                        // allow cross-origin (frontend <-> backend)
app.use(express.json());                // parse JSON request bodies
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(__dirname));     // serve static files (index.html, etc.)


// ========================
// FILE UPLOADS
// ========================
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Serve uploaded images as /uploads/<filename>
app.use("/uploads", express.static(UPLOADS_DIR));


// ========================
// DATABASE SETUP
// ========================
const db = new sqlite3.Database(path.join(__dirname, "things.db"));

db.serialize(() => {
  // Things table
  db.run(`
    CREATE TABLE IF NOT EXISTS things (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      image TEXT,  -- store filename
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Unique index for normalized titles
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_title_norm
    ON things(
      LOWER(
        TRIM(
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(title,'  ',' '),'  ',' '),'  ',' '),'  ',' '),'  ',' ')
        )
      )
    )
  `);

  // Votes table
  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      winner_id INTEGER NOT NULL,
      loser_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (winner_id) REFERENCES things(id),
      FOREIGN KEY (loser_id) REFERENCES things(id)
    )
  `);
});


// ========================
// ROUTES
// ========================

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});


// ---------- SUBMIT A THING ----------
app.post("/submit", upload.single("thing-image"), (req, res) => {
  const rawTitle   = req.body["thing-title"]?.trim();
  const description = (req.body["thing-description"] || "").trim();
  const image       = req.file ? req.file.filename : null;

  if (!rawTitle || !description || !image) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Normalize for duplicate check
  const checkTitle = rawTitle.replace(/\s+/g, " ").toLowerCase();

  const sqlCheck = `
    SELECT id FROM things
    WHERE LOWER(
      TRIM(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(title,'  ',' '),'  ',' '),'  ',' '),'  ',' '),'  ',' ')
      )
    ) = ?
  `;

  db.get(sqlCheck, [checkTitle], (err, row) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (row) return res.status(400).json({ error: "This thing has already been submitted." });

    // Insert into DB
    const sqlInsert = `INSERT INTO things (title, description, image) VALUES (?, ?, ?)`;
    db.run(sqlInsert, [rawTitle, description, image], function (err) {
      if (err) {
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(400).json({ error: "This thing has already been submitted." });
        }
        return res.status(500).json({ error: "Database error." });
      }

      res.json({
        id: this.lastID,
        title: rawTitle,
        description,
        imageUrl: `/uploads/${image}`,
        message: "Thing saved successfully!",
      });
    });
  });
});


// ---------- RANDOM THINGS ----------
app.get("/random-things", (req, res) => {
  const sql = `SELECT id, title, description, image FROM things ORDER BY RANDOM() LIMIT 2`;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error." });

    const formatted = rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      imageUrl: r.image ? `/uploads/${r.image}` : null,
    }));

    res.json(formatted);
  });
});


// ---------- RANDOM OPPONENT (winner stays) ----------
app.get("/random-opponent/:winnerId/:loserId", (req, res) => {
  const { winnerId, loserId } = req.params;

  const sql = `
    SELECT id, title, description, image
    FROM things
    WHERE id != ? AND id != ?
    ORDER BY RANDOM()
    LIMIT 1
  `;

  db.get(sql, [winnerId, loserId], (err, row) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!row) return res.json(null);

    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.image ? `/uploads/${row.image}` : null,
    });
  });
});


// ---------- ALL THINGS (debugging) ----------
app.get("/things", (req, res) => {
  const sql = `SELECT id, title, description, image, created_at FROM things ORDER BY id DESC`;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error." });

    res.json(rows.map(r => ({
      ...r,
      imageUrl: r.image ? `/uploads/${r.image}` : null,
    })));
  });
});


// ---------- VOTE ----------
app.post("/vote", (req, res) => {
  const { winnerId, loserId } = req.body;
  if (!winnerId || !loserId) {
    return res.status(400).json({ error: "winnerId and loserId are required." });
  }

  const sql = `INSERT INTO votes (winner_id, loser_id) VALUES (?, ?)`;
  db.run(sql, [winnerId, loserId], function (err) {
    if (err) return res.status(500).json({ error: "Database error." });
    res.json({ success: true });
  });
});


// ---------- STATS ----------
app.get("/stats/:id", (req, res) => {
  const thingId = req.params.id;

  const sql = `
    SELECT
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN winner_id = ? OR loser_id = ? THEN 1 ELSE 0 END) as total
    FROM votes
  `;

  db.get(sql, [thingId, thingId, thingId], (err, row) => {
    if (err) return res.status(500).json({ error: "Database error." });

    const wins = row.wins || 0;
    const total = row.total || 0;
    const percent = total > 0 ? Math.round((wins / total) * 100) : 0;

    res.json({ wins, total, percent });
  });
});


// ---------- DEV ONLY: WIPE ALL ----------
app.get("/wipe", (req, res) => {
  db.run("DELETE FROM things", (err) => {
    if (err) return res.status(500).json({ error: "Failed to wipe things." });
    res.json({ message: "All submissions deleted." });
  });
});


// ========================
// START SERVER
// ========================
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
