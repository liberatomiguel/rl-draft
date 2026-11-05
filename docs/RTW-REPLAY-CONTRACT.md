# Road to Worlds — contrato de rejogabilidade (F5)

**Estado: proposta para aprovação de Miguel; nenhuma implementação autorizada por este documento.**
Base: roadmap de 05/11, §§1–2 e F5; preferências de Miguel neste chat.
Escopo desta entrega: opções, recomendação e critérios de aceite. Sem alterar
save, profile, dificuldade, UI, conquistas ou cosméticos nesta rodada.

## 1. Experiência pretendida

Ganhar o primeiro Worlds conclui o grande arco da carreira. A tela de conclusão
deve oferecer duas vontades diferentes: continuar defendendo a dinastia no mesmo
mundo (endless), ou começar do zero com um novo desafio. A segunda carreira deve
ter um objetivo novo e reconhecível, não exigir que o jogador repita o tutorial
nem devolver força acumulada. A carreira comum continua disponível.

Referência de ritmo para avaliar a futura bateria: início difícil, poucas vitórias;
os dois primeiros splits normalmente sem regional, chance crescendo a partir do
terceiro; presença mais constante em S3; chances de Major em S4–5, resultados
melhores por S6; Worlds em S6–7 e primeiro título idealmente em S7–8. São referências
de distribuição, não gates por season, garantias ou razões para invalidar uma
conquista antecipada. Região, dificuldade e gestão podem mudar bastante esse arco.
Finanças devem exigir decisões e permitir recuperação; algumas falências são
aceitáveis. Caixa para estrelas no endgame é parte da recompensa.

## 2. Opções e recomendação

| Tema | Opções | Recomendação |
|---|---|---|
| Após o primeiro Worlds | Só endless; dificuldade extra obrigatória; desafios opcionais para novas carreiras | Manter endless e desbloquear **Carreiras de Desafio / Challenge Careers** opcionais |
| Desafio adicional | Rating adversário oculto; regras de gestão públicas; combinação de ambos | Regras públicas primeiro; nenhum rating extra aprovado agora |
| Progressão entre carreiras | Força/caixa herdados; só registro de feitos e apresentação | Apenas registro, conquistas e cosméticos |
| Títulos | Só total do usuário; tabela de times; tabela de times e jogadores | Times e jogadores no mundo da carreira, por competição, desde a fundação |
| História anterior à fundação | Inventar retrospecto; importar títulos reais; começar zerado | Começar zerado; dados reais apenas se fornecidos/validados por Miguel, em camada separada |
| Primeira entrega | Muitos modificadores combináveis; poucos contratos completos | Academia e teto de folha; demais caminhos em fases posteriores |

O desbloqueio usa o padrão de descoberta do Legacy do Draft, mas com nome e regras
próprios: não pressupõe que o modificador de força do Draft seja reutilizado.

## 3. Desbloqueio e ciclo da nova carreira

1. Gatilho: `profile.careerWorldsWon >= 1`, já existente e sincronizado por `max`.
   Não criar um segundo latch sem necessidade; uma vez reconhecida a vitória,
   perder/apagar o save da carreira não deve bloquear a opção novamente.
2. Reconhecer também profiles antigos que já satisfazem esse gatilho. Perfil
   offline funciona; sincronização não exige conexão para jogar o desafio.
3. A conclusão comemora o título e apresenta: continuar a carreira, nova carreira
   comum ou nova carreira com regras. Abrir a configuração nunca apaga o save atual.
   Se só houver um slot, substituição exige a confirmação habitual e opção de exportar.
4. A nova carreira escolhe região, dificuldade, elenco e um contrato visível antes
   de começar. Hard segue disponível; o desafio pode ser combinado com ele.
   O contrato não altera a dificuldade escolhida silenciosamente.
5. Começar do zero: sem dinheiro, elenco, reputação, staff, gear, potencial,
   salário reduzido, buff ou acesso de mercado herdados. Cosméticos não afetam simulação.
6. A regra e sua versão ficam registradas na carreira; não podem ser desligadas
   para receber a conquista. Mudar regras futuras não reescreve o mérito de uma run antiga.
7. Falência ou aposentadoria não retira o desbloqueio. Continuar endless após o
   título preserva a carreira, suas finanças e seus registros, sem reiniciar a economia.

## 4. Contratos propostos

