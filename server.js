const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;
const ARQUIVO_DADOS = path.join(__dirname, "dados.txt");

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/dados") {
    fs.readFile(ARQUIVO_DADOS, "utf8", (err, data) => {
      if (err) {
        console.error("Erro ao ler o arquivo:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Erro ao ler o arquivo de dados." }));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(data);
    });
  } else if (req.method === "POST" && req.url === "/adicionar-caso") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      fs.appendFile(ARQUIVO_DADOS, "\n" + body, "utf8", (err) => {
        if (err) {
          console.error("Erro ao escrever no arquivo:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Erro ao salvar o novo caso." }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Caso adicionado com sucesso!" }));
      });
    });
  } else if (req.method === "GET") {
    let filePath = req.url === "/" ? "/index.html" : req.url;
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);
    const contentType = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(fullPath, (err, content) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ message: `Arquivo não encontrado: ${filePath}` })
        );
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Método ou Rota não suportada." }));
  }
});

server.listen(PORT, () => {
  console.log(`\nServidor rodando!`);
  console.log(`Acesse a aplicação em: http://localhost:${PORT}`);
});
