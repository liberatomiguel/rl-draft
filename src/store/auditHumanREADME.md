# Bateria humana (rc.37) — ferramenta de teste

Suporte de teste, nunca importado pelo app. Bot e quatro perfis-base copiados de
`Rocket_Draft_RTW_Evidencias_2026-11-04.zip/source/final/`; extensões isoladas em
`auditHuman*` (F4a). Na integração rc.37 o bot passou a usar as opções reais de
F2/F3 e o runner virou o plano de coortes abaixo. A ferramenta não altera nenhum
valor de balanceamento. Não copiar os patches dos experimentos antigos para o
produto.

## Rodada 2 (rc.37)

- Bateria rodando em 4 shards a partir de `claude/rc37-integration`, com
  `HUMAN_DIR=C:/Users/Miguel/CLAUDE/rc37-battery/run1`. Resultados e relatório
  pendentes.
- O smoke da F4a (3 carreiras, base rc.36.10) é histórico: `docs/HANDOFF-rc37-F4a.md`.
- Baseline: ler a pasta `baseline` já extraída do zip; nunca rerodar. Os 315
  registros dessa pasta não são as 611 runs de todos os experimentos do zip.

## Plano de coortes (`HUMAN_MODE=matrix`)

`humanCohortPlan`: 7 regiões × 3 dificuldades × 3 elencos × 39 perfis distintos ×
2 seeds (9100, 17019) = **4.914 controles**, todos até S10. Dos 41 perfis,
`style-consistency` e `briefing-adaptive` têm a mesma política efetiva de
`coachUpgrades` (`profileAliases`): jogados uma vez, reportados como alias e nunca
contados como réplicas.

| Tier | Perfis | Seed | Além do controle |
|---|---|---|---|
| A | 14 base | 9100 | pares Worlds +0.5/+1; extensão até S20 se campeão de Worlds até S10 |
| B | 14 base | 17019 | pares Worlds +0.5/+1 |
| C | 25 de um fator | 9100 | — |
| D | 25 de um fator | 17019 | — |

A ordem (tier → dificuldade → região → elenco → perfil) e a partição round-robin
fazem qualquer prefixo cobrir as células por igual. Um par nasce de um clone do
controle na manhã do primeiro Worlds do usuário: mesmo seed e mesmo passado, só o
tratamento muda. Sem Worlds até S10, a linha do par sai com `exposed: false` (não
é resultado). A extensão S20 continua a mesma carreira a partir do próprio S10,
sem rejogar S1–S10. Substitui o plano plano de 30.996 carreiras da F4a
(`humanMatrix`, mantido só como referência e teste de contrato).

## Comandos (PowerShell, a partir da raiz do worktree)

`HUMAN_DIR` deve ser absoluto e fora do repo; não versionar shards, logs, planos,
manifests ou o zip.

```powershell
# Plano completo: um terminal por shard (HUMAN_SHARD 0..3), mesma pasta.
$env:HUMAN_AUDIT='1'; $env:HUMAN_MODE='matrix'
$env:HUMAN_SHARDS='4'; $env:HUMAN_SHARD='0'
$env:HUMAN_DIR='C:/Users/Miguel/CLAUDE/rc37-battery/run1'
node node_modules/vitest/vitest.mjs run src/store/auditHuman.test.ts
```

Git Bash, mesma coisa (`i` = 0..3):

```bash
HUMAN_AUDIT=1 HUMAN_MODE=matrix HUMAN_SHARDS=4 HUMAN_SHARD=i HUMAN_DIR=C:/Users/Miguel/CLAUDE/rc37-battery/run1 node node_modules/vitest/vitest.mjs run src/store/auditHuman.test.ts
```

Opcionais: `HUMAN_TIERS=A,B` (só esses tiers, sem mudar a partição: depois dá para
seguir com C/D na mesma pasta), `HUMAN_LIMIT=n` (no máximo n unidades nesta
execução), `HUMAN_PLAN_ONLY=1` (grava `plan.json` e `identity-i.json`; não simula).
Medido: ~38–45 s por carreira S10; o plano inteiro ≈ 16 h em 4 processos.

Por shard, em `HUMAN_DIR`: `identity-i.json` (protocolo `rc37-human-v2`, hash da
simulação, BALANCE_VERSION, hashes dos perfis e do plano, partição; o commit fica
registrado mas não bloqueia), `shard-i.jsonl` (uma linha por carreira: `coverage`
= controle, com `forkAt`; `worldsPair`, com `exposed` e `spyApplications`;
`endless`, com `extendedFrom`; `error`), `done-i.txt`, `progress-i.json` e, se
houver, `softlocks-i.json` (o shard falha no fim).

Retomada: o mesmo comando na mesma pasta pula o que está em `done-i.txt` e corta a
linha parcial que um processo morto deixar. Uma parada por orçamento de tempo
(10 min por carreira S10, o dobro na extensão S20) não conta como feita e é
refeita; softlock e erro ficam gravados e contam como feitos. A retomada recusa
mudança na simulação (hash dos .ts/.tsx/.json/.mjs de `src/engine`, `config`,
`data`, `lib` e `store`, sem testes e sem `auditHumanSummary*`, fim de linha
normalizado), no plano, nos perfis, no BALANCE_VERSION ou na partição: aí, pasta
nova. Docs e o resumo podem mudar durante a rodada. Nunca dois processos no mesmo
shard.

