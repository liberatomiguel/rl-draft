# Rocket Draft 2.0 — plano após rc.36.6

Base: `staging` em rc.36.5 (`ec2f60b`), roadmap vigente e ajustes pedidos em
03/11/2026. Esta rodada é um pacote de correções do Gate 3b, publicado como
rc.36.6. A versão 2.0 final continua dependendo dos gates restantes.

## O que esta sessão entrega

- Avanço do calendário coerente com decisões pendentes; relatório de treino
  oculto continua/reinicia o plano; práticas na terça e quarta com transmissão
  curta; datas de campeonatos continuam visíveis após a eliminação.
- Hierarquia dos cards de campeonatos sem participação, marcadores azuis em
  toda a janela, destaque para melhorias e apresentação do bootcamp.
- Notícias oferecidas pelo 50/50, com o logo enviado; separação editorial
  entre feed e e-mail; revisão EN/PT e limpeza de avisos sem valor editorial.
- Convites para showmatches do 50/50 e duds, Copa da Comunidade 50/50 e
  torneios ocasionais de 1v1/2v2 com escolha de participantes. Eventos
  aleatórios semanais só depois do primeiro regional.
- Catálogo único regional de nomes: 834 jogadores e 280 organizações.
  As quatro exclusões da planilha foram respeitadas. Os nomes podem aparecer
  em qualquer contexto nas novas carreiras; a distribuição por seed evita
  duplicatas na mesma partida. Cinco nomes coincidem com profissionais reais
  e usam II; três homônimos de regiões diferentes recebem a sigla regional.
  As identidades de saves anteriores ficam preservadas.

Não há nesta rodada uma nova medição da curva financeira ou de títulos.
Os relatórios rc.36.3–5 continuam sendo a evidência dessas pendências.

## Próxima sessão — fechar progressão e economia do Road to Worlds

Esta é a sessão que recomendo iniciar com o próximo agente, após experimentar
o rc.36.6. O objetivo é fechar o Gate 3b, sem abrir outra rodada ampla de telas.

1. Trabalhar com três rotas comparáveis: desenvolver prospects; renovar e
   reconstruir um elenco equilibrado/veterano; vender para contratar uma estrela.
2. Demonstrar que ao menos uma contratação 88/90+ é financeiramente viável,
   com salário, renovação, bônus e custos de estrutura realmente pagos.
3. Identificar os bloqueios concretos aos itens finais: reputação, caixa,
   pré-requisito ou opção de investimento. Ajustar apenas gargalos demonstrados.
4. Verificar ritmo de primeiro regional/Major e possibilidade de vencer
   Worlds nas temporadas 4–6, com anos ruins e derrotas na amostra.
   A vitória não pode ser garantida por data.
5. Reutilizar seeds, saves e relatórios existentes. Ampliar simulações apenas
   quando os dados anteriores não responderem à alteração feita. Terminar
   com poucos cenários jogáveis de início, S3–4 e S5–6 e o aceite de Miguel.

**Prompt sugerido para o próximo chat:**

> Continue o Rocket Draft a partir do último staging/rc.36.6. Leia AGENTS.md,
> STATUS.md, ROAD-TO-WORLDS-STATUS.md e ROADMAP-NEXT-2026-11-03.md. Feche o
> Gate 3b de progressão/economia: compare prospects, reconstrução e compra de
> estrela; resolva apenas gargalos comprovados de reputação, receita, salário
> e acesso ao endgame. Reutilize a evidência existente, sem repetir matrizes
> extensas sem necessidade. Preserve o ritmo de crescimento e a dificuldade
> das partidas. Publique o RC em staging, registre a evidência e o que preciso
> jogar para aprovar. Não avance para a Etapa 4 nem publique em produção.

## Sessão seguinte — Etapa 4: coleção, desafios e recompensas

Depois do aceite do Gate 3b:

- Desafios variados, cada estrela alcançável em um draft real, pré-requisitos
  corretos e recompensa concedida uma vez. Decisão final sobre Daily Challenge
  e Daily Quiz, com reset, tentativas, recompensas e PT.
- Ritmo do álbum, descoberta versus coleta e marcadores de novidade entre
  dispositivos. A coleção já implementada não deve ser reconstruída.
- Preview das recompensas de rank, login diário, alinhamento de badges e
  revisão individual dos banners. Revisão de XP/Season Rating e cards pendentes.
- Resolver explicitamente se venda ativa/trocas continuam fora da 2.0.

Saída: Gate 4 com casos reais, persistência correta e aceite no staging.

## Terceira sessão de trabalho — Etapa 5: RC final integrado

- Tutorial e novidades da 2.0, textos EN/PT e mobile, arte/corpus restantes.
- Calibração final a partir de problemas demonstrados, desempenho e SEO nas
  URLs reais. Conferir os fluxos integrados afetados pelas etapas anteriores.
- Notas de lançamento e apresentação da parceria 50/50. A marca no feed,
  os convites e a copa já foram implementados no rc.36.6.
- Ensaio de migração e rollback em cópias de saves reais; contas e sync,
  multiaba/multidispositivo e concessões únicas de recompensa.

Saída: Gate 5 aceito e lista curta de pendências externas de lançamento.

## Quarta sessão — virada e publicação da 2.0

Executar a Etapa 6 e `V2-IMPLEMENTATION-PLAN.md` §6–8: datas da Season,
freeze/snapshot, SQL e grants no Supabase, variáveis de Cloudflare,
migração/rollback e checklist final. Publicar em produção somente após o
aceite final e confirmar o deploy; acompanhar saves, recompensas e erros.

## Estimativa de sessões restantes

**Planejamento: quatro sessões depois desta** — três de desenvolvimento e
validação, mais a virada. Reservaria uma quinta se a curva de carreira ainda
precisar de outra rodada ou se contas/migração dependerem de acesso e saves
reais indisponíveis. É uma estimativa de escopo, não uma garantia de prazo.

Para manter esse caminho curto: fechar o aceite de cada pacote antes de abrir
outro, reutilizar fixtures e evidências, e separar defeitos que impedem a
2.0 de novas ideias para versões futuras. Nenhuma pendência P0/P1 é removida
implicitamente para fazer a estimativa caber.
