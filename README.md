# AEO Compass

AEO Compass is a Claude Code skill for Answer Engine Optimization (AEO/GEO): it helps websites, apps and software get found, read and cited by ChatGPT, Perplexity, Gemini, Copilot, Claude and Google AI Overviews.

[English](#english) · [Español](#espanol) · [Português](#portugues)

---

<a id="english"></a>

## English

### What AEO is and why it matters

AEO (also called GEO, or "SEO for AI") is the work of making a site easy for AI assistants to find, read, understand and cite. The basics:

- **The index decides who gets cited.** ChatGPT search draws on Bing (plus its own crawler, OAI-SearchBot), and Copilot runs on Bing. A site Google knows but Bing doesn't can be missing from ChatGPT search and Copilot answers.
- **Most AI bots don't run JavaScript.** If the content only appears after JS runs (a pure SPA), the bot sees an empty page. Server-rendered or prerendered HTML is the baseline.
- **Entity consistency.** The same name, description, address, phone and profile links on the site, in the schema (`sameAs`), on Google Business Profile, Bing Places and social profiles help the model recognize who you are.
- **Backlinks and mentions.** Sites that other sources link to and talk about, with named authors and sourced data, are more likely to be cited.

### What the skill does

It works in four modes, which can be chained (build → index, audit → fix → index):

1. **Build:** new sites and apps, optimized from the start: server-rendered HTML, `robots.txt` for AI bots, sitemap, per-page meta tags, JSON-LD and `llms.txt`, placed correctly for the detected stack.
2. **Audit and fix:** scores the site (technical score up to 75, plus up to 25 for indexing and off-page), lists the 5 highest-impact fixes and makes the code changes once you approve. Off-page items come as a checklist for you.
3. **Automate indexing:** IndexNow (Bing, Yandex, Seznam, Naver, Yep and others) and the Bing Webmaster URL Submission API.
4. **Write citable content:** FAQ and article pages built around real customer questions, with a 40–60 word direct answer under each question, a date, an author and matching FAQPage schema.

### Install

The scripts need Node.js 18 or later (no `npm install`; Node built-ins only). Without Node, the skill falls back to `curl` and manual checklists.

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/jasonmello/aeo-compass.git ~/.claude/skills/aeo-compass
```

To update later: `git -C ~/.claude/skills/aeo-compass pull`. Downloaded the ZIP instead? Unzip it and move the folder (e.g. `aeo-compass-main`) to `~/.claude/skills/aeo-compass`. Restart Claude Code so it picks up the skill.

To use it in a single project only, put it in `.claude/skills/aeo-compass` inside that project.

### Usage

Ask in plain language, or call `/aeo-compass` directly:

- "Audit https://mysite.com for AI search"
- "Why doesn't my site show up in ChatGPT?"
- "Build a landing page for my bakery that AI assistants can cite"
- "I just published three new pages, index them on Bing"
- "Write an FAQ page from the questions my customers ask"
- `/aeo-compass audit ./dist`

On first use in a project the skill runs a short onboarding and saves the answers to `aeo/profile.json` and `aeo/questions.md`. Audit reports go to `aeo/reports/YYYY-MM-DD.md`. It replies in your language and writes site content in the site's language.

### Scripts

All in `scripts/`. Run them from the root of your project, pointing at the skill folder, e.g. `node ~/.claude/skills/aeo-compass/scripts/audit.mjs https://example.com`. Claude runs them for you in the modes described above.

| Script | What it does |
|---|---|
| `detect-stack.mjs [folder] [--json]` | Detects the framework and says where the `<head>`, public folder and build output are. |
| `audit.mjs <url-or-folder> [--pages 10] [--json]` | Technical audit (0–75): crawlability, readability without JS, entity, citable content. |
| `generate-schema.mjs [--profile aeo/profile.json] [--html] [--out file [--force]]` | Generates the global JSON-LD (Organization/LocalBusiness, WebSite, app) from the profile. |
| `generate-llms-txt.mjs (--sitemap <url-or-file> \| --dir <buildOut> --site https://domain.com) [--out file] [--max 100]` | Generates `llms.txt` from the sitemap or a folder of HTML. |
| `indexnow.mjs --site https://domain.com [--public <folder>] [--sitemap <file>] [--urls a,b] [--changed-since YYYY-MM-DD] [--send]` | Creates the IndexNow key and key file, lists URLs, submits only with `--send`. |
| `bing-submit.mjs --site https://domain.com --urls a,b [--send] \| --quota` | Bing Webmaster URL Submission API; the key comes from `BING_API_KEY`. |
| `lib.mjs` | Shared helpers (argument parsing, fetch, sitemap and HTML parsing). |

### Safety

- Dry run by default. `indexnow.mjs` and `bing-submit.mjs` send nothing without `--send`, and the skill asks for your confirmation before any external submission. A dry run of `indexnow.mjs` still creates the key (`aeo/indexnow.json`) and the key file in your public folder.
- API keys are read only from the environment. Set the Bing key in your own terminal with `read -rs BING_API_KEY && export BING_API_KEY`; it is never passed on the command line, pasted in chat or written to a file.
- The skill asks before editing an existing project and never invents profile data, ratings, prices or awards.
- Anything in `aeo/profile.json` can end up in the site's public code (JSON-LD, `llms.txt`).

### Limits

- No one can guarantee rankings or citations. The skill raises the odds; it does not control what an AI assistant chooses to quote.
- Facts about bots, indexes and platforms were last checked in November 2026. They change quickly, so the skill tells Claude to re-check on the web any fact verified more than 3 months earlier.
- Off-page work (Bing Places, Google Business Profile, backlinks, reviews) is done by you in your own accounts. The skill hands you the checklist.

### Tests

```bash
node tests/run.mjs
```

### Contributing

Issues and pull requests are welcome. Keep the scripts dependency-free (Node 18+ built-ins only), keep dry run as the default for anything that talks to an external service, and update the matching file in `references/` when a fact changes, with the date you checked it.

### License

Apache 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

---

<a id="espanol"></a>

## Español

### Qué es AEO y por qué importa

AEO (también GEO, o "SEO para IA") es el trabajo de lograr que los asistentes de IA encuentren, lean, entiendan y citen un sitio. Lo esencial:

- **El índice decide a quién se cita.** La búsqueda de ChatGPT se apoya en Bing (además de su propio rastreador, OAI-SearchBot) y Copilot funciona sobre Bing. Un sitio que Google conoce, pero Bing no, puede quedar fuera de las respuestas de la búsqueda de ChatGPT y de Copilot.
- **La mayoría de los bots de IA no ejecutan JavaScript.** Si el contenido solo aparece después de ejecutar JS (una SPA pura), el bot ve una página vacía. El HTML renderizado en el servidor o prerenderizado es el punto de partida.
- **Consistencia de la entidad.** El mismo nombre, descripción, dirección, teléfono y enlaces a perfiles en el sitio, en el schema (`sameAs`), en Google Business Profile, Bing Places y redes sociales ayudan al modelo a reconocer quién eres.
- **Backlinks y menciones.** Los sitios que otras fuentes enlazan y mencionan, con autor identificado y datos con fuente, tienen más probabilidades de ser citados.

### Qué hace la skill

Trabaja en cuatro modos, que se pueden encadenar (crear → indexar, auditar → corregir → indexar):

1. **Crear:** sitios y apps nuevos, optimizados desde el inicio: HTML renderizado en el servidor, `robots.txt` para bots de IA, sitemap, meta etiquetas por página, JSON-LD y `llms.txt`, en el lugar correcto según el stack detectado.
2. **Auditar y corregir:** califica el sitio (puntaje técnico de hasta 75, más hasta 25 por indexación y off-page), lista las 5 correcciones de mayor impacto y aplica las del código cuando lo apruebas; lo off-page te lo entrega como lista de pasos.
3. **Automatizar la indexación:** IndexNow (Bing, Yandex, Seznam, Naver, Yep y otros) y la API de envío de URLs de Bing Webmaster.
4. **Escribir contenido citable:** páginas de preguntas frecuentes y artículos basados en preguntas reales de clientes, con una respuesta directa de 40–60 palabras debajo de cada pregunta, fecha, autor y schema FAQPage correspondiente.

### Instalación

Los scripts requieren Node.js 18 o superior (sin `npm install`; solo módulos nativos de Node). Sin Node, la skill recurre a `curl` y a listas de verificación manuales.

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/jasonmello/aeo-compass.git ~/.claude/skills/aeo-compass
```

Para actualizar: `git -C ~/.claude/skills/aeo-compass pull`. ¿Descargaste el ZIP? Descomprímelo y mueve la carpeta (p. ej. `aeo-compass-main`) a `~/.claude/skills/aeo-compass`. Reinicia Claude Code para que cargue la skill.

Para usarla en un solo proyecto, colócala en `.claude/skills/aeo-compass` dentro de ese proyecto.

### Uso

Pide en lenguaje natural o llama a `/aeo-compass` directamente:

- "Audita https://misitio.com para búsqueda con IA"
- "¿Por qué mi sitio no aparece en ChatGPT?"
- "Crea una landing page para mi panadería que la IA pueda citar"
- "Acabo de publicar tres páginas nuevas, indéxalas en Bing"
- "Escribe una página de preguntas frecuentes con lo que preguntan mis clientes"
- `/aeo-compass auditar ./dist`

La primera vez en un proyecto, la skill hace un onboarding breve y guarda las respuestas en `aeo/profile.json` y `aeo/questions.md`. Los informes de auditoría van a `aeo/reports/YYYY-MM-DD.md`. Responde en tu idioma y escribe el contenido del sitio en el idioma del sitio.

### Scripts

Todos en `scripts/`. Se ejecutan desde la raíz de tu proyecto apuntando a la carpeta de la skill, por ejemplo `node ~/.claude/skills/aeo-compass/scripts/audit.mjs https://example.com`. Claude los ejecuta por ti en los modos de arriba.

| Script | Qué hace |
|---|---|
| `detect-stack.mjs [folder] [--json]` | Detecta el framework e indica dónde están el `<head>`, la carpeta pública y la salida del build. |
| `audit.mjs <url-or-folder> [--pages 10] [--json]` | Auditoría técnica (0–75): rastreo, lectura sin JS, entidad, contenido citable. |
| `generate-schema.mjs [--profile aeo/profile.json] [--html] [--out file [--force]]` | Genera el JSON-LD global (Organization/LocalBusiness, WebSite, app) a partir del perfil. |
| `generate-llms-txt.mjs (--sitemap <url-or-file> \| --dir <buildOut> --site https://domain.com) [--out file] [--max 100]` | Genera `llms.txt` desde el sitemap o una carpeta de HTML. |
| `indexnow.mjs --site https://domain.com [--public <folder>] [--sitemap <file>] [--urls a,b] [--changed-since YYYY-MM-DD] [--send]` | Crea la clave y el archivo de clave de IndexNow, lista las URLs y envía solo con `--send`. |
| `bing-submit.mjs --site https://domain.com --urls a,b [--send] \| --quota` | API de envío de URLs de Bing Webmaster; la clave viene de `BING_API_KEY`. |
| `lib.mjs` | Utilidades compartidas (argumentos, fetch, lectura de sitemap y HTML). |

### Seguridad

- Simulación (dry run) por defecto. `indexnow.mjs` y `bing-submit.mjs` no envían nada sin `--send`, y la skill pide tu confirmación antes de cualquier envío externo. Aun en simulación, `indexnow.mjs` crea la clave (`aeo/indexnow.json`) y el archivo de clave en tu carpeta pública.
- Las claves de API se leen solo del entorno. Define la clave de Bing en tu propia terminal con `read -rs BING_API_KEY && export BING_API_KEY`; nunca va en la línea de comandos, en el chat ni en un archivo.
- La skill pregunta antes de editar un proyecto existente y nunca inventa datos del perfil, calificaciones, precios ni premios.
- Todo lo que pongas en `aeo/profile.json` puede terminar en el código público del sitio (JSON-LD, `llms.txt`).

### Límites

- Nadie puede garantizar posiciones ni citas. La skill aumenta las probabilidades; no controla lo que un asistente de IA decide citar.
- Los datos sobre bots, índices y plataformas se verificaron en noviembre de 2026. Cambian rápido, así que la skill le indica a Claude que vuelva a confirmar en la web todo dato verificado hace más de 3 meses.
- El trabajo off-page (Bing Places, Google Business Profile, backlinks, reseñas) lo haces tú en tus propias cuentas. La skill te entrega la lista de pasos.

### Pruebas

```bash
node tests/run.mjs
```

### Cómo contribuir

Los issues y pull requests son bienvenidos. Mantén los scripts sin dependencias (solo módulos nativos de Node 18+), deja el dry run como comportamiento por defecto en todo lo que hable con un servicio externo y actualiza el archivo correspondiente en `references/` cuando cambie un dato, con la fecha en que lo verificaste.

### Licencia

Apache 2.0. Consulta [LICENSE](LICENSE) y [NOTICE](NOTICE).

---

<a id="portugues"></a>

## Português do Brasil

### O que é AEO e por que importa

AEO (também GEO, ou "SEO para IA") é o trabalho de fazer os assistentes de IA encontrarem, lerem, entenderem e citarem um site. O essencial:

- **O índice decide quem é citado.** A busca do ChatGPT se apoia no Bing (além do próprio rastreador, OAI-SearchBot), e o Copilot roda sobre o Bing. Um site que o Google conhece, mas o Bing não, pode ficar fora das respostas da busca do ChatGPT e do Copilot.
- **A maioria dos bots de IA não executa JavaScript.** Se o conteúdo só aparece depois do JS (uma SPA pura), o bot vê uma página vazia. HTML renderizado no servidor ou pré-renderizado é o ponto de partida.
- **Consistência da entidade.** O mesmo nome, descrição, endereço, telefone e links de perfis no site, no schema (`sameAs`), no Google Business Profile, no Bing Places e nas redes sociais ajudam o modelo a reconhecer quem você é.
- **Backlinks e menções.** Sites que outras fontes linkam e mencionam, com autor identificado e dados com fonte, têm mais chance de ser citados.

### O que a skill faz

Funciona em quatro modos, que podem ser encadeados (construir → indexar, auditar → corrigir → indexar):

1. **Construir:** sites e apps novos, otimizados desde o início: HTML renderizado no servidor, `robots.txt` para bots de IA, sitemap, meta tags por página, JSON-LD e `llms.txt`, no lugar certo para o stack detectado.
2. **Auditar e corrigir:** avalia o site (nota técnica de até 75, mais até 25 de indexação e off-page), lista as 5 correções de maior impacto e aplica as de código depois da sua aprovação; o off-page vem como checklist para você.
3. **Automatizar a indexação:** IndexNow (Bing, Yandex, Seznam, Naver, Yep e outros) e a API de envio de URLs do Bing Webmaster.
4. **Escrever conteúdo citável:** páginas de perguntas frequentes e artigos baseados em perguntas reais de clientes, com resposta direta de 40–60 palavras logo abaixo de cada pergunta, data, autor e schema FAQPage correspondente.

### Instalação

Os scripts precisam de Node.js 18 ou superior (sem `npm install`; só módulos nativos do Node). Sem Node, a skill usa `curl` e checklists manuais.

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/jasonmello/aeo-compass.git ~/.claude/skills/aeo-compass
```

Para atualizar: `git -C ~/.claude/skills/aeo-compass pull`. Baixou o ZIP? Descompacte e mova a pasta (ex.: `aeo-compass-main`) para `~/.claude/skills/aeo-compass`. Reinicie o Claude Code para ele carregar a skill.

Para usar em um só projeto, coloque em `.claude/skills/aeo-compass` dentro desse projeto.

### Uso

Peça em linguagem natural ou chame `/aeo-compass` diretamente:

- "Audite https://meusite.com.br para busca com IA"
- "Por que meu site não aparece no ChatGPT?"
- "Crie uma landing page para minha padaria que a IA consiga citar"
- "Acabei de publicar três páginas novas, indexe no Bing"
- "Escreva uma página de perguntas frequentes com o que meus clientes perguntam"
- `/aeo-compass auditar ./dist`

Na primeira vez em um projeto, a skill faz um onboarding curto e salva as respostas em `aeo/profile.json` e `aeo/questions.md`. Os relatórios de auditoria vão para `aeo/reports/YYYY-MM-DD.md`. Ela responde no seu idioma e escreve o conteúdo do site no idioma do site.

### Scripts

Todos em `scripts/`. Rode a partir da raiz do seu projeto apontando para a pasta da skill, por exemplo `node ~/.claude/skills/aeo-compass/scripts/audit.mjs https://example.com`. O Claude roda os scripts por você nos modos acima.

| Script | O que faz |
|---|---|
| `detect-stack.mjs [folder] [--json]` | Detecta o framework e diz onde ficam o `<head>`, a pasta pública e a saída do build. |
| `audit.mjs <url-or-folder> [--pages 10] [--json]` | Auditoria técnica (0–75): rastreabilidade, leitura sem JS, entidade, conteúdo citável. |
| `generate-schema.mjs [--profile aeo/profile.json] [--html] [--out file [--force]]` | Gera o JSON-LD global (Organization/LocalBusiness, WebSite, app) a partir do perfil. |
| `generate-llms-txt.mjs (--sitemap <url-or-file> \| --dir <buildOut> --site https://domain.com) [--out file] [--max 100]` | Gera o `llms.txt` a partir do sitemap ou de uma pasta de HTML. |
| `indexnow.mjs --site https://domain.com [--public <folder>] [--sitemap <file>] [--urls a,b] [--changed-since YYYY-MM-DD] [--send]` | Cria a chave e o arquivo-chave do IndexNow, lista as URLs e envia só com `--send`. |
| `bing-submit.mjs --site https://domain.com --urls a,b [--send] \| --quota` | API de envio de URLs do Bing Webmaster; a chave vem de `BING_API_KEY`. |
| `lib.mjs` | Utilitários compartilhados (argumentos, fetch, leitura de sitemap e HTML). |

### Segurança

- Simulação (dry run) por padrão. `indexnow.mjs` e `bing-submit.mjs` não enviam nada sem `--send`, e a skill pede sua confirmação antes de qualquer envio externo. Mesmo na simulação, o `indexnow.mjs` cria a chave (`aeo/indexnow.json`) e o arquivo-chave na sua pasta pública.
- Chaves de API são lidas só do ambiente. Defina a chave do Bing no seu próprio terminal com `read -rs BING_API_KEY && export BING_API_KEY`; ela nunca vai na linha de comando, no chat ou em arquivo.
- A skill pergunta antes de editar um projeto existente e nunca inventa dados do perfil, avaliações, preços ou prêmios.
- Tudo o que estiver em `aeo/profile.json` pode aparecer no código público do site (JSON-LD, `llms.txt`).

### Limites

- Ninguém consegue garantir posições ou citações. A skill aumenta as chances; não controla o que um assistente de IA decide citar.
- Os fatos sobre bots, índices e plataformas foram conferidos em novembro de 2026. Eles mudam rápido, então a skill orienta o Claude a reconfirmar na web qualquer fato verificado há mais de 3 meses.
- O trabalho off-page (Bing Places, Google Business Profile, backlinks, avaliações) é feito por você nas suas próprias contas. A skill entrega o checklist.

### Testes

```bash
node tests/run.mjs
```

### Como contribuir

Issues e pull requests são bem-vindos. Mantenha os scripts sem dependências (só módulos nativos do Node 18+), deixe o dry run como padrão em tudo o que fala com um serviço externo e atualize o arquivo correspondente em `references/` quando um fato mudar, com a data em que você conferiu.

### Licença

Apache 2.0. Veja [LICENSE](LICENSE) e [NOTICE](NOTICE).
