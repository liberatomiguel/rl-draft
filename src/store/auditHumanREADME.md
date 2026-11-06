# F4a — ferramenta da bateria humana (rc.37)

Suporte de teste, nunca importado pelo app. Bot e quatro perfis-base copiados de
`Rocket_Draft_RTW_Evidencias_2026-11-04.zip/source/final/`; extensões isoladas em
`auditHuman*`. Nenhum valor de balanceamento foi alterado. Não copiar os patches
dos experimentos antigos para o produto.

## Rodada atual

- Só três carreiras executadas: SAM/Normal/prospects/prospectsOnly/9100;
  EU/Hard/journeymen/continuous/17019; APAC/Easy/balanced/novice/31337.
- Horizonte S10, com continuação normal após título. Zero softlocks; duas
  carreiras chegaram a S10 com primeiro Worlds em S8; EU/Hard faliu em S6 por breach.
- Três casos sintéticos de exploit separados das carreiras: revenda na mesma
  janela bloqueada; saldo negativo não cria venda de emergência; desconto de
  renovação reproduzido. Sem conclusão populacional ou patch de balanceamento.
- Baseline: ler a pasta `baseline` já extraída do zip; nunca rerodar.
  Os 315 registros dessa pasta não são as 611 runs de todos os experimentos do zip.

## Comandos (PowerShell, a partir do repo)

Extrair o zip em uma pasta temporária **fora** do repo. `$auditDir`, `$baselineDir`
e `$summaryFile` abaixo devem apontar para caminhos externos; não versionar shards,
fixtures, logs, manifests gerados ou o zip. Escolher pasta nova ao mudar código.

```powershell
# Smoke opt-in: default seguro, exatamente três carreiras planejadas.
$env:HUMAN_AUDIT='1'
$env:HUMAN_MODE='smoke'
$env:HUMAN_DIR=$auditDir
node node_modules/vitest/vitest.mjs run src/store/auditHuman.test.ts

# Só planejar a rodada 2: não simula nenhuma carreira.
$env:HUMAN_MODE='matrix'
$env:HUMAN_PLAN_ONLY='1'
node node_modules/vitest/vitest.mjs run src/store/auditHuman.test.ts
# manifest.json e plan.json ficam em HUMAN_DIR. Não executar a matriz nesta rodada.

# Resumos: apenas leitura de evidências; funcionam sem HUMAN_AUDIT.
node src/store/auditHumanSummary.mjs --input $auditDir --out $summaryFile
node src/store/auditHumanSummary.mjs --input $baselineDir --out $baselineSummaryFile
```

A execução completa futura exige remover `HUMAN_PLAN_ONLY` e manter
`HUMAN_MODE=matrix` conscientemente. Plano padrão: 41 perfis × 7 regiões × 3
dificuldades × 3 elencos × 2 seeds × 3 variantes × 2 horizontes = **30.996
carreiras planejadas**, 464.940 seasons máximas. É um plano amplo, não um comando
rápido. Pode ser repartido em manifests por coorte antes de agendar a rodada 2.
`HUMAN_MANIFEST` lê um array de `HumanCell`; seeds, dimensões, duplicatas e limites
são validados. Smoke recusa manifests com mais de três células.

Sharding futuro: `HUMAN_SHARDS=N`, `HUMAN_SHARD=0..N-1`, uma pasta compartilhada
para os shards do mesmo plano; não usar dois processos no mesmo shard. A ordem
do manifest define a partição. Escrita por arquivo temporário + rename. Retomada
exige mesmos commit, hashes da ferramenta/perfis/manifest, modo e partição;
recusa misturar versões, e não considera uma carreira com softlock concluída.

Exploit opt-in, sem carreiras completas: `HUMAN_EXPLOITS=1` e
`HUMAN_EXPLOIT_DIR` externo, executar `auditHumanExploits.test.ts`. Limpar essas
variáveis e `HUMAN_AUDIT` para a suíte comum. `auditHumanTools.test.ts` e
`auditHumanSummary.test.ts` são pequenos testes de contrato, sem simular carreiras.

## O que o protocolo mede

Perfis: núcleo fundador, prospects, conhecidos, estrelas, venda/reinvestimento,
troca contínua, compra de progressão, coach fixo/upgrades, experiente/iniciante;
coortes de um fator para seis buffs de estilo, objetivos/cargas/focos/scrims e
preleções. A matriz cruza cada perfil com todas as dimensões e ambos os seeds.
O gestor decide por dados públicos (faixa scouted, rating e condições visíveis),
não pelo potencial oculto. Reposição emergencial fora da idade de prospects é
registrada; venda depende de proposta real da IA. Não há venda ativa artificial.

Worlds: controle `worldsExtra=0`, pares `+0.5` e `+1` só nos adversários do Worlds,
por spy de `worldSim.fieldForEvent`, restaurado inclusive em erro. Major fica
intacto. O alvo são os eventos do usuário, não reponderar Worlds da IA em todo o
calendário. `spyApplications=0` indica que não houve exposição ao teste.
Incrementos são hipóteses do protocolo, não novos tunáveis de gameplay.

O horizonte S20 repete o mesmo seed/política para seguir a mesma trajetória após
S10; não fornece título nem dinheiro. Relatar separadamente quem não ganhou e
quanto tempo realmente foi observado depois do título. Não somar coortes S10/S20
como observações independentes; não misturar controle e variantes.

Resumo por região/dificuldade/elenco/perfil/coorte/variante/horizonte: primeira
série vencida, regional, entrada no Swiss e primeira vitória no Swiss, playoffs,
Major/título, Worlds/título; evolução anual de colocações e séries; falências e
causas; dias negativos, empréstimos; caixa S1–3 e p90 dos dominantes; folha anual
vs prêmio líquido + sponsor líquido nas seasons completas S6+; aquisições e
efeitos marginais reais da engine após caps. Mantém denominadores, seeds e
exposição/censura, sem imprimir shards. Não usa datas-alvo como asserts de vitória.

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
