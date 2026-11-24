# Etapa 1 (v2.1 Matchday + Mundo vivo): gate fechado

## Onde está

**`2.1.0-rc.6` (24/11), publicado em `staging`.** É o rc.5 (`3914518`, o
redesenho do celular) com o fechamento do gate, o Daily com o draft ótimo, o
duelo por link, a fatia 1 do Pro e a v2.0.36 de `main` dentro (a landing `/rocket-league-manager` nova, EN e PT,
sem travessões como o resto da identidade). Tem: a identidade nova, Matchday
fatias 1 a 5, Mundo vivo M1, M2.1, M3, a divisão do Worlds (R146), analytics
da Etapa 1. `BALANCE_VERSION` 47. Worktree novo: `npm ci`.

**Gate aprovado pelo Miguel em 24/11** depois de jogar o rc.4 (R149).
Produção continua em v2.0.36: a Etapa 1 não vai para `main` agora.

## Regra da linha do staging

- **O staging acumula etapas; `main` só quando o Miguel decidir.** As
  próximas etapas (Pro) e as frentes do Draft partem de `origin/staging`.
- Uma v2.0.x que sair em `main` entra no staging por merge (como a v2.0.36
  aqui), nunca o contrário.
- As quatro flags (`matchdayStyles`, `matchdayDecisions`, `matchdayBoxScore`,
  `worldLife`) ficam ligadas **só no staging** (`STAGING_BUILD` em
  `balance.ts`, `stagingFlags.test.ts`). Fora dele continuam desligadas.

## Flags e sondas

`STAGING_BUILD` = `next build` + `NEXT_PUBLIC_NOINDEX=1`, sem
`NEXT_PUBLIC_PLAYTEST`. Sondas e dev: `NEXT_PUBLIC_MATCHDAY_STYLES/DECISIONS/
BOXSCORE=1`, `NEXT_PUBLIC_WORLD_LIFE=1` (num `.env.development.local`,
git-ignored). Soft lock: `P1_SOFT=1` (`careerSoftlock.probe`), sozinha.
Worlds por região: `careerWorldTop.probe` (`WORLDTOP=1 WORLDTOP_FROM=0
WORLDTOP_SEEDS=2`).

## Números do gate (bots, não jogadores)

- Worlds da IA por região (10 carreiras, Normal, tudo ligado): temporadas
  1–8 EU 57, NA 30, MENA 10, SAM 3; temporadas 10+ EU 49, NA 36, SAM 7,
  MENA 7. Um ano isolado ainda pode ser de uma região só.
- Título de um time do usuário de 97 nas temporadas 1–8: 14,4%.
- Motor e Draft iguais ao rc.3 (+2 74,9%, +6 98,2%, +5 perde 4,1%); 0 soft
  lock em 28 carreiras. Zebra grande 2,7% na Normal; falência Hard 6 de 42;
  rampa EU (final regional até T5, Normal) 40%, NA 40%.
- Dumps: `rc3-battery-dumps/`.

## Decidido no gate (24/11)

- Gate aprovado; flags ligadas só no staging.
- **Hard EU sem final regional até a T5 fica como está**
  (`earlyShiftScaleByDifficulty.hard` = 0).
- Próxima etapa: **Pro** (carreira de jogador, v2.2), antecipada
  (`PLANO-PROXIMO-NIVEL-2026-11-19.md` E1/N1). Frentes paralelas do Draft:
  **desafio por link** e **Daily com draft ótimo** (E2).

## Continua aberto (do Miguel, sem prazo)

- **XP do reserva que entra na troca** (`fieldedIds` não muda): hoje fica
  sem XP.
- **Confirmar a divisão do Worlds do R146** (EU 57 / NA 30 / outras 13 no
  começo; 49 / 36 / 15 depois). Se quiser a EU mais forte no fim, o caminho
  é a renovação do M2.1 por região.
- **Metas 3, 6 e 7 do gate** (as sondas de bot não medem; 3 e 6 só
  relatório).
- **A7, a tab bar mobile da carreira** (resolve também o wordmark da Home a
  320 px e os rótulos do HQ colados).
- **P1–P4 do `MATCHDAY-SPEC.md` §11**: o ciclo de estilos, os nomes dos
  traços, "Deixar com o coach" ligado por padrão, os limites da seção 7.
- Quando o Miguel decidir levar a linha para `main`: as flags uma a uma e o
  procedimento de `DEPLOY-CLOUDFLARE.md`.

## Publicar no staging

Há sessões em paralelo publicando na mesma linha. `git fetch origin`; se
`origin/staging` andou, merge dele no seu branch e checks de novo; depois
`git push origin HEAD:staging`, **só fast-forward, sem force**. O Workers
Build `rocket-draft-staging` builda sozinho (~11 min); confira a versão no
rodapé de https://staging.rocketdraft.app. Nunca deploy local (o
`.env.local` tem as chaves do Supabase), nunca em `main`, nunca
`public/fonts-trial/`.