| Caminho | Regra/objetivo | Decisões que deve produzir | Entrega sugerida |
|---|---|---|---|
| Academia | Novas contratações limitadas à faixa jovem pública; desenvolver o próprio núcleo | Escolher potencial incerto, formar e renovar, decidir quando vender | Primeiro |
| Teto de folha | Folha de jogadores + coach limitada por orçamento publicado | Estrela vs profundidade vs coach, vendas para abrir espaço | Primeiro |
| Restrições históricas | Clubes/jogadores/eras elegíveis explicitados antes da run | Reconstruir um projeto com um catálogo limitado | Depois de haver dados validados e prova de elenco suficiente |
| Dinastia | Defender o título na mesma carreira; marcos de múltiplos Worlds | Renovação, sucessão geracional, longevidade financeira | Depois; usa endless existente, sem nova força |
| Nova geração | Nova carreira com pool gerado e identidade própria, sem depender de estrelas históricas | Descoberta e scouting, novos rivais | Depois; primeiro resolver nomes, pool e aposentadorias |
| Passaporte regional | Vencer em regiões diferentes, em carreiras independentes | Explorar cenas e caminhos distintos | Depois do registro global confiável |

**Academia:** manter o elenco fundador escolhido; restringir novas chegadas, não
expulsar veteranos automaticamente. A idade-limite exata fica para aprovação e
calibração (candidata: 19). Precisará garantir um conjunto legal de reposições em
todas as regiões. Uma vaga vazia nunca pode virar softlock: oferecer reposição
legal dentro da regra; se isso não existir, suspender a validação do desafio com
aviso claro, preservando a carreira comum. Não conceder uma exceção secreta.

**Teto de folha:** comparar valores na mesma unidade e incluir coach e qualquer
reserva contratado. O modelo recomendado é um teto por season, publicado na
configuração e indexado de forma conhecida; valor/fórmula dependem da bateria.
Bloquear novas contratações/renovações voluntárias que ultrapassem o teto. Se uma
mudança de season ou de regra deixar a folha acima, conceder uma janela explícita
de adequação antes do primeiro evento, sem apagar jogadores nem perdoar despesas.
Participação em prêmios também precisa de limite público para não contornar a
folha com salários simbólicos. Não codificar valores antes de decidir esses pontos.

Nenhuma dessas propostas aprova aumentar Major ou Worlds. A variante de Worlds
fica só no spy da F4a; qualquer mudança de força precisa de evidência e decisão
separada. Evitar somar punições econômicas e esportivas sem medir cada uma.

## 5. Tabela de títulos dentro da carreira

### Conteúdo e leitura

- Duas abas: times e jogadores; colunas de Regionais, Majors, Worlds e total.
  Só competições oficiais concluídas contam nessas colunas. Comunidade/qualifier
  não inflam o ranking; eventuais troféus locais devem ficar separados.
- Ordenação inicial recomendada: Worlds, depois Majors, depois Regionais;
  desempate estável por nome/ID. Filtros por região, competição e período.
- Destacar o time do usuário e oferecer “ir para meu time”, com posição mesmo
  fora do topo. Jogadores vendidos ou aposentados continuam no histórico.
- O título pertence ao time campeão e aos jogadores efetivamente escalados no
  evento. Banco não utilizado e coach não entram como jogadores campeões;
  eventual tabela de coaches seria outro recurso. Participação deve ser congelada
  no evento, nunca lida do elenco atual no momento de abrir a tabela.
- Eventos de todas as regiões e resultados da IA contam, mesmo sem o usuário
  participar. Somar cada evento uma vez. Renomear um time não cria outro clube.

### História nova, aditiva e verificável

Proposta de campo opcional no save: `titleHistory`, com versão do formato, início
da cobertura, identidade estável da carreira e um ledger de campeões por evento.
Cada registro inclui chave única da edição/evento, season, tier, região quando
aplicável, ID e nome do campeão naquele momento, IDs/nomes dos jogadores elegíveis
e proveniência. Os totais e posições são derivados desse ledger.

Capturar a escalação da IA junto à simulação/settlement e a do usuário no evento;
não reconstruir a partir do roster depois de transferências ou da virada. A chave
de evento torna settlement, reabertura e migração idempotentes. Aposentadoria e
troca de nome não removem registros. Não consumir RNG para gerar IDs do ledger.

