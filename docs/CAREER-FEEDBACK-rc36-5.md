# Rocket Draft rc.36.5 — ajustes do playtest

Base: staging rc.36.4 (`1f7069f`). Escopo: os ajustes pedidos no chat,
incluindo o caso informado **SAM / Normal / prospects**. Não inicia outra
etapa do roadmap nem encerra o aceite de balanceamento.

## Interface e reprodução

- **Notícia:** volta à tipografia do jogo. Cabeçalho, editoria, data, escudo
  e detalhe azul diferenciam a notícia do e-mail, dentro da identidade atual.
- **Partidas:** relógio, gols, intervalos e transições de RTW têm cerca de
  25% mais tempo em 1×. O seletor 1×/2×/4× continua disponível; resultados
  e RNG competitivo não dependem desses tempos de apresentação.
- **HQ:** Avançar é primário; Pular até é secundário azul; +1 dia é terciário.
- **Scrims:** a seleção automática prioriza adversários ainda não enfrentados
  naquela semana. Há 15% de chance de permitir o pool completo, que pode
  repetir; se não houver parceiro novo, o rematch continua possível. Mantém
  a dificuldade escolhida e a exclusão de rematches no mesmo dia. Escolhas
  explícitas/agendamentos do jogador são respeitados.
- **Ciclo de treino:** Continuar é primário e repete o plano que acabou,
  inclusive quando o coach já iniciou outro. Alterar é secundário e abre a
  edição diretamente. A operação não paga a conclusão nem a sessão duas vezes.
  A caixa “não mostrar novamente” salva a preferência; o histórico permanece
  acessível, e a aba Treinos permite reativar os avisos. Ocultar o aviso não
  altera as regras de delegação ou inicia sozinho um plano sem coach.
- **Campeonatos:** Resultado instantâneo é secundário azul. No Swiss como
  espectador, jogos ficam à esquerda e classificação à direita; no celular,
  empilhados. Nome/escudo abre o elenco no evento e no resultado, inclusive
  o próprio time, equipes locais e as chaves. O placar permite inspecionar
  a série. A reprodução pausa enquanto a ficha do elenco está aberta.
- **Coach bloqueado:** cadeado/requisito destacados, corpo cinza e atenuado,
  contratação desabilitada. Itens de progressão já comprados não exibem botão
  Comprar, nem no card nem nos detalhes; camps já usados também não.

## Patrocínios no mesmo prazo

A causa encontrada no código era uma comparação entre contratos de durações
diferentes: Estável 6 splits, Equilibrado 3 e Ousado 1. Novas ofertas passam
a **3 splits / uma temporada em todos os perfis**. Assim, o potencial total
fica em ordem Estável < Equilibrado < Ousado, com diferenças de metas, bônus
e multas. O total possível não é garantia de recebimento líquido: falhar
metas num contrato de risco pode render menos que escolher o Estável.

Os testes varrem tiers, dificuldades, seasons e faixas de valor no mesmo
prazo. Contratos e ofertas legados guardam os termos registrados; testes
explícitos preservam os antigos contratos de dois anos e de um split.

## Premiações em degraus

A bolsa de cada campeonato segue o índice nominal da season, arredondado
em passos por categoria, e cresce em toda virada de season. Cada colocação
também sobe pelo menos um passo de pagamento. Bolsas e parcelas são
reconciliadas: **a soma do que os participantes recebem é exatamente a
bolsa anunciada**, sem valores fracionários gerados pelo crescimento composto.

Passos de bolsa: comunidade $250, invitational $1.000, qualifier $400,
regional $5.000, Major $10.000, Worlds $50.000. Os qualifiers precisam dividir
a bolsa entre dois grupos de oito; o passo respeita essa divisão. Pagamentos
individuais usam passos de $50, $100, $500 ou $1.000 conforme a categoria.
O arredondamento significa que o aumento efetivo de um ano não é exatamente
15%, embora o índice nominal continue sendo essa referência.

Resultados/lançamentos já registrados não são recalculados. Os modos de
rollback `rc31` preservam suas tabelas e regras anteriores, cobertos por teste.

## Progressão: a cena local acompanhava o jogador

A força dos locais era congelada durante a season, mas recalculada a cada
ano em torno do elenco atual do jogador. Assim, parte da evolução perdia
efeito relativo quando começava a season seguinte.

