import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/health", (req, res) => {
    fs.writeFileSync('error_log.txt', JSON.stringify(req.body, null, 2) + '\n', { flag: 'a' });
    res.json({ status: "logged" });
  });

  // Proxy Google Ads API
  app.use("/api/googleads", async (req, res) => {
    try {
      const targetUrl = `https://googleads.googleapis.com${req.url}`;
      
      const headers: any = {};
      if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
      if (req.headers['developer-token']) headers['developer-token'] = req.headers['developer-token'];
      if (req.headers['login-customer-id']) headers['login-customer-id'] = req.headers['login-customer-id'];

      const fetchOptions: any = {
        method: req.method,
        headers: headers,
      };

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, fetchOptions);
      
      const responseText = await response.text();
      
      res.status(response.status);
      res.set('Content-Type', response.headers.get('content-type') || 'application/json');
      res.send(responseText);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Proxy error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
