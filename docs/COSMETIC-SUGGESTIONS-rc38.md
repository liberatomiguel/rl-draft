# Sugestões de cosméticos — NÃO implementadas

> **Substituído na rc.51 (12/11/2026).** Miguel revisou esta lista em 11/11 e 16
> itens foram implementados, com nomes e tipos alterados (ver
> `docs/PENDING-COSMETICS.md` e `docs/COSMETICS-CATALOG.md`). O texto abaixo é
> o registro histórico da proposta original.

Seleção recomendada: quatro recompensas para challenges, uma de composição
no Classic e seis marcos RTW. As restantes são alternativas para escolher,
não um pedido para cadastrar tudo. Nenhum ID ou recompensa foi criado para
estas sugestões. Exclusive fica reservado a concessão manual.

| Nome | Tipo | Raridade | Condição precisa proposta | Diferencial visual |
|---|---|---|---|---|
| Titanbreaker | Badge | Épico | Conquistar as três estrelas de Topple the Titans (`ch-topple-the-titans`), conforme as metas já definidas no challenge; concessão única | Escudo partido, três pontos de luz e silhueta de gigante |
| Eye of the Storm | Banner | Épico | Três estrelas de Perfect Storm (`ch-perfect-storm`) | Arena sob tempestade, faixa central clara para manter legibilidade |
| Crown Taker | Title | Raro | Três estrelas de European Crown (`ch-gauntlet-eu-crown`), encerrando toda a série | Cinza com pequeno detalhe azul, sem competir com títulos épicos |
| Masterclass | Banner | Épico | Três estrelas de Draft Masterclass (`ch-lab-masterclass`) | Prancheta tática com três trajetórias convergentes |
| One Flag | Title | Incomum | Vencer uma run Classic normal, fora de Daily/Challenges/region lock; três titulares, técnico e reserva com o mesmo código de nacionalidade não vazio. Org não entra na condição; qualquer dificuldade Classic | Tipografia sóbria, detalhe de faixa; sem usar bandeira de um país específico |
| On the Grid | Title | Comum | Primeira classificação no RTW do qualifier para o regional principal; fundar org já qualificada não conta | Cinza discreto |
| Regional Laurels | Badge | Raro | Primeiro título de regional principal no RTW; qualifier, torneio tier 3 e final perdida não contam | Louros com uma pequena estrela azul |
| Passport Stamped | Banner | Raro | Primeira vaga matematicamente confirmada em Major RTW ao fechar a classificação do split; contar a vaga, sem exigir jogar o Major | Passaporte/embarque abstrato, detalhes azuis |
| Major Statement | Badge | Raro | Primeiro título de Major no RTW; concessão única entre saves | Troféu azul, sem coroa de Worlds. Se preferir Épico, manter a mesma condição e elevar o acabamento |
| From Day One | Title | Épico | Vencer Worlds RTW com os mesmos três titulares registrados no início do split 1 daquela temporada; qualquer mudança de titular desde então invalida, mesmo que o jogador volte. Contratos, treino, staff e banco podem mudar | Gradiente violeta com três traços contínuos. Requer registrar os três IDs e um marcador de troca |
| Clean Sweep | Banner | Raro | Vencer Classic com seis slots preenchidos, sem perder série durante Swiss e playoffs; Daily, Quick e Challenges excluídos | Quadro de placar limpo, marca de 3–0 discreta |
| Perfect Circuit | Badge | Épico | Conquistar três estrelas em cada uma de três gauntlets: European Crown, World Tour e Final Bosses. Recompensa única; não exige mesma sessão | Três arcos de arena conectados; alternativa a mais recompensas individuais |
| Home and Away | Title | Raro | Ganhar uma run Classic em cada um dos cinco region locks já jogáveis: NA, EU, SAM, MENA e OCE; qualquer dificuldade, apenas vitórias completas | Cinco pequenos traços; não atrelar a regiões ainda indisponíveis |
| Regional Dynasty | Banner | Épico | Na mesma temporada e com a mesma org RTW, ganhar todos os regionais principais dos três splits e vencer Worlds; qualifiers não contam | Três faixas regionais convergindo para uma coroa |

Para reduzir o volume: escolher **Titanbreaker + Eye of the Storm + Crown Taker
+ Masterclass** como única expansão de challenges nesta rodada. Perfect Circuit
é uma alternativa de longo prazo, não precisa entrar junto. Conferir conquistas
existentes antes de escolher Clean Sweep/Home and Away para evitar duplicidade
de propósito. O cosmético Homegrown já existe para um challenge específico;
One Flag é deliberadamente uma run Classic com técnico e reserva incluídos.

Todas as condições futuras devem ter fatos persistidos idempotentes e ser
testadas entre reloads e saves; aqui são apenas decisões propostas, sem novos
contadores, fatos, artes, IDs ou concessões no código.
