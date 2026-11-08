# CH-01 / CH-02 / CH-03 — revisão rc.36.16

Pedido de Miguel em 07/11/2026: revisar todas as challenges, corrigir estrelas impossíveis ou sem prova, expandir formatos e catálogo, manter seeds fixos e publicar em staging. Base: rc.36.15 (`c680a89`). O código local da carreira rc.37 não integra este pacote.

## Entrega

**45 desafios, 135 estrelas**: os 27 IDs anteriores são preservados, com 18 adições. São 32 confrontos, seis gauntlets e sete Laboratórios de Draft. Os novos desafios incluem APAC/SSA/MENA/OCE, trios internacionais, reencontros de clube, Zen/kuxir97/Squishy como capitães, travessias de várias séries e puzzles de montagem sem partida.

Laboratório de Draft tem um objetivo principal de elenco e duas condições extras. O resultado usa os números visíveis e não simula partida. Há puzzles com ofertas fixas, sem rerolls pagos, e um puzzle avançado com ofertas abertas e seed fixo. Países distintos, mesma organização em eras diferentes, química, temporada e faixas de overall criam decisões diferentes.

O catálogo permite filtrar o formato. Títulos, briefing e condições estão em EN/PT; objetivos ficam visíveis durante o draft e a revisão. O corte de dados continua em RLCS 2026 para conservar as ofertas calibradas. Elencos 2027 do Draft normal ficam preservados.

## Diagnóstico e prova de possibilidade

O teste anterior montava um elenco e simulava 200 partidas com **outros estados de RNG**. Isso não demonstrava uma vitória no jogo real, onde o RNG continua do draft. Além disso, estrelas de composição eram excluídas da checagem e o harness informava zero rerolls usados sem contar os rerolls reais.

Uma auditoria inicial de 600 caminhos legais por desafio encontrou zero caminhos para a estrela de química de Topple the Titans, zero vitórias em Perfect Storm e zero caminhos para a estrela de temporada de Time Capsule. Isso não é uma prova exaustiva de impossibilidade; expõe a ausência de um caminho demonstrado e de uma margem de jogabilidade adequada.

A nova regra exige um **caminho legal de três estrelas para cada desafio**, mantendo o RNG do início do draft até o resultado. O arquivo `src/engine/__fixtures__/challenge-solutions.json` guarda escolhas e rerolls; os testes rejeitam cartas não oferecidas, rerolls gratuitos ilegais e elencos incompletos. Os 45 caminhos são reproduzidos tanto no motor quanto pelo `runStore`, com serialização/recarga no meio, persistência das estrelas e tentativa repetida sem novo pagamento. Gauntlets precisam vencer todas as etapas; Labs não podem receber objetivos dependentes de partida.

**135/135 estrelas têm prova reproduzível.** Isso demonstra possibilidade dentro das regras; não é uma previsão de taxa de sucesso humana nem substitui o aceite de dificuldade de Miguel. As políticas usadas na calibração veem as cartas da oferta e atributos públicos, e não alteram o RNG do jogo. As soluções humanas completas, com nomes e resultados, são spoilers em [CHALLENGE-SOLUTIONS-rc36-16.md](CHALLENGE-SOLUTIONS-rc36-16.md).

## Ajustes nas challenges anteriores

Os 27 desafios foram mantidos. A variedade aumentou com conteúdo aditivo, preservando as recompensas cosméticas e máscaras já conquistadas. Os ajustes abaixo usam seeds fixos; não há reroll aleatório de seed por tentativa.

| Desafio | Alteração |
|---|---|
| The First Final | Shift do boss 0 → −4 |
| Old Guard | Shift −4 → −2; estrela de overall do time 84 → 88, considerando os bônus de montagem |
| Old School | Shift −1 → −3 |
| Vive la France | Shift −3,5 → −7,5 |
| No Stars | Shift −5,75 → −7,75 |
| Raw Talent | Seed 32581 → 32783 |
| Carry the Rookie | Shift −4,5 → −6,5 |
| The Emerald Wall | Shift −2 → −4 |
| Topple the Titans | Seed 37196 → 37398; shift −8 → −4; condições de underdog e química Great mantidas |
| Perfect Storm | Shift −5 → −11; estrela de overall do time 88 → 92; cap individual 90 e zero rerolls pagos mantidos |
| Rookie Road | Shift 1,25 → −0,75 |
| World Tour | Shift −9,75 → −11,75 |
| Pure Talent | Shift 5 → 1 |
| Time Capsule | Seed 63490 → 65308; shift −1,75 → −7,75 |

