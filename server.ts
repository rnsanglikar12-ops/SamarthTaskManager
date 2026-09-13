import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Increase payload limit for Base64 before/after images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side persistent storage setup
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "actions_store.json");

let memoryActions: any[] = [];
let serverVersion = 1;
let lastModified = new Date().toISOString();

// Initialize directory and load existing persisted actions if available
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryActions = parsed;
      serverVersion = Date.now();
      lastModified = new Date().toISOString();
      console.log(`[Server] Loaded ${memoryActions.length} persisted actions from disk.`);
    }
  }
} catch (err) {
  console.error("[Server] Error initializing storage:", err);
}

function persistActionsToDisk() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryActions), "utf-8");
  } catch (err) {
    console.error("[Server] Failed to write actions to disk:", err);
  }
}

// API Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Lightweight version check for polling across different links/clients
app.get("/api/actions/version", (_req, res) => {
  res.json({
    version: serverVersion,
    lastModified,
    count: memoryActions.length
  });
});

// Fetch all actions
app.get("/api/actions", (_req, res) => {
  res.json({
    actions: memoryActions,
    version: serverVersion,
    lastModified,
    count: memoryActions.length
  });
});

// Save or replace actions (full matrix sync)
app.post("/api/actions", (req, res) => {
  const { actions } = req.body;
  if (!Array.isArray(actions)) {
    res.status(400).json({ error: "actions must be an array" });
    return;
  }

  memoryActions = actions;
  serverVersion = Date.now();
  lastModified = new Date().toISOString();
  persistActionsToDisk();

  res.json({
    success: true,
    version: serverVersion,
    lastModified,
    count: memoryActions.length
  });
});

// Update single action (atomic update from any link/user)
app.post("/api/actions/update-single", (req, res) => {
  const { action } = req.body;
  if (!action || typeof action.id !== "number") {
    res.status(400).json({ error: "Invalid action payload" });
    return;
  }

  const existingIdx = memoryActions.findIndex(a => a.id === action.id);
  if (existingIdx >= 0) {
    memoryActions[existingIdx] = action;
  } else {
    // Add new action at top
    memoryActions.unshift(action);
  }

  serverVersion = Date.now();
  lastModified = new Date().toISOString();
  persistActionsToDisk();

  res.json({
    success: true,
    version: serverVersion,
    lastModified
  });
});

// Delete single action (atomic deletion by Plant Head)
app.post("/api/actions/delete-single", (req, res) => {
  const { id } = req.body;
  if (typeof id !== "number") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  memoryActions = memoryActions.filter(a => a.id !== id);
  serverVersion = Date.now();
  lastModified = new Date().toISOString();
  persistActionsToDisk();

  res.json({
    success: true,
    version: serverVersion,
    lastModified
  });
});

// Vite middleware & Static serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Samarth Industries Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
