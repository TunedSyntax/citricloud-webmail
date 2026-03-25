import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import mailRoutes from "./routes/mail-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePublicDir() {
  const candidates = [
    path.resolve(__dirname, "../public"),
    path.resolve(__dirname, "../../web/dist")
  ];

  return candidates.find((candidate) => existsSync(path.join(candidate, "index.html"))) ?? candidates[0];
}

const publicDir = resolvePublicDir();

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use("/api", mailRoutes);

app.use(express.static(publicDir));
app.get("/", (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});
app.get("/{*path}", (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`CitriCloud webmail proxy running on port ${port}`);
});