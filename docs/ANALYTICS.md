# Guia do PostHog — Rocket Draft (operacional)

> Guia prático pra **usar** o PostHog (montar funis e filtros). Escrito em PT
> porque é um how-to pra operar a ferramenta, não doc de arquitetura. Os nomes de
> eventos e os termos da interface ficam em inglês (a UI do PostHog é em inglês).
>
> Estado: PostHog **ativo e recebendo dados** (host EU, cookieless/anônimo) e é o
> **único sink**; o Vercel Web Analytics foi removido na v1.4 (ver §7). Coleta =
> pageviews (SPA-aware) + os eventos de jogo abaixo. Desde o relançamento
> estático na Cloudflare, a chave `phc_…` entra **no build**: `.env.local` num
> deploy local, ou *Build variables* no Workers Builds. O SDK carrega de forma
> **lazy**, `$pageleave` não é mais coletado e flags/remote config estão
> desligados. **Leia o §8 antes de comparar números de antes e depois do corte.**

---

## 1. O modelo mental do PostHog (o que confunde)

Só 4 conceitos importam:

- **Event (evento):** uma coisa que aconteceu, ex. `run_completed`. Cada evento
  vem com **properties** (propriedades), ex. `difficulty=legacy`, `won=true`.
- **Property (propriedade):** um campo dentro do evento. É com elas que você
  **filtra** e **quebra** (breakdown) os dados.
- **Insight:** um gráfico/relatório que você cria a partir de eventos. Os tipos
  que você vai usar: **Trends** (contagens/linhas no tempo) e **Funnels** (taxa de
  conversão entre passos).
- **Dashboard:** um painel onde você **fixa** vários insights pra ver de uma vez.

Fluxo mental: *escolho um evento → filtro/quebro por uma property → escolho o tipo
de insight*. Só isso.

**⚠️ A pegadinha que mais confunde — Funnel conta PESSOAS, não runs:**
- Um **Funnel** mede **usuários únicos** que percorreram os passos na ordem. Quem
  joga 20 runs conta **1**. Ótimo pra "% que converte", PÉSSIMO pra contar volume.
- Pra **contar runs** (ou pageviews), use **Trends** e no `math` da série escolha
  **Total count** (= nº de eventos). "Unique users" = nº de jogadores.
- Regra de ouro: *Quantas runs?* → Trends + **Total count**. *Quantos jogadores?*
  → Trends + **Unique users**. *% que avança?* → Funnel (por pessoa).
- E confira sempre o **período** (canto sup. direito) — o padrão são 7 dias e
  esconde tudo que é mais antigo; use "All time" pro total de verdade.

**Anônimo por design:** nunca chamamos `identify()`, então tudo é por um id
anônimo (localStorage, sem cookies) e quem usa "Do Not Track" não é contado. Isso
é suficiente pra funis e agregados; só não dá pra rastrear uma pessoa específica
entre dispositivos (e é proposital, pela política de privacidade).

---

## 2. Onde olhar primeiro (confirmar que chega dado)

- Menu lateral → **Activity** (feed de eventos ao vivo). Joga uma run e veja
  `run_started`, `tournament_started`, `run_completed` aparecerem em tempo real.
- Menu lateral → **Data management → Events** lista todos os tipos de evento e as
  properties de cada um (útil pra lembrar os nomes).

---

## 3. Catálogo de eventos (o que cada um significa)

| Evento | Quando dispara | Properties úteis |
|---|---|---|
| `$pageview` | Cada página/rota (automático) | `$current_url`, `$pathname` |
| `run_started` | Run criada (classic/quick/daily/challenge) | `mode`, `difficulty`, `hiddenOverall`, `region` |
| `tournament_started` | Draft confirmado, bracket começou | `mode`, `difficulty` |
| `run_completed` | Chegou na tela de resultado (desfecho) | `mode`, `difficulty`, `placement`, `won`, `teamOverall`, `swissWins`, `swissLosses`, `xpGained`, `hiddenOverall` |
| `run_abandoned` | Saiu antes do resultado | `mode`, `difficulty`, `phase` (draft/review/tournament), `reason` (quit/restart), `hiddenOverall`, `region` |
| `special_used` | Uma vez por carta especial no roster final, ao iniciar o torneio | `specialId`, `title`, `rarity`, `mode`, `difficulty` |
| `challenge_played` | Um desafio (Bo7 único) foi jogado | `challengeId`, `difficulty`, `cleared` |

