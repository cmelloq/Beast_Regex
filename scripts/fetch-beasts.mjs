// scripts/fetch-beasts.mjs
//
// Puxa os preços atuais das bestas na poe.ninja e grava um JSON estático
// em docs/data/beasts.json, que o site (GitHub Pages) consome no client.
//
// Por que buscar aqui e não direto no navegador do usuário?
// A poe.ninja não libera CORS para qualquer origem fazer fetch() direto
// do browser. Rodando esse script no GitHub Actions (server-to-server)
// não existe essa restrição, e o resultado vira um arquivo estático
// versionado no próprio repositório.
//
// Uso: node scripts/fetch-beasts.mjs [league]
// Se a league não for passada, tenta usar a variável de ambiente LEAGUE,
// e por fim cai para "Standard".

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "docs", "data", "beasts.json");

const league = process.argv[2] || process.env.LEAGUE || "Standard";

async function main() {
  const url = `https://poe.ninja/api/data/itemoverview?league=${encodeURIComponent(
    league
  )}&type=Beast`;

  console.log(`Buscando bestas em: ${url}`);
  const res = await fetch(url, {
    headers: {
      // poe.ninja é chato com clientes sem user-agent "de navegador"
      "User-Agent":
        "Mozilla/5.0 (compatible; poe-beast-regex-bot/1.0; +https://github.com/)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`poe.ninja respondeu ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const lines = Array.isArray(json.lines) ? json.lines : [];

  // Reduzimos para só o que a UI precisa, e ordenamos por valor decrescente.
  const beasts = lines
    .map((l) => ({
      name: l.name,
      chaosValue: l.chaosValue ?? 0,
      listingCount: l.listingCount ?? 0,
      sparkline: l.sparkline?.data ?? [],
      totalChangePct: l.sparkline?.totalChange ?? null,
      baseType: l.baseType ?? null,
      detailsId: l.detailsId ?? null,
    }))
    .sort((a, b) => b.chaosValue - a.chaosValue);

  const payload = {
    league,
    fetchedAt: new Date().toISOString(),
    count: beasts.length,
    beasts,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Gravado ${beasts.length} bestas em ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
