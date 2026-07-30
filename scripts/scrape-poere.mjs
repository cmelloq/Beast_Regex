// scripts/scrape-poere.mjs
//
// Fonte de dados alternativa: em vez de bater na API da poe.ninja (que
// mudou/quebrou em jun/2026), esse script abre https://poe.re/#/beast
// com um navegador headless (Playwright) e lê a tabela de preços + regex
// já calculado por eles direto do DOM renderizado.
//
// Vantagem extra: o poe.re já resolve a colisão de substring pra cada
// besta que ele cobre, então usamos o regex deles como está — só
// aplicamos nossa lógica de paginação/baldes em cima.
//
// Uso: node scripts/scrape-poere.mjs

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "docs", "data", "beasts.json");
const URL = "https://poe.re/#/beast";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  // Tenta zerar o filtro de valor mínimo pra pegar a lista completa
  // (inclusive bestas baratas, que a gente precisa pro balde de "remover").
  // Isso depende da estrutura atual do site — se quebrar, o script ainda
  // funciona, só que respeitando o filtro padrão deles.
  try {
    const minLabel = page.getByText("Min chaos value", { exact: false });
    const minInput = minLabel.locator("xpath=following::input[1]");
    await minInput.fill("0");
    await page.waitForTimeout(800);
  } catch (err) {
    console.warn("Não consegui zerar 'Min chaos value', seguindo com o padrão do site:", err.message);
  }

  await page.waitForTimeout(1000);

  const rows = await page.evaluate(() => {
    const tables = [...document.querySelectorAll("table")];
    const table = tables.find(
      (t) => t.innerText.includes("Beast name") && t.innerText.includes("Regex")
    );
    if (!table) return [];

    const out = [];
    for (const tr of table.querySelectorAll("tr")) {
      const tds = [...tr.querySelectorAll("td")];
      if (tds.length < 3) continue;
      const name = tds[0]?.innerText.trim();
      const regex = tds[1]?.innerText.trim();
      const chaosText = tds[2]?.innerText.trim().replace(/,/g, "");
      const chaosValue = parseFloat(chaosText);
      if (!name || !regex || Number.isNaN(chaosValue)) continue;
      out.push({ name, regex, chaosValue });
    }
    return out;
  });

  await browser.close();

  if (rows.length === 0) {
    throw new Error(
      "Nenhuma linha extraída da tabela do poe.re — o site provavelmente mudou de estrutura (HTML/classes). Precisa ajustar os seletores em scripts/scrape-poere.mjs."
    );
  }

  const payload = {
    source: "poe.re (scraped)",
    fetchedAt: new Date().toISOString(),
    count: rows.length,
    beasts: rows.sort((a, b) => b.chaosValue - a.chaosValue),
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Gravado ${rows.length} bestas (com regex já calculado) em ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