`region` = `"worldwide"` ou `"SAM"`. `difficulty` = easy/normal/hard/legacy.
`cleared` = `true` quando o desafio foi resolvido (série vencida).

---

## 4. Receitas (clique a clique)

> Em todas: menu lateral → **Product analytics** (ou **Insights**) → **New insight**.

### 4.1 Funil: começou → torneio → terminou
1. New insight → tipo **Funnels**.
2. **Step 1** = `run_started` · **Step 2** = `tournament_started` · **Step 3** = `run_completed`.
3. (Opcional) **Breakdown by** = `difficulty` (ou `mode`) pra comparar a conversão por modo.
4. Ajuste o período no canto superior direito.
> Lê: % de quem começa que confirma o draft e que chega ao fim.
> ⚠️ Os números do funil são **pessoas únicas**, não runs (quem joga várias runs
> conta 1). Pra **volume de runs concluídas**, use Trends + Total count (§4.3).

### 4.2 Taxa de vitória por dificuldade (o número-chave)
Jeito **preciso** (com fórmula — dá o % real):
1. New insight → tipo **Trends** (math das séries = **Total count**).
2. **Series A** = `run_completed` → clique em **Filter** dessa série → property `won` = `true`.
3. **Series B** = `run_completed` (sem filtro).
4. Ative o modo fórmula (botão **Formula**, ícone de Σ / "Add formula") → digite `A/B`.
5. **Breakdown by** = `difficulty`.
6. (Opcional) Formate o eixo como porcentagem.
> Resultado: a % de vitória por dificuldade (legacy/hard/normal/easy).

Jeito **simples** (sem fórmula, só olhar a proporção):
1. New insight → **Trends** → Series = `run_completed`.
2. **Breakdown by** = `won` (mostra ganhou × perdeu).
3. **Filter** = `difficulty` = `legacy` (troque pra ver cada uma).
> Você vê as duas barras (true/false) e estima a proporção.

### 4.3 Runs por dia, por modo/dificuldade/região
1. New insight → **Trends** → Series = `run_started` (math = **Total count** = nº de runs).
2. **Breakdown by** = `mode` (ou `difficulty`, ou `region`).
3. Display = linha ("Time series"); período = últimos 30 dias (ou "All time").
> Volume e tendência de jogo. Troque a Series pra `run_completed` pra contar runs
> CONCLUÍDAS, ou pra `$pageview` pra ver tráfego do site. (math "Unique users" = jogadores.)
>
> **Evitar o "spaghetti" de linhas:** quebrar por modo + dificuldade + região ao
> mesmo tempo gera dezenas de linhas (é o produto das combinações). Como melhorar:
> - Use **um** breakdown por insight; faça insights separados (1 por dimensão) e
>   junte no dashboard. Mais legível que um gráfico tentando dizer tudo.
> - Troque o **Display**: **Bar chart (Total value)** ou **Pie** = uma barra/fatia
>   por categoria no período (sem linha-por-dia); **Table** aguenta MUITAS
>   categorias juntas sem poluir (modo+dificuldade+região vira linhas da tabela).
> - **Filtre** o que não está comparando (ex. `region=worldwide`) em vez de quebrar.
> - Pra ver no tempo com 1 breakdown, use **Area chart (stacked)** em vez de linhas.
> - Nas opções de breakdown, limite ao **top N** (o resto vira "Other").

### 4.4 Onde as pessoas desistem
1. New insight → **Trends** → Series = `run_abandoned`.
2. **Breakdown by** = `phase` (draft / review / tournament).
3. (Opcional) segunda quebra ou filtro por `reason` (quit × restart).
> Mostra em que etapa some mais gente — onde mexer pra reduzir frustração.

### 4.6 Cartas especiais mais usadas
1. New insight → **Trends** → Series = `special_used` (math = **Total count**).
2. **Breakdown by** = `title` (nome da carta) — ou `rarity` pra ver uso por raridade.
3. Display = **Bar chart** ou **Table** (ranking limpo); período = "All time".
4. (Opcional) Filter por `difficulty`/`mode` pra ver uso por contexto.
> Dispara 1 vez por special no roster ao iniciar o torneio — ranking do que os
> jogadores de fato levam pra jogar. (Começa a coletar a partir do próximo deploy.)

