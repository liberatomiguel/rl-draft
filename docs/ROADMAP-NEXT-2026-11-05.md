# Rocket Draft 2.0 — rodada de carreira após rc.36.10 (plano de 05/11)

Plano de execução para o feedback de 04/11 (playtest dos amigos + bateria
`Rocket_Draft_RTW_Bateria_Extensiva_2026-11-04.md`, 611 runs no rc.36.10) e
para o restante da Etapa 4. **Nada vai para `staging` nesta rodada**: cada
frente trabalha no seu branch local, Miguel revisa os diffs, a integração
fica em `claude/rc37-integration`. Cada agente lê **só a seção da sua
frente** deste documento, mais AGENTS.md. As referências `arquivo:linha` são
do commit `6fe2582` (rc.36.10) e já foram verificadas, então não é preciso
re-explorar o código.

## 1. Decisões fechadas (05/11)

| # | Tema | Decisão |
|---|---|---|
| 1 | Falência no Hard (empréstimo de 24 semanas, 1 por carreira) | Manter |
| 2 | Números do empréstimo e investidor só no Easy | Manter |
| 3 | Multas dos sponsors Bold | Manter |
| 4 | EU no Normal | Manter |
| 5 | Snowball no topo | Sem orçamento de salários agora. A receita extra a partir da S4 vale só para Major/Worlds e cotações altas novas; a bateria mede o p90 de caixa dos dominantes |
| 6 | Isenção da vaga vazia com bônus | Manter o comportamento atual |
| 7 | Banda do DEV-04 | Manter a largura; o potencial real passa a ficar em posição uniforme (seeded) dentro da banda, não sempre nos 3 pontos de cima |
| 8 | Elenco veterano | Aviso de aposentadoria agora. Uma reconstrução mais barata só se a bateria mostrar necessidade |
| 9 | Cena local | Já segue uma curva própria; nada a fazer |
| 10 | Tunáveis provisórios (química/XP de scrim, poach, piso 0.88, faixa 77–84) | Manter; a bateria aponta se algum precisa mexer |
| 11 | Ritmo do álbum | Manter. A carta vem no fim da run, como as outras |
| 12 | "New" entre dispositivos | Fica no dispositivo, sem sync |
| 13 | Daily Quiz e Daily Challenge | Ficam se o teste do CH-03 passar |
| 14 | ECO-06, venda ativa e troca | Por enquanto não |
| 15 | Event cards | A definir (Miguel) |
| 16 | Deltas de Season Rating | A definir (Miguel) |
| — | Dificuldade de Worlds/Major | **Worlds mais difícil que o Major**, só como **teste** na bateria (por spy, sem patch). A bateria anterior não viu necessidade e Miguel concorda. A alavanca vai para o código só se o teste justificar |
| — | Rejogabilidade | Contrato escrito primeiro (F5). Miguel aprova antes do código |
| — | AdSense | Depois do 2.0, atrás de uma flag e fora das telas de jogo. Antes: banner de consentimento (EEA/UK), CLS, política de fan content da Epic e o acordo 50/50 |

## 2. Fatos verificados no código (rc.36.10)

- **Bootcamp** dura o split inteiro (`balance.ts:2482` `bootcampSpan "split"`;
  `careerFlow.ts:4839-4845`; expira em `careerFlow.ts:1046-1050`). Pega o
  qualifier e o regional, e o sábado e o domingo de Major/Worlds. Problemas:
  - Comprado com um Major/Worlds em andamento, ele não chega ao domingo,
    porque o time está congelado (`careerFlow.ts:2885-2910`, `3181-3186`;
    `runBootcampFlow` não tem guarda de `activeEvent`).
  - `tempRatingMax 2.0` (`balance.ts:2494`) só limita o bootcamp
    (`worldSim.ts:706`); a instrução do coach soma por cima
    (`sunday.ts:69-76`), e T2 + Recover = 2,10.
  - O comentário em `balance.ts:2484-2486` está velho (diz +1.0; o T2 é 1.75).
- **Instruções do coach** (`balance.ts:3218-3223`, `sunday.ts:51-91`,
  `SundayCard.tsx:163-174`) são keep +0.10/+0.10, recover −0.15/+0.35 e
  prepare +0.35/−0.15 (swiss/playoffs). Valem cerca de 1–4 pp por série; o
  bootcamp T2 vale cerca de 17 pp. Problemas:
  - No Championship Sunday, Recover domina e Prepare é só um debuff.
  - O texto ainda cita o Swiss.
  - "Estudar o adversário" não tem lógica de adversário. O copy
    `effectPrepareVs` existe e está morto (`copy.career.en.ts` ~2494).
  - Não há preparação por tier.
  - O comentário em `careerFlow.ts:3177` está errado: keep dá +0.10.
