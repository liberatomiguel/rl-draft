# Guia do PostHog — Rocket Draft (operacional)

> Guia prático pra **usar** o PostHog (montar funis e filtros). Escrito em PT
> porque é um how-to pra operar a ferramenta, não doc de arquitetura. Os nomes de
> eventos e os termos da interface ficam em inglês (a UI do PostHog é em inglês).
>
> Estado: PostHog **ativo e recebendo dados** (chave `phc_…` no Vercel, host EU,
> cookieless/anônimo). Coleta = pageviews (SPA-aware) + os eventos de jogo abaixo.

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
| `run_started` | Run criada (classic/quick/daily) | `mode`, `difficulty`, `hiddenOverall`, `region` |
| `tournament_started` | Draft confirmado, bracket começou | `mode`, `difficulty` |
| `run_completed` | Chegou na tela de resultado (desfecho) | `mode`, `difficulty`, `placement`, `won`, `teamOverall`, `swissWins`, `swissLosses`, `xpGained`, `hiddenOverall` |
| `run_abandoned` | Saiu antes do resultado | `mode`, `difficulty`, `phase` (draft/review/tournament), `reason` (quit/restart), `region` |
| `special_used` | Uma vez por carta especial no roster final, ao iniciar o torneio | `specialId`, `title`, `rarity`, `mode`, `difficulty` |

`region` = `"worldwide"` ou `"SAM"`. `difficulty` = easy/normal/hard/legacy.

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
- O Vercel Web Analytics continua ligado em paralelo (mesmos eventos). Quando
  quiser, dá pra desligar e ficar só no PostHog (resolve o limite do plano free) —
  é um ajuste de 2 linhas no `layout.tsx`/`analytics.ts`.
- Dados são agregados e não-PII (condiz com a política de privacidade).
