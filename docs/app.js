// docs/app.js
// Toda a lógica roda no navegador — GitHub Pages é 100% estático,
// não existe backend. Os dados vêm de dois JSONs no mesmo repositório:
//   data/beasts.json       -> preços (atualizado a cada 4h pela Action)
//   data/beast-names.json  -> base de nomes pra checar colisão de regex

const state = {
  beasts: [],
  allNames: [],
  sellThreshold: 10,   // bestas com chaosValue >= isso -> balde "vender"
  removeThreshold: 1,  // bestas com chaosValue <= isso -> balde "remover"
  charLimit: 100,
  minSubLen: 4,
};

const els = {};

async function loadData() {
  const [beastsRes, namesRes] = await Promise.all([
    fetch("data/beasts.json", { cache: "no-store" }),
    fetch("data/beast-names.json", { cache: "no-store" }),
  ]);

  if (!beastsRes.ok) throw new Error("Não consegui carregar data/beasts.json");
  if (!namesRes.ok) throw new Error("Não consegui carregar data/beast-names.json");

  const beastsPayload = await beastsRes.json();
  const namesPayload = await namesRes.json();

  state.beasts = beastsPayload.beasts || [];
  state.league = beastsPayload.league;
  state.fetchedAt = beastsPayload.fetchedAt;

  // Base de unicidade = nomes já precificados + a lista-semente curada.
  const fromPricing = state.beasts.map((b) => b.name);
  state.allNames = Array.from(
    new Set([...(namesPayload.names || []), ...fromPricing])
  );
}

// Acha o menor trecho de `target` que não aparece em nenhum outro nome
// (comparação sem diferenciar maiúsculas, já que o jogo parece ignorar caixa).
function findUniqueSubstring(target, allNames, minLen) {
  const targetLower = target.toLowerCase();
  const others = allNames
    .filter((n) => n.toLowerCase() !== targetLower)
    .map((n) => n.toLowerCase());

  const start = Math.max(2, minLen);
  for (let len = start; len <= target.length; len++) {
    for (let s = 0; s + len <= target.length; s++) {
      const sub = target.slice(s, s + len);
      if (sub.trim().length === 0) continue;
      const subLower = sub.toLowerCase();
      if (others.every((n) => !n.includes(subLower))) {
        return sub;
      }
    }
  }
  return target;
}

// Empacota uma lista de {name, sub} em várias strings "a|b|c", cada uma
// respeitando o limite de caracteres. É isso que resolve o problema de
// "faltam bestas porque estourou os 100 caracteres": em vez de cortar,
// a gente continua num "Parte 2", "Parte 3" etc.
function packIntoChunks(entries, limit) {
  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const e of entries) {
    const addLen = current.length === 0 ? e.sub.length : e.sub.length + 1; // +1 do "|"
    if (currentLen + addLen > limit && current.length > 0) {
      chunks.push(current);
      current = [e];
      currentLen = e.sub.length;
    } else {
      current.push(e);
      currentLen += addLen;
    }
  }
  if (current.length) chunks.push(current);

  return chunks.map((c) => ({
    text: c.map((e) => e.sub).join("|"),
    entries: c,
  }));
}

function buildBucket(beasts) {
  // Ordena pra bestas mais caras primeiro dentro do balde (facilita achar
  // as mais importantes na Parte 1 quando for vender, por exemplo)
  const sorted = [...beasts].sort((a, b) => b.chaosValue - a.chaosValue);
  const entries = sorted.map((b) => ({
    ...b,
    sub: findUniqueSubstring(b.name, state.allNames, state.minSubLen),
  }));
  const chunks = packIntoChunks(entries, state.charLimit);
  return { entries, chunks };
}