### 4.5 SAM vs Worldwide
Em qualquer insight acima, adicione **Filter** = `region` = `SAM` (ou `worldwide`),
ou use **Breakdown by** = `region` pra comparar lado a lado.

---

## 5. Montar um painel
1. Em cada insight criado → **Save** (dê um nome claro, ex. "Win rate por dificuldade").
2. Menu lateral → **Dashboards** → **New dashboard** ("Rocket Draft — visão geral").
3. **Add insight** → escolha os que você salvou.
> Abra esse dashboard pra ver tudo de uma vez nos próximos dias.

---

## 6. Sugestão de painel inicial (5 insights)
1. **Funil run_started → tournament_started → run_completed** (§4.1).
2. **Win rate por dificuldade** (§4.2, fórmula `A/B` + breakdown `difficulty`).
3. **Runs por dia por modo** (§4.3, breakdown `mode`).
4. **Desistências por fase** (§4.4, breakdown `phase`).
5. **Pageviews por dia** (§4.3 com `$pageview`).

---

## 7. Notas
- Mudar evento/property é no código (`src/lib/analytics.ts` — catálogo tipado);
  adicione uma chave em `GameEvents` e chame `trackEvent(...)` na camada de UI/store.
- **PostHog é o único sink.** O Vercel Web Analytics foi REMOVIDO na v1.4 (era
  redundante com o PostHog e os beacons por evento estouravam o limite de "edge
  requests" do plano Hobby). `trackEvent` agora envia pra um sink só (PostHog).
  *(Correção, 2026-10: medido depois, os beacons eram só ~7-20% das requests. Os
  multiplicadores dominantes eram o prefetch de links e as imagens de `/public`
  sem cache. Ver CHANGELOG "Unreleased — Static relaunch".)*
- Dados são agregados e não-PII (condiz com a política de privacidade).

---

## 8. Relançamento estático (Cloudflare, 2026-10): o que mudou na coleta

**Como o SDK carrega agora.** O `posthog-js` saiu do bundle das páginas
(~75 KB gz a menos) e virou um `import()` lazy:
- `PostHogProvider` carrega o SDK depois do evento `load` da janela + um momento
  ocioso (`requestIdleCallback`, prazo de 3 s; teto de 10 s se o `load` nunca
  disparar).
- Até lá, `trackEvent` **enfileira** os eventos de jogo (máx. 50), com o timestamp
  e a URL originais, e eles são reenviados quando o SDK fica pronto. Pageviews de
  navegação SPA feitas antes do init também são reenviadas.
- O `$pageview` da página atual continua vindo do próprio SDK, sem contagem dupla.
- O id anônimo continua o mesmo (mesma chave `ph_<token>_posthog` no
  localStorage), então quem já jogava não vira "pessoa nova".

**O que deixou de existir:**
- **`$pageleave`** (`capture_pageleave: false`): nenhum insight deste guia usa.
- **Feature flags / remote config** (`advanced_disable_flags: true`): não há mais
  `config.js`, `/flags` nem polling a cada 5 min, e o código não usa flags.
  Efeito colateral: ligar heatmaps, exception capture etc. nas *project settings*
  do PostHog **não tem efeito**. Isso agora só muda no código.

**Descontinuidade no corte: compare antes/depois com cuidado.**
- **Contagens de `$pageview`, usuários únicos e sessões caem por construção.**
  Uma visita que sai antes do `load` + idle + download do SDK agora não registra
  pageview nem sessão. Antes, o primeiro `$pageview` saía já na hidratação. Ou
  seja: bounces muito rápidos deixaram de ser contados.
- **Bounce rate e duração de sessão do Web Analytics mudam** em sessões de uma
  página só, porque o `$pageleave` sumiu.
- **UTM:** se a pessoa chega em `/?utm_source=…` e navega dentro do app antes do
  SDK carregar, o landing `$pageview` mantém o `$current_url` certo, mas as
  propriedades `utm_*`/`gclid` **não** ficam na pessoa nem na sessão. As
  quebras por canal/UTM subcontam. Nenhuma receita deste guia usa UTM.
- Alguns eventos podem se perder se a aba fechar nos segundos antes do SDK chegar.

Na prática:
- Marque a data do corte como *annotation* nos gráficos.
- Prefira métricas de jogo (`run_started`, `run_completed`, win rate, funil
  §4.1), que não dependem do timing de carregamento.
- Não leia uma queda de pageviews/sessões no dia do corte como queda de
  audiência.
