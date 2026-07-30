# poe-beast-regex

Site estático (GitHub Pages) que puxa os preços das bestas na poe.ninja e
monta automaticamente a string de regex pra caixa **Filter Beasts** do
Menagerie, sempre priorizando as bestas mais valiosas dentro do limite de
caracteres.

Já vem com dados de exemplo em `docs/data/beasts.json`, então dá pra abrir
o site direto e ver funcionando antes mesmo de configurar o Actions.

## Como subir isso no GitHub

1. **Crie um repositório novo** no GitHub e suba esses arquivos:
   ```bash
   cd poe-beast-regex
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin git@github.com:SEU_USUARIO/poe-beast-regex.git
   git push -u origin main
   ```

2. **Ative o GitHub Pages**:
   - Vá em `Settings → Pages`
   - Em "Build and deployment", escolha **Source: GitHub Actions**
     (não "Deploy from a branch" — o workflow já cuida disso)

3. **Configure a liga** (opcional, mas recomendado):
   - `Settings → Secrets and variables → Actions → Variables`
   - Crie uma variável `LEAGUE` com o nome exato da liga atual
     (ex: `Standard`, ou o nome da liga temporária em vigor).
     Se não configurar, cai em `Standard`.

4. **Rode o workflow pela primeira vez**:
   - Aba `Actions → Update beast prices → Run workflow`
   - Isso busca os preços reais, grava em `docs/data/beasts.json`,
     comita e publica o Pages.
   - Depois disso ele roda sozinho a cada 4 horas (cron).

5. Seu site fica em `https://SEU_USUARIO.github.io/poe-beast-regex/`

## Estrutura

```
.github/workflows/update-beasts.yml   # cron: busca preços + publica Pages
scripts/fetch-beasts.mjs              # script Node que chama a API da poe.ninja
docs/                                 # o site em si (servido pelo Pages)
  index.html
  app.js                              # algoritmo de regex, roda no navegador
  style.css
  data/
    beasts.json                      # preços (gerado pelo Action)
    beast-names.json                 # base de nomes p/ checar unicidade
```

## Como funciona o algoritmo de regex

Pra cada besta (da mais valiosa pra menos valiosa):

1. Testa substrings do nome dela, do menor tamanho pro maior.
2. Pega o primeiro trecho que **não aparece em nenhum outro nome** da base
   (`beast-names.json` + os nomes que vieram da poe.ninja).
3. Vai concatenando com `|` até estourar o limite de caracteres — a partir
   daí, ignora as próximas (elas aparecem na tabela marcadas como
   "fora do limite").

## Limitação importante

`data/beast-names.json` é uma **lista-semente**, não a base completa e
oficial de todas as ~600 espécies do jogo (não existe uma API pública com
isso). Ela cobre as bestas que já discutimos + famílias conhecidas, mas
pode faltar gente. Isso significa que um trecho pode, em teoria, colidir
com uma besta que não está na base local.

**Sempre teste a string no jogo antes de confiar 100%.** Se algo errado
acender junto no Menagerie, adicione o nome que faltava em
`beast-names.json` e mande um PR (ou só peça pra eu adicionar) — a base
só fica melhor com uso.

## Rodando localmente

```bash
node scripts/fetch-beasts.mjs Standard   # gera docs/data/beasts.json real
npx serve docs                           # ou qualquer server estático
```