- **Catálogo**: `market.ts:97` `LISTING_CAP 120`. Os free agents são
  completados até `LISTING_MIN_SIGNABLE 24` (`:148-153`); os contratados não
  (`:167`). Teto de overall: `economy.ts:528`, `71 + 0.4 × rep`.
  `signableCapFreeAt 84` não tem efeito (o teto já chega a 99 em rep 70).
- **Valorização** (`economy.ts:352-360, 500, 513`):
  - O fator de potencial trava num gap de 15 (`min(1.3, 1+0.02×gap)`), então
    70/85 = 70/98.
  - Idade: u18 ×0.9 contra ×1.1 em 19–22. O `DevelopmentProfile` não entra.
  - A taxa do contratado vai de 0.85× a 1.6× do valor (`splitsRemaining`
    aleatório).
  - Não há trava contra revenda.
  - As propostas que chegam só aparecem em janelas, ignoram o caixa
    (`careerFlow.ts:1427`) e no máximo 2 por janela.
- **Renovação** (`renewal.ts:66-122`): `min(fresh, max(1.75×old, min(0.6×fresh,
  2.5×old)))`, depois ambição ×1.25, Blockbuster ×1.1 e títulos até +30%.
  Um prospect formado renova por uma fração do mercado.
  **Bug**: a janela de 2 seasons do prêmio por títulos é na prática 1,
  porque `eventResults` é zerado na virada (`careerFlow.ts:3781`).
- **Empréstimo**: dispara com a segunda-feira abaixo de −8 semanas de folha.
  Os avisos de runway (8/4 semanas) dependem de um saldo semanal recorrente
  negativo, então um gasto grande único estoura sem aviso. Não existe
  crédito voluntário.
- **Prêmios**: as pools base são major 150k e worlds 600k, com índice
  1.15^s e reconciliação no campeão (`prizeScheduleFor`). As cotações de
  sponsors seguem o mesmo índice. Não há ajuste de dificuldade por tier
  (`worldSim.ts:838`, `opponentRatingShift` único).
- **Endless**: sem lógica econômica própria. A falência relatada pelo amigo
  não foi reproduzida (precisa do save dele).
- **Histórico**: o save guarda só o campeão de Worlds por season
  (`history`, `types.ts:1280-1298`) e as estatísticas do usuário. Não há
  regionais/Majors da IA nem títulos por jogador, e o repo não tem dados de
  títulos reais.
- **Legacy do Draft**: latch `legacyUnlocked` no profile v12. Para a
  carreira já existe `profile.careerWorldsWon` (sincronizado por max), que
  pode ser o gatilho sem campo novo.

## 3. Frentes

Regras de economia de tokens para todas:
- Ler só a sua seção e os arquivos listados, por faixa de linhas.
- Testes alvo enquanto itera; `npm test` completo uma vez, antes do commit.
- Nada de `npm run build`.
- Não ler shards JSON da bateria; usar os scripts de resumo.
- Escrever um handoff de no máximo 15 linhas em
  `docs/HANDOFF-rc37-<frente>.md` (sem editar STATUS/ROADMAP/CHANGELOG).
- Novos tunáveis num bloco próprio do `balance.ts` (`// rc.37 <frente>`).
  Não atualizar o fingerprint do `BALANCE_VERSION`; a integração faz isso.
- Sem bump de versão, sem push, sem merge. Commit no próprio branch;
  Miguel revisa.

### Rodada 1 — em paralelo (worktrees)

**F1 — Mercado, valorização e renovações** (sessão própria; a maior)
Branch `claude/rc37-market`. Dono de: `market.ts`, as funções de valor/salário
de `economy.ts` (`ageFactorFor`, `potentialFactorFor`, `marketValueFor`,
`contractedFeeFor`, `computeSalaryAsk`), `renewal.ts` e a geração da banda
DEV-04.

Pacotes, nesta ordem:
1. **Catálogo dos contratados**: os 120 de topo continuam visíveis (estrelas
   incluídas); completar com opções compatíveis com a reputação até haver
   pelo menos 24, quando existirem, espelhando o que os free agents já
   fazem. Preços, janelas e regras ficam iguais. Remover ou documentar o
   `signableCapFreeAt` morto.