function fmtChaos(v) {
  return v >= 100 ? Math.round(v).toLocaleString("pt-BR") : v.toFixed(2);
}

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function renderChunks(container, chunks, emptyMsg) {
  container.innerHTML = "";

  if (chunks.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-msg";
    p.textContent = emptyMsg;
    container.appendChild(p);
    return;
  }

  chunks.forEach((chunk, i) => {
    const block = document.createElement("div");
    block.className = "chunk";
    block.innerHTML = `
      <div class="chunk-head">
        <span class="chunk-label">Parte ${i + 1} de ${chunks.length}</span>
        <span class="chunk-count">${chunk.entries.length} bestas · ${chunk.text.length}/${state.charLimit}</span>
      </div>
      <div class="output-row">
        <input type="text" readonly value="${escapeHtml(chunk.text)}" />
        <button class="primary copy-chunk">Copiar</button>
      </div>
    `;
    block
      .querySelector(".copy-chunk")
      .addEventListener("click", async (ev) => {
        await navigator.clipboard.writeText(chunk.text);
        ev.target.textContent = "Copiado!";
        setTimeout(() => (ev.target.textContent = "Copiar"), 1200);
      });
    container.appendChild(block);
  });
}

function renderTable(container, entries) {
  container.innerHTML = "";
  for (const e of entries) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(e.name)}</td>
      <td class="num">${fmtChaos(e.chaosValue)}</td>
      <td><code>${escapeHtml(e.sub)}</code></td>
    `;
    container.appendChild(tr);
  }
}

function render() {
  const sellBeasts = state.beasts.filter(
    (b) => b.chaosValue >= state.sellThreshold
  );
  const removeBeasts = state.beasts.filter(
    (b) => b.chaosValue <= state.removeThreshold
  );

  const sell = buildBucket(sellBeasts);
  const remove = buildBucket(removeBeasts);

  renderChunks(
    els.sellChunks,
    sell.chunks,
    "Nenhuma besta acima desse valor no momento."
  );
  renderChunks(
    els.removeChunks,
    remove.chunks,
    "Nenhuma besta abaixo desse valor no momento."
  );

  renderTable(els.sellTbody, sell.entries);
  renderTable(els.removeTbody, remove.entries);

  els.sellCount.textContent = `${sellBeasts.length} bestas`;
  els.removeCount.textContent = `${removeBeasts.length} bestas`;

  els.meta.textContent = state.league
    ? `Liga: ${state.league} · dados de ${new Date(
        state.fetchedAt
      ).toLocaleString("pt-BR")}`
    : "";
}

function wireUp() {
  els.sellThreshold.addEventListener("input", () => {
    state.sellThreshold = Number(els.sellThreshold.value) || 0;
    render();
  });

  els.removeThreshold.addEventListener("input", () => {
    state.removeThreshold = Number(els.removeThreshold.value) || 0;
    render();
  });

  els.charLimit.addEventListener("input", () => {
    state.charLimit = Number(els.charLimit.value) || 100;
    render();
  });

  els.minSubLen.addEventListener("input", () => {
    state.minSubLen = Number(els.minSubLen.value) || 4;
    render();
  });
}

async function main() {
  els.sellThreshold = document.getElementById("sellThreshold");
  els.removeThreshold = document.getElementById("removeThreshold");
  els.charLimit = document.getElementById("charLimit");
  els.minSubLen = document.getElementById("minSubLen");
  els.sellChunks = document.getElementById("sellChunks");
  els.removeChunks = document.getElementById("removeChunks");
  els.sellTbody = document.getElementById("sellTbody");
  els.removeTbody = document.getElementById("removeTbody");
  els.sellCount = document.getElementById("sellCount");
  els.removeCount = document.getElementById("removeCount");
  els.meta = document.getElementById("meta");
  els.status = document.getElementById("status");

  state.sellThreshold = Number(els.sellThreshold.value);
  state.removeThreshold = Number(els.removeThreshold.value);
  state.charLimit = Number(els.charLimit.value);
  state.minSubLen = Number(els.minSubLen.value);

  try {
    await loadData();
    els.status.remove();
    wireUp();
    render();
  } catch (err) {
    els.status.textContent =
      "Erro ao carregar dados: " +
      err.message +
      " — rode o workflow do GitHub Actions pelo menos uma vez (aba Actions → Update beast prices → Run workflow).";
    els.status.classList.add("error");
  }
}

main();
