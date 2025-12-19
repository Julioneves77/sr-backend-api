// Auth debug enabled: logs tail/len/headerKeys for watched paths. Remove after fixing.
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

// ================== Auth middleware (PROD) ==================
// Auth debug enabled: logs tail/len/headerKeys for watched paths. Remove after fixing.
function isLocalHostHeader(host) {
  if (!host) return false;
  const h = String(host).toLowerCase();
  return h.includes("localhost") || h.includes("127.0.0.1");
}

function shouldWatchPath(path) {
  if (!path) return false;
  if (path === "/api/test") return true;
  if (path === "/api/tickets") return true;
  if (path.startsWith("/api/tickets/")) return true;
  return false;
}

function getApiKeyFromHeaders(req) {
  // Tentar 3 formas de ler o header
  const key1 = req.get("x-api-key");
  const key2 = req.headers["x-api-key"];
  const key3 = req.headers["X-Api-Key"];
  
  // Retornar a primeira não-vazia
  if (key1 && String(key1).trim()) return key1;
  if (key2 && String(key2).trim()) return key2;
  if (key3 && String(key3).trim()) return key3;
  return null;
}

app.use((req, res, next) => {
  const expected = process.env.API_KEY; // setado no Render
  const provided = getApiKeyFromHeaders(req);
  
  console.log("[AUTH DEBUG]", {
    method: req.method,
    path: req.path,
    host: req.headers.host,
    provided: provided,
    expected: expected,
    providedTrim: provided ? String(provided).trim() : null,
    expectedTrim: expected ? String(expected).trim() : null,
    headersKeys: Object.keys(req.headers || {}),
  });
  
  const host = req.headers.host || "";
  const watch = shouldWatchPath(req.path);

  // DEV: se não tem API_KEY, libera tudo
  if (!expected) return next();

  // DEV: se é localhost, libera tudo
  if (isLocalHostHeader(host)) return next();

  // PROD: exige x-api-key igual (normalizado)
  const providedNormalized = provided ? String(provided).trim() : "";
  const expectedNormalized = expected ? String(expected).trim() : "";
  
  // Preparar dados de debug (sempre para paths observados)
  const debugInfo = {
    method: req.method,
    path: req.path,
    host: host,
    providedTail: providedNormalized ? providedNormalized.slice(-6) : "",
    expectedTail: expectedNormalized ? expectedNormalized.slice(-6) : "",
    providedLen: providedNormalized.length,
    expectedLen: expectedNormalized.length,
    hasProvided: !!providedNormalized,
    headerKeys: Object.keys(req.headers).sort(),
    rawProvidedSample: providedNormalized ? providedNormalized.slice(0, 2) : "",
    rawExpectedSample: expectedNormalized ? expectedNormalized.slice(0, 2) : "",
  };
  
  if (!providedNormalized || providedNormalized !== expectedNormalized) {
    if (watch) {
      console.log("[AUTH BLOCK]", debugInfo);
    }
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  if (watch) {
    console.log("[AUTH OK]", debugInfo);
  }

  return next();
});
// ============================================================

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
  if (process.env.API_KEY) {
    const providedKey = req.query.key || "";
    if (String(providedKey).trim() !== String(process.env.API_KEY).trim()) {
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
