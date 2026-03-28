const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Backend çalışıyor");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server çalışıyor");
});

let points = 0;

app.get("/points", (req, res) => {
  res.json({ points });
});

app.get("/add-points", (req, res) => {
  points += 10;
  res.json({ message: "puan eklendi", points });
});
