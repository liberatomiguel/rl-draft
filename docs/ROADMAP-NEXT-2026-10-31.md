# Rocket Draft 2.0 — próximos pacotes após rc.36.4

Este documento revisa o planejamento solicitado no chat. A referência é o
roadmap vigente, reconciliado com o anexo rc.29 em
`ROADMAP-REVIEW-2026-10-31.md`. Não autoriza executar o backlog nesta sessão.

## O que esta rodada fecha

- A auditoria da cobertura dos testes: agora há comparação das 63 combinações
  dificuldade × elenco inicial × região, compras reais e suplemento de prospects.
- Benefícios maiores dos itens avançados existentes, medidos separadamente
  de classificação e de títulos: Centro, bootcamp estruturado e psicóloga.
- Scrims maiores/empilhadas com escudos e placar; notícias com identidade
  jornalística diferente da caixa de entrada.

Não fecha o aceite de progressão: ainda não há título de Worlds nas carreiras
históricas desta amostra; o regional continua cedo em parte dos caminhos.
Os replays mostram efeito dos bônus, sem comprovar a chance desde a fundação.
O relatório `CAREER-ENDGAME-rc36-4.md` separa essas conclusões.

## O que já existe e não precisa ser reconstruído

O circuito competitivo e os fins de semana; crescimento/idade/potencial;
treino de 28 dias, scrims e coaches; sponsors, contratos, crédito e inflação;
mercado com operação atômica de elenco; HQ, calendário, escudos, metas e feed;
álbum, formação, descoberta separada de coleta e indicadores de novidade.
Esses sistemas têm código e testes. Parte do trabalho restante é validar
integração/ritmo com saves e jogadores reais, além das features ainda abertas.

## Pacote 1 — fechar progressão e economia da carreira

Continua no Gate 3b. Usar cenários comparáveis, sem reabrir toda a arquitetura:

1. Construir/medir três rotas: desenvolver prospects; manter e reconstruir
   equilibrados/veteranos; vender e contratar uma estrela. Incluir contratos
   renovados e pelo menos uma contratação 88/90+ realmente viável, não só
   tentativas de compra recusadas.
2. Medir o motivo de não comprar os itens finais: reputação, caixa,
   pré-requisito ou decisão. Comparar prioridade de equipamento contra
   prioridade de elenco e compra seletiva de bootcamp, com anos ruins.
3. Ajustar somente os gargalos demonstrados de salário/receita/gate e o
   timing regional. Preservar o ritmo de crescimento sem novo nerf global.
4. Repetir as rotas viáveis em mais seeds, por dificuldade/região, e jogar
   casos salvos de início, S3–4 e S5–6. Incluir não classificados/falências
   nas conclusões. Não validar só uma seed que ganhou.

Saída: evidência de que as rotas têm decisões sustentáveis e acesso ao
endgame no tempo desejado; avaliação humana da dificuldade. O objetivo
Worlds S4–6 precisa ser plausível, sem título garantido por data. Os novos
desbloqueios sugeridos são opcionais; só entrar após um contrato de escopo
e benefício, caso os sistemas existentes não atendam ao objetivo.

## Pacote 2 — restante da Etapa 4

- Challenges variados; provar cada estrela com um draft real, pré-requisitos
  corretos e recompensa única. Decidir e testar Daily Challenge/Quiz, reset,
  tentativas, idioma e recompensas.
- Preview da recompensa de cada rank, redesign do login diário, revisão
  individual de banners e alinhamento de badges nos tamanhos reais.
- Validar ritmo de completar o álbum, novidades entre dispositivos e evento
  de descoberta. A coleção já feita não deve ser implementada de novo.
- Revisar XP/Season Rating/recompensas; cards/arte/elegibilidade pendentes e
  regressão dos modos regionais. Venda ativa/troca continuam decisão aberta.

Saída: progressão e recompensas alcançáveis, concedidas uma vez e com
persistência correta; aceite de jogo no staging. Não reduzir P1 implicitamente.

## Pacote 3 — acabamento integrado e preparação de lançamento

Etapa 5, depois do aceite anterior:

- Tutorial/novidades da 2.0; revisão EN/PT/mobile, corpus de notícias e arte.
- Calibração final do Draft e carreira, cenários de regressão reproduzíveis;
  performance medida/CWV/Lighthouse e SEO das URLs reais.
- Notas de lançamento e material/permissão da parceria 50/50. A marca atual
  permanece até acordo; publicar conteúdo não substitui autorização do parceiro.
- Antecipar o ensaio de migração/rollback em cópias e validar contas/sync,
  multiaba/multidispositivo e recuperação com saves reais, não só sintéticos.

Saída: um RC integrado estável e uma lista objetiva de requisitos externos
de lançamento, sem misturar preparação com publicação em produção.

## Virada — Etapa 6

Datas/estado da Season, freeze/snapshot, grants/recompensas únicas,
Supabase/Cloudflare e checklist final. O roteiro existente deve ser executado
e verificado; sua existência não comprova que SQL/configuração já aconteceram.
Publicação em produção somente depois dos aceites e da verificação final.

## Quantas sessões faltam?

**Eu planejaria três sessões de trabalho, mais a janela de virada se
necessária:** balanceamento/economia; progressão/recompensas; acabamento e
regressão integrada. A configuração externa, os saves reais disponíveis e
os playtests podem exigir uma sessão adicional. É uma estimativa por pacotes,
não uma promessa de duração: o primeiro ainda pode revelar ajustes necessários.

Uma única sessão extra não é uma estimativa responsável mantendo as
pendências atuais. Para encurtar o caminho: lista única com critério de aceite,
casos salvos reutilizáveis, resolver integridade antes de polimento e não
acrescentar sistemas opcionais enquanto o arco existente estiver aberto.

FIFAe/EWC, forma temporária e modificador extra de Worlds seguem propostas.
Não foram iniciados aqui, assim como as Etapas 4–6.
