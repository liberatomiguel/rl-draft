# Etapa 1 (v2.1 Matchday + Mundo vivo): gate

## Branch e staging

**`claude/etapa1-final-1692be` = `2.1.0-rc.4` (21/11), publicado em `staging`.**
Parte do rc.3 (`c9187fa`, `claude/etapa1-integration-3eae43`) e acrescenta:
a divisão regional do Worlds (R146) e a fatia 5, as telas do Matchday (R147).
Tem: a nova identidade na quinta passada, `main` v2.0.35, Matchday fatias 1
a 5, Mundo vivo M1, M2.1, M3, analytics da Etapa 1. `BALANCE_VERSION` 45.
Suíte (2972), lint, typecheck e build verdes. Worktree novo: `npm ci`.
Produção continua em v2.0.35: nada disso vai para `main` antes do gate.

## Flags

`STAGING_BUILD` (`balance.ts`) = `next build` + `NEXT_PUBLIC_NOINDEX=1`, sem
`NEXT_PUBLIC_PLAYTEST`. Liga `matchdayStyles`, `matchdayDecisions`,
`matchdayBoxScore` e `worldLife` **só no staging** (`stagingFlags.test.ts`).
Sondas e dev: `NEXT_PUBLIC_MATCHDAY_STYLES/DECISIONS/BOXSCORE=1`,
`NEXT_PUBLIC_WORLD_LIFE=1` (num `.env.development.local`, git-ignored).

## O que jogar no staging

1. **Clube → Opções da carreira → Dia de jogo**: Rápido (padrão) ou
   Personalizado; no personalizado, "Playoffs e eventos LAN" ou "Toda série".
2. **Um evento em "Jogar a série" no personalizado**: o plano da série (o
   técnico já preencheu; com "Técnico"/"Capitão" marcando a escolha dele),
   jogar o jogo 1, a pausa (embalo, tempo técnico, ajuste, troca), "Deixar com
   o técnico", Continuar. A série jogada cai direto no resultado e a
   reprodução para ali para você ler a súmula; "Retomar" segue.
3. **A súmula** debaixo de qualquer série terminada no Match Center (série e
   jogo a jogo: notas 0-10, MVP, momentos-chave).
4. **Elenco → Estatísticas da temporada**, depois de encerrar um evento.
5. **Rápido nunca para**; "Resultado instantâneo" nunca para, nem no
   personalizado; o autoplay para no dia de jogo como antes.
6. **Carreira longa (S1 a S10+)**: quem ganha os Worlds que você não joga.

## Números (bots, não jogadores)

- **Worlds da IA por região** (10 carreiras, Normal, tudo ligado; temporadas
  como o jogo mostra): temporadas 1–8 **EU 57, NA 30, MENA 10, SAM 3** (antes
  79 / 16 / 5 / 0,4); temporadas 10+ **EU 49, NA 36, SAM 7, MENA 7** (sem
  mudança: os 55% de NA do rc.3 eram ruído de 5 carreiras). Um ano isolado
  ainda pode ser de uma região só (temporada 3: EU ~94%).
- Chance de título de um time do usuário de 97 nas temporadas 1–8: 14,2 →
  14,4% (a alavanca sobe as outras regiões em vez de só baixar a EU).
- Guardas: os jogadores do mundo idênticos; motor, Draft, +2 74,9%, +6
  98,2%, +5 perde 4,1% iguais ao rc.3; 0 soft lock em 28 carreiras (7
  regiões × Normal/Hard × 2 políticas, 10 temporadas).
- Do rc.3, aprovados por você: zebra grande 2,7% na Normal; falência Hard 6
  de 42. Rampa EU (final regional até T5, Normal) 40%, NA 40%: não mexida.
- Dumps: `rc3-battery-dumps/` e o scratchpad desta sessão (sondas
  `careerWorldTop.probe` WORLDTOP=1 WORLDTOP_FROM=0 WORLDTOP_SEEDS=2,
  `careerSoftlock.probe` P1_SOFT=1).

## O que o Miguel decide no gate

- **Metas 3, 6 e 7** (as sondas de bot não medem; 3 e 6 só relatório).
- **Hard EU sem final regional até T5** (0 de 16): aceitar ou dar à Hard uma
  rampa pequena (hoje `earlyShiftScaleByDifficulty.hard` = 0).
- **XP do reserva que entra na troca** (`fieldedIds` não muda): fica sem XP?
- **A divisão do Worlds** (R146): EU 57 / NA 30 / outras 13 no começo e
  49 / 36 / 15 depois. Se quiser a EU um pouco mais forte no fim, o caminho
  é a renovação do M2.1 por região.
- **A7, a tab bar mobile da carreira, continua sua** (resolve também o
  wordmark da Home a 320 px e os rótulos do HQ colados).
- Depois do OK: levar o rc para `main` e a produção (procedimento em
  `DEPLOY-CLOUDFLARE.md`), com as flags decididas uma a uma.

## Publicar outro rc em staging

`git fetch origin`; conferir o que mudou em `origin/staging` desde o último
push (`git diff --stat <ultimo> origin/staging`); se nada novo,
`git push --force-with-lease=staging:<ultimo> origin HEAD:staging`. O Workers
Build `rocket-draft-staging` builda sozinho; não adicionar
`NEXT_PUBLIC_PLAYTEST`. Nunca deploy local (o `.env.local` tem as chaves do
Supabase); nunca este branch em `main`; nunca `public/fonts-trial/`.