2. **Valorização por talento**:
   - fator de potencial em faixas (promissor ≠ excepcional, sem saturar no
     gap 15);
   - a idade jovem não pode baratear um talento;
   - o `DevelopmentProfile` entra no preço;
   - a mesma função vale para compra, venda e salário de free agent;
   - trava de revenda: não vender quem foi contratado na mesma janela nem na
     seguinte, ou um deságio equivalente;
   - a IA dá mais interesse (peso de proposta) a talentos de potencial alto.
3. **Renovações**: proteção inicial preservada, mas a renovação de um
   jogador desenvolvido se aproxima aos poucos do valor de mercado (por
   exemplo, o piso sobe a cada season desde a contratação). Controlar os
   extremos do topo. Corrigir a janela de 2 seasons do prêmio por títulos
   (guardar contagem por season, aditiva, sem depender de `eventResults`).
4. **Banda DEV-04**: posição do potencial real uniforme dentro da banda,
   seeded, com a largura atual.

Verificação: testes unitários de valor por perfil (70/85 vs 70/98, 17 vs 21
anos), um teste anti-flip (comprar e vender na mesma janela não dá lucro) e
os testes atuais de mercado/contrato/renovação verdes.

**F2 — Finanças e crise** (sessão própria)
Branch `claude/rc37-finance`. Dono de: prêmios/sponsors e
folha/empréstimo/runway em `economy.ts`, a parte de folha e empréstimo de
`careerFlow.ts`, um módulo novo `emergencySale.ts` e a UI de finanças/HQ da
carreira. **Não editar** as funções de valor da F1; chamar `marketValueFor`
como está.

Pacotes:
1. **Receita tardia** a partir da 4ª season (`seasonIndex >= 3`, deixar a
   chave explícita): pool de Major +15%, Worlds +25%, cotações **novas** de
   sponsors tier 3–4 +10%. Contratos assinados são preservados. Conferir a
   distribuição por colocação.
2. **Crédito voluntário** antes do piso automático: uma oferta clara (líquido,
   total a devolver, prazo) quando o risco fica visível. O piso de −8 fica.
   Não usar −4 (já testado e reprovado).
3. **Venda de emergência**: com caixa negativo, propostas extras a 65–80% do
   valor, também fora das janelas, com limite de frequência. As propostas
   normais continuam. Sem venda durante torneio, e a tela mostra o líquido
   depois da dívida, o salário liberado e quem sai. A trava de revenda da F1
   vale também aqui (no handoff, apontar o ponto de ligação).
4. **Avisos**: alerta para um gasto grande único que leve abaixo do piso.
   Visão consolidada no fechamento da season: nova folha depois das
   renovações, dívida, prazo, caixa até a próxima receita importante e
   aposentadorias previstas (decisão 8).

Verificação: testes de economia/empréstimo/sponsors (`careerLoan`,
`careerSponsors`, `careerContract`), a distribuição de prêmios na S3 vs S4 e
um caso negativo recebendo uma proposta de emergência.

**F3 — Dia de jogo** (sessão pequena; dá para usar um modelo mais barato)
Branch `claude/rc37-matchday`. Dono de: `sunday.ts`, `careerSunday.ts`,
`SundayCard.tsx`, `CAREER_SUNDAY` no `balance.ts`, as chaves de briefing em
`copy.career.en/pt.ts`, `runBootcampFlow` e `worldSim.ts:706`.

1. **Briefing de sábado** com uma troca real entre Swiss e playoffs.
2. **Championship Sunday**: opções próprias de playoffs, sem citar o Swiss
   e sem opção dominada. Em Major/Worlds, uma "análise internacional"
   (preparação específica).
3. **"Estudar o adversário"** de verdade: um bônus contra o adversário de
   abertura, usando o copy morto `effectPrepareVs`.
4. **Valores**: subir as magnitudes para algo perceptível (alvo: a melhor
   escolha vale cerca de 5–8 pp por série contra cerca de 1–4 hoje), medido
   pela curva `cupSeries`.
5. **Bootcamp**: comprado com um evento em andamento, aplica ao time
   congelado ou bloqueia a compra com explicação. O `tempRatingMax` passa a
   cobrir bootcamp + briefing. Corrigir os comentários velhos.

