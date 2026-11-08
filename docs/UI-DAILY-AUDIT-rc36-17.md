# UI-01/01a/02 e modos diários — rc.36.17

Pedido de Miguel em 07–08/11/2026: conferir volume/coerência dos diários e quizzes, ampliar a progressão das challenges, entregar UI-01/02 e publicar no staging. Base: rc.36.16 (`f9b654a`). O trabalho local da carreira rc.37 continua separado.

## Volume e possibilidade

**Daily Challenge:** 11 modelos e variações de região, época, visibilidade, rerolls, especiais e objetivos. A rotação futura usa os 11 modelos em cada ciclo de 11 dias, com dias Normal entre Hard/Legacy. Há **365 seeds distintas revisadas**, de **09/11/2026 a 08/11/2027 UTC**. Cada data tem um caminho legal que vence o torneio **e** conquista o bônus na mesma tentativa.

Não basta trocar o RNG apenas na partida. O calendário guarda a seed do draft inteiro, as escolhas e os rerolls; a simulação continua desse mesmo cursor. Os 365 caminhos passam pelo `runStore`, com recarga após a terceira ação, cartas realmente oferecidas, resultado campeão, bônus e recompensa única. A escolha de um caminho de autoria nunca entra no RNG do jogo. Nenhum solver é entregue ao jogador.

A primeira auditoria encontrou dias sem vitória demonstrada nas políticas amostradas, incluindo todos os Legacy e bônus de azarão. Isso não era prova exaustiva de impossibilidade, mas invalidava uma alegação de jogabilidade verificada. A correção tem dois componentes: calibração **somente dos diários** e seeds inteiras com prova de vitória+bônus. 195 datas conservam a seed FNV original; 170 recebem uma seed revisada. Todas permanecem fixas e iguais para todos os perfis. O caminho mais demorado de autoria examinou 1.051 drafts legais; esse esforço não estima a taxa de sucesso humana.

Os shifts exclusivos do Daily são Normal −2, Hard −4, Legacy −8 e Underdog −6, em `DAILY_CHALLENGE`. **BALANCE_VERSION 14**, fingerprint atualizado. Nenhum valor anterior de Classic/Quick, química ou carreira foi modificado. O bônus futuro de baixo total de gols sofridos vira chegar aos playoffs: uma derrota curta não deve ser vantajosa. O texto de 88 OVR agora diz “no máximo”, como a comparação já implementava.

O início em 09/11 UTC preserva as regras e seeds de datas já publicadas e as runs em andamento. Fora do ano revisado, a geração continua determinística, mas **não tem a mesma prova de possibilidade**: ampliar o calendário antes de novembro de 2027 e repetir as provas quando dados/regras mudarem.

**Daily Quiz:** **259 jogadores elegíveis**, com pelo menos duas aparições. Um baralho embaralhado com seed fixa visita todos antes de repetir: mais de oito meses de respostas diferentes. A primeira rotação começa em 09/11/2026 UTC; datas anteriores conservam a resposta escolhida. As pistas continuam derivadas da base, com todas disponíveis antes do último palpite.

A auditoria semântica encontrou ambiguidades Espeon/Pluto e Burn/mikan: nacionalidade, carreira, teammate e carta de pico podiam apontar para mais de uma pessoa. Quando isso ocorre, uma pista curta com o início do nickname desfaz o empate. As 259 escadas completas identificam uma única resposta, verificadas com quatro variações de teammate; nickname e ID continuam respondíveis. Não foi preciso reduzir o catálogo.

## Progressão das challenges

Continuam **45 desafios / 135 estrelas, oito ranks**, de Bronze (200 XP) a Supersonic Legend (60.000 XP). Os 27 IDs anteriores e as 18 adições de rc.36.16 conservam seeds, objetivos, prêmios e soluções. Conclusões existentes nunca voltam a ficar bloqueadas.

Os 17 desafios avançados/novos abaixo do introdutório recebem marcos. Rank e pré-requisito nomeado são obrigatórios; dentro de uma lista de marcos basta um. A carreira oferece uma alternativa ao progresso de Draft, sem se tornar uma parede obrigatória.

| Exemplo | Rank | Marco adicional |
|---|---|---|
| Pacific Breakthrough / African Frontier | Silver | Concluir um desafio |
| Desert Rising | Gold | Regional no RTW **ou** três desafios |
| Global Alliance | Gold | Três quizzes resolvidos **ou** três desafios |
| Oceania After Dark | Diamond | Regional no RTW **ou** oito desafios |
| Club Reunion | Diamond | Regional no RTW **ou** 24 estrelas |
| Squishy’s Supporting Cast | Diamond | Classificar para Major no RTW **ou** oito desafios |
| Zen and the Art | Champion | Major no RTW **ou** oito desafios perfeitos |
| Desert Crossing | Champion | Major no RTW **ou** 15 desafios |
| Final Bosses | Supersonic Legend | World Tour antes; Worlds no RTW **ou** 12 desafios perfeitos |
| Draft Masterclass | Supersonic Legend | Perfect Link antes; Worlds no RTW **ou** 90 estrelas |

Os Labs formam uma escada First Link → Passport/Time Machine → Balancing Act/Club Architect → Perfect Link → Masterclass. Kuxir pede Old School. Os marcos de carreira já eram persistidos e sincronizados em `careerMarks`: não houve importação do store da carreira, nova versão de save ou migração.

