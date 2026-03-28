const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// test
app.get("/", (req, res) => {
  res.send("Backend çalışıyor");
});

// puan getir
app.get("/points", async (req, res) => {
  const result = await pool.query("SELECT points FROM users WHERE id = 1");
  res.json(result.rows[0]);
});

// puan ekle
app.get("/add-points", async (req, res) => {
  await pool.query("UPDATE users SET points = points + 10 WHERE id = 1");
  res.send("puan eklendi");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server çalışıyor");
});
