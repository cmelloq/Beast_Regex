// scripts/fetch-beasts.mjs
//
// Puxa os preços atuais das bestas na poe.ninja e grava um JSON estático
// em docs/data/beasts.json, que o site (GitHub Pages) consome no client.
//
// ATUALIZADO (jul/2026): a poe.ninja trocou toda a API em jun/2026.
// Endpoint antigo (/api/data/itemoverview) não existe mais -> 404.
// Novo endpoint documentado em https://poe.ninja/docs/api :
//   GET /poe1/api/economy/stash/current/item/overview?league={league}&type=Beast
//
// Por que buscar aqui e não direto no navegador do usuário?
// A poe.ninja não libera CORS para qualquer origem fazer fetch() direto
// do browser. Rodando esse script no GitHub Actions (server-to-server)
// não existe essa restrição, e o resultado vira um arquivo estático
// versionado no próprio repositório.
//
// Uso: node scripts/fetch-beasts.mjs [league]
// Se a league não for passada, tenta usar a variável de ambiente LEAGUE,
// e por fim cai para a liga temporária atual (primeira da lista de leagues).

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "docs", "data", "beasts.json");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; poe-beast-regex-bot/1.0; +https://github.com/)",
  Accept: "application/json",
};

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`${url} respondeu ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function resolveLeague(requested) {
  const leagues = await getJson("https://poe.ninja/poe1/api/economy/leagues");
  if (!Array.isArray(leagues) || leagues.length === 0) {
    throw new Error("poe.ninja não retornou nenhuma liga em /poe1/api/economy/leagues");
  }

  if (requested) {
    const match = leagues.find(
      (l) => l.id === requested || l.name === requested
    );
    if (match) return match.id;
    console.warn(
      `Liga "${requested}" não encontrada na lista da poe.ninja. Ligas disponíveis: ${leagues
        .map((l) => l.id)
        .join(", ")}. Usando a liga temporária atual como fallback.`
    );
  }

  // primeira entrada = liga temporária desafio atual, por documentação da API
  return leagues[0].id;
}

async function main() {
  const requested = process.argv[2] || process.env.LEAGUE || null;
  const league = await resolveLeague(requested);

  const url = `https://poe.ninja/poe1/api/economy/stash/current/item/overview?league=${encodeURIComponent(
    league
  )}&type=Beast`;

  console.log(`Buscando bestas em: ${url}`);
  const json = await getJson(url);
  const lines = Array.isArray(json.lines) ? json.lines : [];

  const beasts = lines
    .map((l) => ({
      name: l.name,
      chaosValue: l.chaosValue ?? 0,
      listingCount: l.listingCount ?? 0,
      sparkline: l.sparkLine?.data ?? [],
      totalChangePct: l.sparkLine?.totalChange ?? null,
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