Outros modos: `HUMAN_MODE=smoke` (padrão) joga as três carreiras do smoke;
`HUMAN_MANIFEST` (array de `HumanCell`; seeds, dimensões e duplicatas validados)
usa o formato antigo `shard-i.json`. Nesses dois a retomada exige o mesmo commit;
o smoke recusa mais de três células.

Resumo: `node src/store/auditHumanSummary.mjs --input <pasta> --out <arquivo>`
(só leitura, funciona sem `HUMAN_AUDIT`). Lê apenas `shard-N.json` (smoke,
manifest, baseline do zip): o JSONL do plano de coortes ainda precisa de leitor
para o relatório da rodada 2.

Exploits (opt-in, sem carreiras completas): `HUMAN_EXPLOITS=1` e
`HUMAN_EXPLOIT_DIR` externo, rodar `auditHumanExploits.test.ts` (grava
`exploits.json`). No jogo integrado: revenda bloqueada na janela da contratação e
na seguinte; saldo negativo não gera oferta de emergência para contratação
travada (a primeira legal vem da janela 2, a ~68% do valor); um 90/98
desenvolvido renova a 1,3% do pedido de mercado (2.500 vs 191.750 por split; 1,4%
e 1,2% na 2ª e 3ª renovação). Limpar essas variáveis e `HUMAN_AUDIT` para a suíte
comum. `auditHumanTools.test.ts` e `auditHumanSummary.test.ts` são testes de
contrato (plano, aliases, spy, marginais), sem simular carreiras; os testes de
fork e de extensão determinísticos só rodam com `HUMAN_AUDIT=1`.

## O que o protocolo mede

Perfis: núcleo fundador, prospects, conhecidos, estrelas, venda/reinvestimento,
troca contínua, compra de progressão, coach fixo/upgrades, experiente/iniciante;
coortes de um fator para seis buffs de estilo, objetivos/cargas/focos/scrims e
preleções. O plano cruza cada perfil distinto com todas as dimensões e ambos os
seeds. O gestor decide por dados públicos (faixa scouted, rating e condições
visíveis), não pelo potencial oculto. Reposição emergencial fora da idade de
prospects é registrada; venda depende de proposta real da IA, inclusive a oferta
de emergência da F2. Não há venda ativa artificial.

Decisões F2/F3 por perfil: crédito do banco (`credit`: take / lastResort / never;
lastResort só quando nenhuma oferta em mãos cobre a soma), ofertas de emergência
(`emergencySale`: accept / whenTight / decline; venda planejada nunca aceita o
desconto), preleção `adaptive` (Championship: favorito → pico na grande final,
senão vencer as primeiras rodadas; Regional: entre os 4 mais fortes por rating
mostrado → recuperar, senão estudar o Swiss; sem coach contratado não há
preleção, como na F3), o alerta de gasto da store após cada ação e os modelos de
banda e de crescimento do F1 nas leituras de mercado. A memória do gestor (um
upgrade por janela, uma venda por split/season) sobrevive às cópias diárias da
política. O bot só responde a avisos e ofertas reais do fluxo; nunca dimensiona
nem inventa empréstimo ou venda.

Worlds: o controle é a própria carreira (`worldsExtra=0`); os pares `+0.5` e `+1`
(tiers A/B) sobem só os adversários do Worlds, por spy de
`worldSim.fieldForEvent`, restaurado inclusive em erro. Major fica intacto. O alvo
são os eventos do usuário, não reponderar Worlds da IA em todo o calendário.
`spyApplications=0` indica que não houve exposição ao teste. Incrementos são
hipóteses do protocolo (Worlds mais difícil que o Major só como teste, 05/11),
não novos tunáveis de gameplay.

S20: só controles do tier A com título de Worlds até S10 seguem até S20 (linha
`endless`); a ferramenta não fornece título nem dinheiro. Relatar separadamente
quem não ganhou e quanto tempo realmente foi observado depois do título. A linha
S20 é a mesma carreira estendida: não somar S10/S20 como observações
independentes; não misturar controle e variantes.

Resumo por região/dificuldade/elenco/perfil/coorte/variante/horizonte: primeira
série vencida, regional, entrada no Swiss e primeira vitória no Swiss, playoffs,
Major/título, Worlds/título; evolução anual de colocações e séries; falências e
causas; dias negativos, empréstimos; caixa S1–3 e p90 dos dominantes; folha anual
vs prêmio líquido + sponsor líquido nas seasons completas S6+; aquisições e
efeitos marginais reais da engine após caps. rc.37 acrescenta: química e herança
do trio por season, renovação vs pedido de mercado, reputação e prêmio por evento,
nível salarial do mercado na primeira visita de janela e a profundidade do
negativo em semanas de folha. Mantém denominadores, seeds e exposição/censura, sem
imprimir shards. Não usa datas-alvo como asserts de vitória.

Efeitos de gear/staff são contrafactuais no mesmo estado, medidos na aquisição e
semanalmente com plano ativo. Ganho de treino considera os caps atuais e separa
XP completo do ciclo e pago ao longo dele; não promete causalidade de vitórias.
Também grava marginais de cada atributo: zero no rating não significa zero
efeito da psicóloga. Essa medição foi acrescentada após o smoke; seus campos
ausentes nas três carreiras antigas ficam null, sem rerodar ou inventar valores.
Marginais individuais com interações não devem ser somadas como um bônus conjunto.

Schema 1 (zip): primeira vitória pode ter precisão só de season; tempo negativo
é amostragem de segundas, não dias exatos; consumíveis repetidos e efeitos pós-cap
não foram gravados e aparecem como indisponíveis, sem estimativas inventadas.