Agora guardamos a referência original da cena local, com desenvolvimento
de **até 1,5 ponto por season**, sem acompanhar integralmente cada upgrade
do elenco. O primeiro ano continua igual; orgs reais e regras de dificuldade
permanecem com suas curvas próprias. O ajuste não aumenta overall/potencial
do usuário nem concede classificação por data.

**Saves existentes:** a força já congelada na season atual e os campos em
andamento permanecem. A próxima virada usa a referência disponível desse
save. A mudança não reconstrói temporadas antigas nem recupera retroativamente
a referência inicial que um save antigo já perdeu.

### Comparação ampla

63 pontos de partida por variante: **3 dificuldades × 3 elencos × 7 regiões**,
uma seed por célula, três seasons, política de manter/desenvolver o elenco
com compras reais de estrutura/coach/camps quando cabem no caixa. São
**126 carreiras**, sem recursos ou força concedidos artificialmente.

Controle e candidato usam as mesmas novas regras de patrocínio, prêmio e
scrim da rc.36.5. **A única diferença dessa comparação é o rebase anual dos
locais versus a curva própria.** Não é uma comparação de toda a rc.36.4
contra toda a rc.36.5. As linhas completas da primeira season foram
idênticas nos **63 pares**.

| Dificuldade, 21 inícios por variante | Rebase anual | Curva própria |
|---|---:|---:|
| Fácil: chegaram ao regional até S2 | 21/21 | 21/21 |
| Normal: chegaram ao regional até S2 | 18/21 | 21/21 |
| Difícil: chegaram ao regional até S2 | 18/21 | 18/21 |
| Fácil: chegaram ao Major até S3 | 6/21 | 7/21 |
| Normal: chegaram ao Major até S3 | 3/21 | 6/21 |
| Difícil: chegaram ao Major até S3 | 1/21 | 6/21 |

Não melhora toda trajetória individual: no Difícil, classificados ao regional
até S3 foram 19 → 18. As mudanças nos resultados também mudam pontos e campos.
Houve duas insolvências no Difícil por variante e nenhuma no Fácil/Normal
nessa janela; zero softlocks. Uma seed por célula não estima taxas humanas.

### Caso SAM / Normal / prospects

Mais quatro pares predefinidos, seis seasons históricas, mesma política:
**oito carreiras adicionais**. Os primeiros regionais ocorreram nos splits
2, 2, 4 e 3 em ambas as variantes; não reproduziram a ausência de regional
até o fim de S2 relatada pelo Miguel. Sem o save real, não atribuímos aquele
caso exclusivamente a este mecanismo.

| Seed | Primeiro Major com rebase | Primeiro Major com curva própria |
|---|---|---|
| 9100 | S6 | S4 |
| 17019 | S6 | S4 |
| 24938 | Não chegou em S1–6 | S6 |
| 32857 | S4 | S4 |

Chegaram ao Worlds em 1/4 → 4/4 carreiras; nenhuma ganhou o título.
Nenhuma faliu. É evidência de acesso mais sustentável ao circuito, não
aprovação final da dificuldade. O timing regional ainda varia e o título
mundial continua sem curva validada; Gate 3b permanece aberto.

## Verificação e reprodução

- Suíte completa: **1.463 aprovados**, 18 verificações opt-in ignoradas.
- Tipagem/lint aprovados; dados regenerados sem mudança semântica,
  45 validações aprovadas. Export estático com carreira ligada e noindex,
  contas/analytics desligados.
- Interface: **189 verificações**, EN/PT, desktop e mobile, sem erros de
  execução/hidratação, mais **4 verificações** de pausa/retomada do relógio
  ao abrir/fechar um elenco. Evidência da publicação no pacote de verificação.
- Requests: Classic 62/75 e home fria 27/28, desktop e mobile.

Probe: `FEEDBACK=1 FEEDBACK_SLICE=0/4` a `3/4`, `FEEDBACK_OUT=<json>`,
`npx vitest run src/store/careerOpeningFeedback.probe.test.ts`.
Suplemento: `FEEDBACK_REGIONS=SAM FEEDBACK_DIFFS=normal
FEEDBACK_ROSTERS=prospects FEEDBACK_SEEDS=4 FEEDBACK_SEASONS=6`.
Variantes pareadas são executadas dentro de cada processo; primeira season
e identidades são conferidas no relatório. Dados são sintéticos, não saves
reais do usuário. Fixtures do navegador não são evidência de balanceamento.
