const express = require("express");

const app = express();

/**
 * Middleware para ler JSON
 */
app.use(express.json());

/**
 * Rota raiz – teste rápido
 */
app.get("/", (req, res) => {
  res.status(200).send("sr-backend-api OK");
});

/**
 * Health check – usado por Render, monitoramento e integrações
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
 * Endpoint de teste (POST)
 * Base para integrações futuras
 */
app.post("/api/test", (req, res) => {
  res.status(200).json({
    received: true,
    data: req.body
  });
});

/**
 * Porta dinâmica (Render) ou local
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
