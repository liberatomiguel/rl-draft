# Etapa 1 (v2.1 Matchday + Mundo vivo): handoff

## Branch

**`claude/etapa1-integration-3eae43` = `2.1.0-rc.3`** (21/11), não publicado.
Tem: a nova identidade na quinta passada (`4b4ecd6`; `design/broadcast-pilot`
está atrás de `staging`, não parta dele), `main` v2.0.35, Matchday fatias 1 a 4
(só motor e store), Mundo vivo M1, M2.1 e M3, analytics da Etapa 1.
`BALANCE_VERSION` 44. Suíte, lint, typecheck e build verdes. Worktree novo:
`npm ci` antes de buildar.

## Flags

`STAGING_BUILD` (`balance.ts`) = `next build` + `NEXT_PUBLIC_NOINDEX=1`, sem
`NEXT_PUBLIC_PLAYTEST`. Liga `matchdayStyles`, `matchdayDecisions`,
`matchdayBoxScore` e `worldLife` (M1, M2.1 e M3) **só no staging**. Produção,
playtest, dev e testes: desligadas (`stagingFlags.test.ts`). Sondas:
`NEXT_PUBLIC_MATCHDAY_STYLES/DECISIONS/BOXSCORE=1`, `NEXT_PUBLIC_WORLD_LIFE=1`.

## Decisões (`ROAD-TO-WORLDS-DECISIONS.md`)

R137 Etapa 1 aprovada (princípio, metas, fatia 4 opção B) · R138 fatia 2 ·
R139 M1 · R140 fatia 3 · R141 fatia 4 · R142 M2.1 · R143 M3 · R144 a IA planeja
com o coach · R145 piso de 0,3 sem coach.

## Bateria combinada (tudo ligado, 21/11)

Tabela e dumps: CHANGELOG rc.3 e `rc3-battery-dumps/` nas notas.
- Guardas duras de pé: golden do Draft, âncoras (overall dominante) e digest
  das séries com tudo ligado; +2 74,9%, +6 98,2%; favorito de +5 perde 4,1%
  (motor) e 5,9–6,4% na carreira; 0 soft lock; S0–S5 do mundo iguais.
- Meta 1 (final regional até T5, Normal, bot strong): EU 40, NA 40 (no
  limite), SAM 63%. Meta 2: Easy EU 67% (+27). Meta 4: Hard abaixo da Normal em
  tudo. Meta 5: time 97 ganha o Worlds 17% (S10–S15), 99 ganha 55%.
- Campeões do Worlds da IA: EU 46%, NA 40%; S10+ a NA domina (55%).
- 3,2 s por temporada simulada.
- Para o gate: zebra grande (≤ −6) ganha 2,7% na Normal (era 0,3%); Hard EU
  sem final até T5 (0 de 16); falência Hard 6 de 42 (era 4).

## Próximo

1. **Fatia 5: telas na nova identidade** (`DESIGN.md` primeiro). O store já
   tem tudo: pré-série (`shownStyle`, `playmakerIndex`, traços, sugestão de
   `coachPlanFor`), pausa, modos `prefs.matchdayMode` / `matchdayStopAt`,
   súmula (`buildSeriesBoxScore`, `momentText`, `save.boxStats`). No modo
   personalizado, `playEventRound`/`simEvent` param numa série aberta
   (`pendingUserSeriesOf`); a tela usa `setSeriesPlan`, `playSeriesGame`,
   `seriesTimeout`, `seriesAdjust`, `seriesSub`, `delegateSeries`. O autoplay
   e o "Avançar" precisam tratar essa parada. Cada tela esconde o que a sua
   flag desliga.
2. **Publicar em `staging`** (`DEPLOY-CLOUDFLARE.md`, "Cloud staging"), só com
   o OK do Miguel: `git fetch origin`; se `origin/staging` ainda é `cfefe9d`,
   `git diff --stat cfefe9d HEAD` (nada de staging pode sumir) e
   `git push --force-with-lease=staging:cfefe9d origin HEAD:staging`, ou antes
   `git merge -s ours cfefe9d` e um push normal. O Workers Build
   `rocket-draft-staging` builda sozinho; não adicione `NEXT_PUBLIC_PLAYTEST`
   nele. Conferir rodapé `2.1.0-rc.N`, `robots.txt` `Disallow: /`, Home, HQ, um
   evento, 320 px. Nunca deploy local (o `.env.local` tem as chaves do
   Supabase); nunca este branch em `main`.
3. **A7 do Miguel** (tab bar mobile da carreira). Também resolve o conhecido a
   320 px: wordmark da Home 25 px largo demais, rótulos do HQ colados.
4. **Em aberto:** metas 3, 6, 7, 8 e 9 (as sondas de bot não medem; 3 e 6 só
   relatório); XP do reserva que entra na troca (`fieldedIds` não muda); Hard
   EU 0% até T5.

Para trazer um branch novo: `git merge --no-ff refs/heads/<branch>`; tela fica
com a nova identidade, comportamento e dados com o branch; números R e de
DESIGN-DECISIONS não repetem (renumere o mais novo); depois do merge, rode o
teste de fingerprint e suba `BALANCE_VERSION` ao que ele pedir.
