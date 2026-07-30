# poe-beast-regex

Site estático (GitHub Pages) que junta preço + regex das bestas e monta
automaticamente as strings pra caixa **Filter Beasts** do Menagerie —
uma lista pra vender (valor acima de X), outra pra descartar (valor até
Y), cada uma já paginada em blocos de até 100 caracteres (nunca perde
besta por estourar o limite).

## De onde vêm os dados

**Fonte atual (padrão): [poe.re](https://poe.re/#/beast)**, via scraping
com Playwright (`scripts/scrape-poere.mjs`). Esse site já calcula um
regex único testado pra cada besta, então usamos o regex dele direto —
só aplicamos nossa lógica de paginação/baldes em cima.

**Fonte alternativa: poe.ninja**, via API (`scripts/fetch-beasts.mjs`).
Fica no repositório como plano B — só traz preço, sem regex pronto
(nesse caso o site calcula o regex sozinho usando
`docs/data/beast-names.json`). A API da poe.ninja mudou de estrutura em
jun/2026 (o endpoint antigo `/api/data/itemoverview` foi descontinuado);
o script já está atualizado pro endpoint novo documentado em
`poe.ninja/docs/api`.

Se um dos dois quebrar no futuro (mudança de página/API), troca qual
script o workflow chama — não precisa reescrever o site.

Já vem com dados de exemplo em `docs/data/beasts.json`, então dá pra
abrir o site direto e ver funcionando antes mesmo de rodar o scraping.

## Como subir isso no GitHub

1. **Crie um repositório novo** no GitHub e suba esses arquivos:
   ```bash
   cd poe-beast-regex
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/poe-beast-regex.git
   git push -u origin main
   ```

2. **Ative o GitHub Pages**:
   - Vá em `Settings → Pages` (do repositório, não da conta)
   - Em "Build and deployment", escolha **Source: GitHub Actions**
     (não "Deploy from a branch" — o workflow já cuida disso)
   - Precisa que o repositório seja **público** (ou plano pago do GitHub
     pra Pages em repo privado)

3. **Rode o workflow pela primeira vez**:
   - Aba `Actions → Update beast prices → Run workflow`
   - Isso instala o Playwright, raspa preço+regex do poe.re, grava em
     `docs/data/beasts.json`, comita e publica o Pages.
   - Depois disso ele roda sozinho a cada 4 horas (cron).

4. Seu site fica em `https://SEU_USUARIO.github.io/poe-beast-regex/`

## Estrutura

```
.github/workflows/update-beasts.yml   # cron: raspa dados + publica Pages
scripts/scrape-poere.mjs              # fonte atual: raspa poe.re c/ Playwright
scripts/fetch-beasts.mjs              # fonte alternativa: API da poe.ninja
docs/                                 # o site em si (servido pelo Pages)
  index.html
  app.js                              # baldes vender/remover + paginação, roda no navegador
  style.css
  data/
    beasts.json                      # preços [+ regex] (gerado pelo Action)
    beast-names.json                 # base de nomes p/ checar unicidade (fallback)
```

## Como funciona o regex de cada besta

1. Se a besta veio com um campo `regex` já preenchido (fonte poe.re),
   usa ele direto.
2. Se não veio (besta que o poe.re ainda não cobre), calcula na unha:
   testa substrings da menor pra maior e pega o primeiro trecho que
   **não aparece em nenhum outro nome** da base (`beast-names.json` +
   os nomes que vieram junto com os preços).
3. Os fragmentos de todas as bestas do balde (vender ou remover) são
   empacotados em blocos de até `charLimit` caracteres, gerando quantas
   "Partes" forem necessárias.

## Limitação importante

`data/beast-names.json` é uma **lista-semente**, não a base completa e
oficial de todas as espécies do jogo. Ela só entra em ação pras bestas
que a fonte principal (poe.re) ainda não cobre. Pode faltar gente.

**Sempre teste a string no jogo antes de confiar 100%.** Se algo errado
acender junto no Menagerie, adicione o nome que faltava em
`beast-names.json` e mande um PR (ou só peça pra eu adicionar).

## Rodando localmente

```bash
npm install playwright
npx playwright install --with-deps chromium
node scripts/scrape-poere.mjs     # gera docs/data/beasts.json com dados reais
npx serve docs                    # ou qualquer server estático
```
