# Hierarquia visual das recompensas — rc.36.19

Feedback de Miguel em 08/11/2026, aplicado sobre rc.36.18 no clone isolado.

- Challenges bloqueadas: brasão maior, rank, cadeado e estado explícito, superfície azul escura e barras nas condições numéricas. Rank e pré-requisitos continuam obrigatórios; a prévia abre o briefing e o store continua impedindo o início bloqueado.
- Banners épicos/lendários: dois/três brilhos suaves, com ciclos de oito/seis segundos. Pintura estática com animação apenas de opacidade; arte, anéis e órbita preservados. Fora da tela, em efeitos reduzidos e em linhas densas do ranking, os acentos param.
- Login: badges de 36 px, banners de 64 px e títulos com seu visual real nas células. O dia 30 tem uma faixa com badge de 48 px, banner de 144 px e título. XP e progresso ficam fixos; a abertura leva ao dia recebido da sequência. Conferidos os dias 30 (+475 XP) e 31 (+75 XP, 30/30 checks), sem concessão por visualizar a grade.
- Perfil: destaque de 56 px e demais slots de 44 px no mesmo centro vertical; coleção com arte de 64 px e três/quatro colunas. Removidas partículas individuais da grade ampliada, mantendo brilho/holo; o tamanho anterior não ativava essas partículas extras.
- Catálogo unificado: uma tabela com 106 linhas, 89 itens existentes e 17 propostas. Estado, tipo, raridade, condição e disponibilidade estão na mesma tabela. Nenhuma proposta foi implementada.

Revisão visual: desktop 1280×720 e celular 320×900 sem transbordamento horizontal. Centros dos três slots medidos iguais. Efeitos reduzidos: zero camadas móveis e zero acentos de raridade visíveis. Rota temporária de QA removida antes da validação final.

Regressão: 1.997 testes aprovados, 22 auditorias opcionais ignoradas; lint, TypeScript e export aprovados. Export com 1.950 arquivos e 50,90 MB; contas/analytics desligados, carreira ligada. A medição inicial com partículas adicionais na coleção ficou em 79/34 ms/s; a grade foi otimizada antes da publicação.

Motor, regras de desbloqueio, seeds, persistência, catálogo de recompensas e código/store de carreira permanecem iguais à base.

Probe final: perfil 66 ms/s (limite 80), ranking 18 ms/s (limite 60), zero falhas de composição.

Lighthouse 13.6.0: acessibilidade 100/100 nas entradas perfil/login e Challenges. As propostas da tabela unificada continuam apenas documentadas.
