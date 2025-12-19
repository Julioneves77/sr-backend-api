const express = require("express");

const app = express();

// ============ Config ============
const isLocalHost = (host) =>
  host === "localhost" || host === "127.0.0.1" || host === "::1";

const API_KEY = process.env.API_KEY || ""; // setado no Render

const PORT = process.env.PORT || 3000;

// Permitir JSON
app.use(express.json({ limit: "256kb" }));

// CORS - Permitir Portal/Plataforma em localhost e Render
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  // Permitir localhost (4000, 4001) e Render
  const allowedOrigins = [
    "http://localhost:4000",
    "http://localhost:4001",
    "http://127.0.0.1:4000",
    "http://127.0.0.1:4001"
  ];
  
  // Se origin está na lista ou é vazio (mesma origem), permitir
  if (!origin || allowedOrigins.includes(origin) || origin.includes("localhost") || origin.includes("127.0.0.1")) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*"); // Fallback para testes
  }
  
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Auth middleware (exige x-api-key quando API_KEY está definido e request não é local)
app.use((req, res, next) => {
  const host = req.headers.host || "";
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";
  const local = isLocalHost(host) || isLocalHost((origin || "").replace(/^https?:\/\//, "").split(":")[0]);

  // Se API_KEY NÃO está setado, não exige (dev)
  if (!API_KEY) return next();

  // Se estiver local (dev), também não exige para facilitar
  if (local || origin.includes("localhost") || referer.includes("localhost")) return next();

  const provided = req.headers["x-api-key"];
  if (!provided || String(provided) !== String(API_KEY)) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }
  next();
});

// ============ In-memory store (test) ============
let TICKETS = [];
let seq = 1;

function pad(n) {
  return String(n).padStart(2, "0");
}
function genCodigo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SR-${y}${m}${day}-${hh}${mm}${ss}-${rnd}`;
}
function safeLog(label, payload) {
  // log mínimo sem dados sensíveis completos
  try {
    const p = payload || {};
    const resumo = {
      tipoServico: p.tipoServico || p.servico || p.service || null,
      origem: p.origem || null,
      hasCpf: !!p.cpf,
      hasEmail: !!p.email,
      hasWhatsApp: !!(p.celularWhatsApp || p.whatsapp || p.telefone),
    };
    console.log(label, resumo);
  } catch {
    console.log(label);
  }
}

// ============ Routes ============
app.get("/", (req, res) => res.status(200).send("sr-backend-api OK"));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "sr-backend-api",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/tickets/:id", (req, res) => {
  const id = Number(req.params.id);
  const found = TICKETS.find((t) => t.id === id);
  if (!found) return res.status(404).json({ success: false, error: "not_found" });
  return res.status(200).json({ success: true, ticket: found });
});

// PATCH /api/tickets/:id - Atualizar ticket (ex: statusPagamento)
app.patch("/api/tickets/:id", (req, res) => {
  const id = Number(req.params.id);
  const foundIndex = TICKETS.findIndex((t) => t.id === id);
  if (foundIndex === -1) {
    return res.status(404).json({ success: false, error: "not_found" });
  }

  const updates = req.body || {};
  const ticket = TICKETS[foundIndex];
  
  // Atualizar campos permitidos
  Object.keys(updates).forEach(key => {
    if (key !== 'id' && key !== 'codigo' && key !== 'createdAt') {
      ticket[key] = updates[key];
    }
  });

  ticket.updatedAt = new Date().toISOString();

  safeLog("[PATCH /api/tickets/:id]", { id, updates: Object.keys(updates) });

  return res.status(200).json({
    success: true,
    ticket: ticket
  });
});

// Endpoint de debug (para teste via navegador com querystring)
// IMPORTANTE: Bloqueado em produção para segurança
app.get("/api/debug/tickets", (req, res) => {
  // Em produção, bloquear completamente
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: "debug_disabled_in_production" });
  }
  
  // Em localhost/dev: permitir apenas se API_KEY estiver configurado E key fornecida
  if (API_KEY) {
    const providedKey = req.query.key || "";
    if (String(providedKey) !== String(API_KEY)) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }
  }
  
  // Verificar se é localhost
  const host = req.headers.host || "";
  const isLocal = isLocalHost(host);
  if (!isLocal) {
    return res.status(403).json({ success: false, error: "debug_only_localhost" });
  }
  
  return res.status(200).json({ success: true, data: TICKETS });
});

// ============ Tickets (base inicial) ============
// POST /api/tickets - Criar novo ticket
app.post("/api/tickets", (req, res) => {
  const payload = req.body || {};
  safeLog("[POST /api/tickets]", payload);

  const ticket = {
    id: seq++,
    codigo: genCodigo(),
    createdAt: new Date().toISOString(),
    ...payload,
  };

  TICKETS.unshift(ticket);

  return res.status(200).json({
    success: true,
    ticket,
  });
});

// GET /api/tickets - Listar todos os tickets
app.get("/api/tickets", (req, res) => {
  return res.status(200).json({
    success: true,
    data: TICKETS,
  });
});
// ============ Fim Tickets (base inicial) ============

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