Carreiras novas gravam desde a fundação. Saves anteriores sem o campo carregam
normalmente: criar cobertura a partir do ponto observado e mostrar “histórico
parcial”. O histórico atual só conhece campeões de Worlds por time e season;
não inventar regionais, Majors ou campeões por jogador. Pode-se importar apenas
os Worlds comprovados no histórico antigo, marcados como parciais e sem atribuir
roster desconhecido. Não somar esse backfill novamente quando o evento já existir.

Dados históricos reais, se fornecidos, ficam em catálogo com fonte/versão e
contadores separados dos títulos simulados. A referência aos quatro Worlds
mencionada por Miguel pode inspirar “alcance quatro títulos”, sem cadastrar um
retrospecto fictício na tabela. Um marco não exige importar toda a história real.

O ledger tem dimensão de eventos oficiais, não de todas as séries. A futura
implementação deve medir tamanho/performance de save em S20+ e não truncar títulos
para caber no tail de `eventResults`. Mudanças de persistência, migração e sync
precisam de testes próprios antes de qualquer alteração de versão/contrato.

## 6. Registro entre carreiras, conquistas e cosméticos

A tabela de times/jogadores pertence ao mundo de cada carreira. Separadamente,
um registro pessoal pode guardar as carreiras concluídas e seus feitos para:

- primeira conquista do Worlds e segunda carreira campeã;
- conquistar Worlds em uma nova região e completar o passaporte de sete regiões;
- conquistar Worlds em Hard ou sob Academia/teto de folha;
- defender o Worlds e atingir quatro títulos na mesma dinastia;
- desenvolver jogadores campeões, conforme critério público de formação a definir.

Recomendação: registrar resultado por identidade estável da carreira, região,
dificuldade, contrato/versão, primeira vitória e encerramento; usar IDs de feitos
idempotentes. `careerWorldsWon` serve ao desbloqueio, mas não prova que duas
vitórias vieram de duas carreiras: endless não pode contar como duas carreiras
campeãs. Não deduzir regiões/conclusões antigas de um número agregado.

Reconhecimento deve ter utilidade visível: medalhas, banners, emblemas ou títulos
de perfil, sem buffs. Não aprovar nova moeda, loja ou obrigação de login. O catálogo
exato de artes/recompensas e os limiares de conquistas vêm numa decisão posterior.
Profiles sem dados novos continuam válidos; sem retroativos inventados.

Se houver sync desses feitos, mesclar por identidade/ID, não somar cegamente dois
dispositivos. Importar o mesmo save duas vezes não duplica troféus. Continuar uma
carreira em dois dispositivos pode bifurcar o mundo: definir resolução de conflito
antes de implementar; não fundir dois campeões incompatíveis da mesma edição.

## 7. Critérios de aceite da futura implementação

1. Vitória existente desbloqueia; falência, apagamento ou offline não retiram a opção.
2. Carreira comum e endless seguem acessíveis; abrir replay não substitui save sem confirmação.
3. Nenhuma força/riqueza é herdada; o mesmo seed e regras comuns mantêm a mesma simulação.
4. A regra do desafio está visível, é verificável e não permite contorno por renovação,
   banco/reserva, share de prêmios ou troca de season; não produz softlock de elenco.
5. Título registra campeão e escalação da época, inclusive IA, em todas as regiões;
   settlement/rollover repetidos não duplicam; aposentadoria/transferência não reatribui.
6. Save antigo sem campos novos carrega, mostra cobertura parcial e não inventa dados.
7. Reimport/sync não duplica feitos; várias vitórias numa carreira não viram várias carreiras.
8. Ranking destaca a posição do usuário, possui textos EN/PT e funciona sem dados reais.
9. Tamanho de save e consulta de títulos são medidos em endless; sem build/deploy nesta rodada.

## 8. Decisões para Miguel

Recomendação para aprovar como direção: tabela simulada por time/jogador desde a
fundação; desbloqueio por `careerWorldsWon`; novas carreiras com contratos opcionais;
Academia e teto de folha primeiro; dinastia/passaporte/conquistas cosméticas depois;
nenhum bônus de força entre carreiras.

Continuam em aberto antes do código: nome final, idade da Academia, fórmula do teto
e tratamento de prize share, ordem das entregas, catálogo de conquistas/cosméticos
e eventuais dados históricos reais. Este documento não marca essas escolhas como
fechadas nem autoriza implementar F5.
