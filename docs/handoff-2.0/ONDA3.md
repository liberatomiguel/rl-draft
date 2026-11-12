# Onda 3 — a virada da Season 1 (handoff do coordenador)

> Escrito em 12/11/2026, com o **v2.0.0-rc.50** no staging. Leia este arquivo e
> `docs/STATUS.md`; o resto só quando a etapa pedir. Produção continua na
> `main`, v1.4.8. Nada da 2.0 foi para a `main`.

## Onde estamos

- Base de integração: branch `claude/rc42-balance`, commit do rc.50. O branch
  `staging` (remoto) tem a mesma árvore.
- As duas ondas estão integradas. Um arquivo por sessão nesta pasta:
  C1 motor da carreira, C2 progressão, C3 dificuldade do draft, C4 web/SEO,
  G1 telas da carreira, G2 draft/menu, M1 mobile, T1 textos e tutorial,
  A1 analytics, P1 performance. Leia só o que a etapa tocar.
- Verificado no rc.50: 2.313 testes, lint, typecheck, build no formato staging,
  sonda de travamento (14 carreiras × 7 temporadas, zero achados).
- **Não verificado:** nenhum aparelho físico nem Safari (M1 validou em emulação);
  telas não foram abertas em navegador depois do merge da onda 2; analytics só
  liga em produção e nunca foi conferido no PostHog; nada do motor novo da
  carreira passou por bateria de balanço; sync de conta e migração de save real
  de pre-season não foram ensaiados.

## Ordem da onda 3

Cada passo depende do anterior, salvo onde diz "em paralelo".

1. **Playtest do Miguel no rc.50** (em paralelo com 2 e 3). Roteiros: seção
   "o que o Miguel deve jogar" de cada handoff. Prioridade: celular de verdade;
   uma carreira além da temporada 3; tutoriais; textos novos.
2. **Conteúdo, com o Miguel:** cartas especiais novas e revisadas
   (`src/data/specialCards.json`, mantido à mão; depois `npm run validate:data`),
   escolha das cartas liberadas por semana da season (só a da semana 1 precisa
   existir no lançamento), cosméticos novos, imagens das seleções FIFAe
   (`build:badges` / `build:banners` / `build:images`, commit do manifest).
3. **Ensaio de migração** (em paralelo): cópias de saves reais da pre-season
   carregando no rc atual. Conferir: recap, rank congelado e conquistas de rank
   (C2), XP zerado na curva nova, rating 400, coleção e histórico intactos; um
   save de carreira rc.45 ou anterior; uma carreira travada na temporada 3 volta
   a andar. Checklist: `docs/V2-IMPLEMENTATION-PLAN.md` §7.
4. **Pool de cartas fechado → recalibração.** Qualquer mudança no pool ou no RNG
   de especiais invalida a calibração e as seeds fixas. Nesta ordem:
   matriz de dificuldade (`SIM_MATRIX=1`, `difficulty.matrix.test.ts`), depois
   re-tune das challenges (`CH_TUNE=1`, `challenges.tune.test.ts`) e replays dos
   dailies. Barra: as 135 estrelas e os 365 dailies resolvem. Método e alvos:
   `C3.md` e as notas de memória sobre a matriz e as seeds.
5. **Datas da Season 1.** `src/config/season.ts` ainda tem 2026-10-20 →
   2026-12-22. Miguel informa as reais.
6. **Fechamento do release:** versão `2.0.0`, entrada final do CHANGELOG 2.0
   (as entradas por rc já existem; falta o resumo de topo e as notas para os
   jogadores), `CONTENT_DATE` em `src/content/pageRoutes.ts`, STATUS.
7. **Tarefas do Miguel fora do código:** `V2-IMPLEMENTATION-PLAN.md` §6 A–E
   (SQL de produção, congelar o board da pre-season, grants, variáveis do
   Cloudflare, sitemap).
8. **Gate final no staging:** suíte completa, lint, typecheck, build, sonda de
   travamento se algo da carreira mudou, checklist §7, orçamento de pedidos
   (`node scripts/request-budget.mjs`: a run Classic está em 70 de 75).
9. **Deploy:** merge na `main` e produção, só com o sim explícito do Miguel.
10. **Depois do deploy:** conferir eventos chegando no PostHog; anotação na data
    do deploy; painéis e funis (lista em `A1.md`); ajustar `playersPerDay` em
    `public/analytics-budget.json` se o volume subir.