Verificação: testes de sunday/bootcamp e um teste de que nenhuma opção é
dominada em cada estágio.

**F4a — Ferramenta da bateria humana** (pequena; pode ir no mesmo chat que F5)
Branch `claude/rc37-battery`. Arquivos novos em `src/store/audit*` (testes
opcionais, `HUMAN_AUDIT=1`), copiados de
`Downloads/Rocket_Draft_RTW_Evidencias_2026-11-04.zip` → `source/final/`.
- Perfis a acrescentar:
  - só prospects;
  - conhecidos/estrelas;
  - trader;
  - compra-tudo;
  - upgrades de coach;
  - variações de briefing.
- Variante por spy: **Worlds com +x de rating adversário acima do Major**,
  sem patch.
- Um script de resumo que imprima **só** o funil-alvo por região ×
  dificuldade × elenco × perfil:
  - 1ª vitória de série;
  - regional;
  - Swiss;
  - playoffs;
  - Major;
  - título de Major;
  - Worlds;
  - título de Worlds;
  - mais falências e o p90 de caixa.

  O baseline é o próprio zip, sem rerodar.

Não rodar a matriz inteira nesta rodada; só um smoke de 2–3 carreiras.

**F5 — Contrato de rejogabilidade** (só docs; mesmo chat que F4a)
`docs/RTW-REPLAY-CONTRACT.md` com opções e recomendação para:
- a tabela de títulos (regionais/Majors/Worlds por time e jogador, a
  posição do seu time), com um histórico novo e aditivo no save, contando a
  partir da fundação, a menos que Miguel forneça dados reais;
- o desbloqueio pós-Worlds, no padrão do Legacy, com o gatilho
  `careerWorldsWon`;
- carreiras com regras (academia, teto de folha, restrições históricas),
  dinastia, nova geração, passaporte regional, conquistas e cosméticos;
- sem bônus de força entre carreiras.

Miguel aprova antes do código.

**B — Etapa 4 fora da carreira** (sessão própria, opcional nesta rodada)
O prompt de 04/11 (Challenges CH-01/02/03, UI-01a, UI-01, UI-02a/b), com as
decisões 11–16 acima. Não toca a carreira.

### Rodada 2 — integração e bateria

1. **Integração** (uma sessão): merge de F1 → F2 → F3 → F4a em
   `claude/rc37-integration`.
   - Ligar a venda de emergência à trava de revenda.
   - Recalcular o fingerprint uma vez e subir o `BALANCE_VERSION`.
   - Gates completos.
   - Juntar os handoffs no CHANGELOG/STATUS.
2. **Bateria** (um chat ultracode, um agente por shard, no máximo 3
   processos em 8 GB): a matriz completa no branch integrado, mais a
   variante Worlds > Major. Saída: só o relatório do funil, comparado com o
   baseline do zip.

### Rodada 3 — ajuste fino e rejogabilidade

- **F6, ajuste**: a partir do relatório, mexer só nos gargalos medidos:
  - início frustrante;
  - ponte Regional → Major em EU/NA;
  - rotas estagnadas (conhecidos);
  - itens de progressão (nerf/buff; um item caro de endgame só se houver
    benefício real depois dos caps);
  - Worlds > Major só se o teste justificar.

  Rerodar só as células afetadas.
- **F5, implementação**, depois da aprovação do contrato; pode correr junto
  com a F6 (arquivos diferentes).

### Rodada 4 — playtest

Miguel e os amigos jogam o branch integrado (local, `npm run dev`). As
correções voltam como uma ou duas frentes. Depois, push para `staging`.

## 4. Quantos agentes

| Rodada | Sessões em paralelo | Observação |
|---|---|---|
| 1 | F1, F2, F3, F4a+F5 (e B opcional) = 4–5 | F3 e F4a+F5 são pequenas |
| 2 | 1 integração, depois 1 bateria (ultracode) | A bateria é CPU, não tokens |
| 3 | F6 + F5-impl = 2 | |
| 4 | Miguel + 1 de correções | |

Total: cerca de 4 rodadas até o push para staging.

## 5. Ainda com Miguel

- O save do amigo não vem: a falência no endless fica coberta pelos avisos e
  pelo crédito voluntário da F2, e pelos casos longos da bateria.
- As decisões 15–16 (event cards, deltas de Season Rating).
- A aprovação do contrato F5.
- O §6 A–E do V2 plan (contas/cutover), sem mudança.
