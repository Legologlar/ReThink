const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Backend çalışıyor");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server çalışıyor");
});