11. **Limpeza da documentação** (pode ficar para depois do lançamento): mover os
    relatórios de rc antigos para `docs/archive/`, encurtar STATUS e ROADMAP,
    ajustar o AGENTS.md. São 100 arquivos em `docs/`.

## Armadilhas do deploy

- Produção precisa de `NEXT_PUBLIC_CAREER_MODE=1` (a carreira sai com tag BETA)
  e **sem** `NEXT_PUBLIC_NOINDEX`. `scripts/postexport.mjs` espelha a expressão
  de `FEATURES.careerMode`; o log final do build diz o que ficou ligado.
- Um build ou deploy local lê `.env.local` (chaves do Supabase). O deploy é do
  Cloudflare a partir do branch, não da máquina.
- Um build local reescreve `src/generated/asset-manifest.json`: restaurar, nunca
  commitar por acidente.
- Publicar no staging: um commit de merge feito sem trocar de branch
  (`git commit-tree HEAD^{tree} -p origin/staging -p HEAD`, push para
  `refs/heads/staging`). Antes, `git fetch` e comparar a árvore com
  `origin/staging`: outras sessões publicaram lá no meio do caminho (rc.48).
  O push também atualiza o site de playtest externo.
- O `gh` não está instalado nesta máquina; confira o deploy pelo próprio site
  (a home traz a versão).
- Saves: chaves e versões de persistência congeladas; todo campo novo é aditivo.

## Pendências conhecidas (nenhuma bloqueia sozinha)

Carreira
- Dados de regionais pesquisados pela G2 (`G2-regionais.json`) não estão
  ligados na corrida pela história.
- Season X: "Worlds cancelado" aparece só na notícia; a tabela da corrida pelo
  Worlds não diz.
- Região que perde organizações completa os eventos com times locais (R130);
  repor com uma organização nova é decisão em aberto.
- Valores provisórios sem bateria: coach (contrato, evolução, vantagem de
  origem), meta de patrocínio por contrato e teto de multa ×3, XP da carreira.
- Baterias de balanço dos rc.47–rc.49 não valem: nenhuma carreira passava da
  temporada 3.
- Gate 3b (ritmo da carreira) segue sem aprovação do Miguel; a tag BETA cobre.

Draft e progressão
- Modo Quick não foi simulado separadamente; APAC e SSA fora da matriz.
- Conquista de títulos nas 5 regiões não entrou (precisa de campo novo).
- 21 conquistas novas sem arte.
- Ritmo do álbum mundial: cerca de 420 runs.

Web e interface
- Assets com 404: bandeiras `ke`, `kr`, `mx`, `ng`, `mena` e o brasão
  `out-of-skill`.
- A faixa "Play the RLCS draft game" aparece só em `/changelog` e `/privacy`
  (os artigos já terminam com botão próprio).
- Piso de JS de cerca de 271 KB em toda página; alavancas de arquitetura
  medidas e não aplicadas (`C4.md`, `P1.md` §6).
- Aba My Deals e logos em evento de parceiro não foram vistos em navegador.
- Privacidade cita só o PostHog; acrescentar o Cloudflare Web Analytics se
  estiver ligado na zona.

Analytics
- `run_started`, `tournament_started` e `special_used` param no deploy; os
  gráficos antigos desses eventos terminam ali.
- Base medida em 11/11: 64 a 118 jogadores por dia, 172 mil eventos por mês,
  limite de 1 milhão. A proteção liga acima de 700 jogadores por dia.

## Decisões tomadas pelo coordenador em nome do Miguel (ainda não jogadas)

- XP da carreira com o valor por série na metade da proposta da C2 (25 + 15 por
  vitória), porque o Skip simula uma temporada em minutos.
- Supersonic Legend em 675k XP; seleções FIFAe no Gold; rating só pontua top 4.
- Seis URLs novas de SEO mantidas; `X-Frame-Options: SAMEORIGIN` (o jogo não
  abre em iframe de terceiros).
- Placar das challenges em 2×.
- Pop-up de desbloqueio pela escada de progressão, não pelos e-mails.
- Última dica do quiz mantém o ano ("pico de overall X pelo time Y em ANO").

## Fica para o 2.0.1

Cartas das semanas 2 em diante; ligação dos dados de regionais; reescrita a
fundo do CHANGELOG e do DESIGN-DECISIONS; alavancas de arquitetura de
performance; decisões de balanço da carreira ainda abertas no ROADMAP (multas
Bold, EU no Normal, snowball, primeira quebra no Hard).
