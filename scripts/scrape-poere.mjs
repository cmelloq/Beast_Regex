// scripts/scrape-poere.mjs
//
// Fonte de dados alternativa: em vez de bater na API da poe.ninja (que
// mudou/quebrou em jun/2026), esse script abre https://poe.re/#/beast
// com um navegador headless (Playwright) e lê a tabela de preços + regex
// já calculado por eles direto do DOM renderizado.
//
// Uso: node scripts/scrape-poere.mjs

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "docs", "data", "beasts.json");
const DEBUG_HTML_PATH = path.join(__dirname, "..", "debug-poere.html");
const URL = "https://poe.re/#/beast";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (msg) => console.log("[browser]", msg.text()));
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  console.log(`Abrindo ${URL} ...`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Espera até 20s pela tabela aparecer de verdade (dados carregados via JS)
  try {
    await page.waitForFunction(
      () => document.body.innerText.includes("Beast name") &&
            document.body.innerText.includes("Regex"),
      { timeout: 20000 }
    );
    console.log("Tabela detectada no texto da pagina.");
  } catch (err) {
    console.log("AVISO: nao encontrei 'Beast name'/'Regex' no texto da pagina apos 20s.");
  }

  // Tenta zerar o filtro de valor mínimo pra pegar a lista completa.
  try {
    const minLabel = page.getByText("Min chaos value", { exact: false });
    const minInput = minLabel.locator("xpath=following::input[1]");
    await minInput.fill("0", { timeout: 5000 });
    await page.waitForTimeout(800);
    console.log("Campo 'Min chaos value' zerado.");
  } catch (err) {
    console.log("AVISO: nao consegui zerar 'Min chaos value':", err.message);
  }

  await page.waitForTimeout(1500);

  const diagnostics = await page.evaluate(() => {
    return {
      title: document.title,
      bodyLength: document.body.innerText.length,
      bodyPreview: document.body.innerText.slice(0, 1500),
      beastRowCount: document.querySelectorAll(".beast-row").length,
      hasBeastNameText: document.body.innerText.includes("Beast name"),
    };
  });
  console.log("Diagnostico da pagina:", JSON.stringify(diagnostics, null, 2));

  const rows = await page.evaluate(() => {
    const out = [];
    for (const row of document.querySelectorAll(".beast-row")) {
      const nameEl = row.querySelector(".beast-name-cell");
      const regexEl = row.querySelector(".beast-regex-cell");
      const valueEl = row.querySelector(".beast-value-cell");
      if (!nameEl || !regexEl || !valueEl) continue;

      const name = nameEl.innerText.trim();
      const regex = regexEl.innerText.trim();
      const chaosText = valueEl.innerText.trim().replace(/,/g, "");
      const chaosValue = parseFloat(chaosText);

      // pula a linha de cabeçalho ("Beast name" / "Regex" / "Chaos")
      if (name === "Beast name" || !name || !regex) continue;
      if (Number.isNaN(chaosValue)) continue;

      out.push({ name, regex, chaosValue });
    }
    return out;
  });

  if (rows.length === 0) {
    // Salva o HTML completo da página pra inspeção manual/futura no log do CI
    const html = await page.content();
    await writeFile(DEBUG_HTML_PATH, html, "utf-8");
    console.log(`HTML completo da pagina salvo em ${DEBUG_HTML_PATH} (${html.length} chars) para debug.`);
    await browser.close();
    throw new Error(
      "Nenhuma linha extraída da tabela do poe.re. Veja o diagnóstico acima e o HTML salvo em debug-poere.html (sobe como artifact se configurado)."
    );
  }

  await browser.close();

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
