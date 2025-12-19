const express = require("express");

const app = express();

/**
 * Rota raiz
 * Usada para teste rápido via navegador
 */
app.get("/", (req, res) => {
  res.status(200).send("sr-backend-api OK");
});

/**
 * Health check
 * Usado por Render, monitoramento e integrações futuras
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "sr-backend-api",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Porta dinâmica (Render) ou fallback local
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