Os demais 13 mantêm seed, shift e condições. Nenhuma estrela ou data de conclusão existente é retirada.

## Daily Quiz / Daily Challenge

- Quiz: as cinco pistas são distribuídas pelas três tentativas (2 → 4 → 5 na escada normal). A pista decisiva está disponível **antes** do último palpite. O nome do país é localizado.
- Uma resposta após o encerramento não concede XP, não altera contadores e não emite novamente o evento de missão. O fechamento do dia também é idempotente no motor.
- Todos os jogadores elegíveis podem ser respondidos pelo nickname ou ID. A comparação normalizada de zen/ZeN antes escolhia sempre o primeiro cadastro e tornava o ZeN da Oceania impossível pelo nickname. Texto digitado aceita o nickname da resposta; sugestões escolhidas mantêm o ID da pessoa e mostram seu país, distinguindo os homônimos.
- Um palpite de uma aba com a data anterior é recusado. Home e Quiz atualizam a data na virada UTC e quando a aba volta ao foco.
- Daily Challenge mantém uma tentativa oficial por data UTC. A restrição é aplicada no início, na concessão do perfil e no fechamento de uma run antiga restaurada, impedindo repetição de XP/rating/missões/eventos de Hunt.
- Testes cobrem acerto na 1ª/2ª/3ª tentativa, falha, recarga, merge de progresso com um resultado encerrado, meia-noite UTC, seeds/ofertas independentes do rank, reinício e recompensa única. A lista de pools e a identidade menu/run continuam verificadas por 730 datas.

Os dois modos permanecem no produto após essas verificações. O protocolo geral de sync e a concorrência entre abas de convidados não foram redesenhados.

## Verificação

- Provas de solução: 45 replays no motor e 45 replays no store; cada um com três estrelas. A repetição confirma a mesma partida e zero XP adicional.
- Regressão final: **1.615 testes aprovados, 20 opcionais pulados, 137 arquivos aprovados**, com dois workers e sem alterar limites. Tipos e lint passam. O primeiro full run teve 1.613 testes aprovados e um timeout de varredura de arquivos em `careerDecisions.test.ts`; os 26 testes do arquivo passaram isoladamente, e a execução completa final passou integralmente.
- Export estático aprovado: 1.814 arquivos, 939 URLs de imagens verificadas, contas/analytics desativados e carreira ativa no build isolado de staging. O cache de tipos do preview foi limpo antes do build final. Os hashes de assets coincidem com a base; não há mudanças de imagens neste pacote.
- QA real no navegador: catálogo e filtro em EN/PT, 320px sem rolagem horizontal/imagens quebradas; briefing, draft, revisão e resultado de Lab. Topple the Titans foi jogado carta por carta, com recarga após o terceiro titular: **4–0 e três estrelas**. Quiz manteve as tentativas após recarga e foi resolvido no terceiro palpite com as cinco pistas visíveis, pagando 50 XP. Sem erros de console nesses fluxos.
- O fixture temporário de perfil usado no navegador foi removido antes do build; não existe uma rota de QA na publicação.
- Sem alterações em `src/engine/career`, `src/store/career*`, `balance.ts`, fingerprint, dados de jogadores/elencos, chaves/versões de saves, configuração de contas ou ambiente de produção.

## Playtest de aceite

1. Testar Topple the Titans e Perfect Storm com escolhas próprias; conferir se as estrelas são compreensíveis e a dificuldade é adequada.
2. Comparar um Lab introdutório com Passport Control, Balancing Act e Draft Masterclass. Verificar o objetivo principal, a composição e as estrelas em tentativas separadas.
3. Jogar um gauntlet curto e Final Bosses; perder uma etapa deve encerrar a tentativa sem prêmio indevido.
4. Repetir um desafio já concluído: o progresso anterior deve continuar e apenas estrelas novas devem pagar.
5. Conferir Daily/Quiz em PT e mobile; o Quiz não pode voltar a aceitar palpites após o encerramento.

Este pacote entrega CH-01/02/03 para o playtest no staging. Gate 3b da carreira, demais itens de Etapa 4 e aprovação de produção continuam abertos.
