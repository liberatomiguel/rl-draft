# Revisão visual — rc.36.18

Feedback de 08/11/2026 aplicado no clone isolado, sobre a rc.36.17 publicada.

- Login diário: um único calendário, XP total recebido e progresso do ciclo. Cada marco mostra a arte e o nome das recompensas; os dias recebidos têm check. O dia atual tem borda laranja. Progresso deriva da sequência atual, nunca de itens já possuídos em outro ciclo. Calendário com três colunas no celular, seis no desktop, rolagem interna e ação fixa.
- Challenges: overlay escuro restaurado, com título, rank, pré-requisito e alternativas de marco. Abrir mostra o briefing; o store continua impedindo o início bloqueado.
- Overdrive: uma única textura em uma única camada. As duas fases SMIL originais viravam dez pares de elipses idênticas no raster; agora são dez elipses únicas. A expansão segue o foco original (746,96).
- Cosmic Ascension: órbita separada da nebulosa e das estrelas. Só os grupos orbitais originais giram, com o período original de 140 s e foco (766,74). O restante respira em opacidade; não gira o banner inteiro. Texturas WebP em produção, sem SMIL/filtros ao vivo; efeitos reduzidos conservam a arte completa parada.
- Rank up: transição entre ranks, cosméticos conquistados com arte e nome, desbloqueios em lista e botão claro. Saltos incluem os ranks intermediários. A chance de especial mostra o novo total, em vez de apresentar o aumento como se fosse o total.
- Perfil: slots 50/44/44 px no mesmo centro vertical e espaçamento de 4 px. Coleção exibe todas as badges possuídas; removido o teto fixo de 15. Trilha mostra as 11 recompensas nos oito nós de rank, com arte/nome antes de selecionar um nó.
- Catálogo: 89 itens, sendo 51 obtidos jogando, oito manuais e 30 históricos. `COSMETICS-CATALOG-PT.md` contém a tabela completa. `COSMETICS-PROPOSALS.md` contém apenas propostas para discussão.

## Evidência

Revisão em desktop 1280×720 e celular 320×900; sete dias recebidos de 30, sem transbordamento horizontal. Slots das três badges medidos com o mesmo centro vertical e gaps de 4 px. Overlay avançado com rank, pré-requisito e alternativa de 90 estrelas/Worlds legíveis. Capturas no diretório de outputs do chat.

1.997 testes aprovados, 22 auditorias opcionais ignoradas; lint, TypeScript e export estático aprovados. A rota temporária de QA foi removida antes da validação final. Export: 1.949 arquivos, 50,90 MB, contas/analytics desligados e carreira ligada. Motor, seeds, regras dos cosméticos, persistência e código/store da carreira preservados.

Probe de produção: perfil 53 ms/s (limite 80), ranking 12 ms/s (limite 60), zero falhas de composição. Lighthouse 13.6.0: acessibilidade 100/100 nas entradas perfil/login e Challenges. A dificuldade das Challenges e seus 365 diários não foi retocada nesta revisão visual.