O predicado é compartilhado pelo catálogo, marcação NEW e início da run. Antes, só a interface impunha rank/pré-requisito; agora o store também recusa o início bloqueado. Cards bloqueados são prévias legíveis e mostram progresso. O briefing mantém o botão de início desabilitado enquanto faltar uma condição. Foi verificado no navegador: Desert Rising bloqueado com 1/3 desafios, liberado ao adicionar o marco Regional ao perfil de QA. Uma prova de fechamento confirma que todos os 45 abrem pelo caminho de Draft, sem depender de quizzes ou carreira e sem ciclos.

## UI-01 / UI-01a

- XP recebido é o destaque: total, parcela diária e bônus de marco. Nenhum dos 30 dias esconde XP, incluindo os marcos.
- Selecionar uma data mostra seus itens, nomes, raridade e arte. O calendário não concede prêmios; apenas apresenta o resultado do motor.
- Desktop coloca detalhes e calendário lado a lado. Mobile empilha as informações; cabeçalho, fechar e continuar ficam acessíveis com rolagem interna.
- Dia 1: +25 XP. Dia 30: +475 XP, três cosméticos e calendário completo. Dia 31: +75 XP, sem repetir o bônus do dia 30. EN/PT, detalhes e continuidade verificados.
- Os oito ranks do Season Tracker são selecionáveis, com os 11 itens reais da trilha e suas condições. O texto antigo de encerramento estava obsoleto: decisão #131/rc.20 já paga os itens ao alcançar o rank. A apresentação foi corrigida; o momento do grant não mudou.
- A auditoria Lighthouse encontrou rótulos customizados diferentes do XP visível, baixo contraste do token secundário e links do rodapé distinguíveis só pela cor. Os botões agora usam nomes derivados do conteúdo; o token secundário foi clareado e os links ficam sublinhados.

## UI-02

**35 badges:** revisão em 28/44/64 px, mais integração de First Chapter no armário e slot de destaque do perfil mobile. O slot tem dimensões constantes e alinhamento vertical explícito. O build centra os limites opacos da arte útil, excluindo halos; a antiga média de alpha deslocava escudos em direção aos adornos mais pesados. A correção de posição agora acompanha imagem, máscara e glow juntos. Não houve redesenho da arte de origem.

**18 banners:** revisão em tamanho de perfil, miniatura e versão estática. O gerador mantinha uma animação de grupo, mas descartava as figuras dentro dele; animações em gradientes também se perdiam. Isso retirava parte importante do movimento de Cosmic Ascension. A extração agora conserva essas figuras. O SVG animado fica como referência de autoria; a camada usada no jogo é uma textura transparente estática, rasterizada em WebP no build e animada apenas por transform/opacity no CSS.

Overdrive também tinha a geometria móvel gravada na imagem estática, duplicando anéis. Cada banner animado agora tem uma base estática sem as figuras móveis e uma camada móvel separada; ambas são WebP em produção. Overdrive tem dois pulsos defasados, lendários têm órbita e brilho mais presentes, chamas têm oscilação própria. Com efeitos reduzidos, volta a arte completa parada. Ambas as camadas usam exatamente o mesmo recorte em desktop, miniaturas e mobile (62% no perfil mobile, 68% nas miniaturas); o pivô acompanha o recorte ao redimensionar. Prévias/armário também animam; linhas densas do ranking permanecem paradas. Loops/camadas fora da tela ficam ocultos.

Foram verificados zero layers animados e zero sheens com efeitos reduzidos, zero imagens quebradas, zero erros de console nos fluxos exercitados e ausência de transbordamento no perfil/armário de 320 px. A animação de Overdrive mantém dois pulsos defasados; o lendário usa a textura completa, e a camada móvel fica sob o sombreado do texto. A malha de QA é local e foi removida antes da publicação. Capturas ficam em `outputs/login-diario-revisado.jpg`, `outputs/badges-alinhadas.jpg`, `outputs/banners-revisados.jpg`, `outputs/banner-lendario-revisado.jpg` e `outputs/perfil-mobile-revisado.jpg` na pasta deste chat.

## Validação final e limites

- Provas direcionadas: 380 testes aprovados (365 datas + cobertura do calendário, quiz, desbloqueios e extração de animação).
- Regressão completa: 1.995 testes aprovados, 22 auditorias opcionais ignoradas; 141 arquivos aprovados. Nenhuma mudança de motor após essa execução.
- Lint e TypeScript aprovados. Export estático aprovado: 1.944 arquivos, 50,87 MB, 1.037 URLs de imagens válidas; 41 rotas, sete páginas PT e 35 EN. Contas/analytics desligados no export isolado; carreira ligada, playtest desligado.
- Performance do export de produção, com três badges lendárias, título e banner lendários: **perfil 43 ms/s** (limite 80), **ranking 11 ms/s** (limite 60), **zero falhas de composição**. A tentativa com SVG/SMIL ao vivo custava 303 ms/s e foi descartada antes da publicação; a versão final usa WebP + CSS transform/opacity.
- Lighthouse 13.6.0, acessibilidade em mobile: **100/100 no perfil com calendário de login e 100/100 no catálogo de Challenges**, sem falhas automatizadas. Essas duas entradas não substituem uma auditoria manual de todos os estados ou a validação humana de dificuldade.
- Keys/versões de persistência, contas, hosting, dados de jogadores e código/store da carreira preservados. As capturas usam perfis descartáveis de localhost.
- As provas demonstram possibilidade nas regras publicadas; não substituem uma medida de dificuldade percebida por humanos. Gate 3b e os itens não autorizados desta etapa continuam abertos no ROADMAP.
