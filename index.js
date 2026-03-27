const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// PostgreSQL bağlantısı
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// TEST endpoint (database çalışıyor mu)
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database hatası");
  }
});

// ana route (opsiyonel ama iyi olur)
app.get("/", (req, res) => {
  res.send("Server çalışıyor");
});

// PORT (Render için önemli)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});
