/**
 * v2.3 FEED: copy do feed de torcedores em português (BR), espalhado no copy
 * de carreira (`copy.career.pt.ts`, uma linha). Mesmas chaves do EN. Escrito
 * como torcedor posta, não como tradução: curto, solto, sem meme forçado, sem
 * xingamento, e um jogador ou org real só aparece como assunto do post, nunca
 * como autor nem com fala inventada. `{score}` é o placar da série, vencedor
 * primeiro. Afirmações ("dinastia", "melhor time da região", "primeiro
 * título") só existem em variantes que o motor libera com dados do save.
 */
import type { CAREER_FEED_EN } from "./copy.career.feed.en";

export const CAREER_FEED_PT: typeof CAREER_FEED_EN = {
  feed: {
    title: "Feed dos torcedores",
    followers: "seguidores",
    likes: "curtidas",
    you: "Você",
    prompt: "Postar depois da série?",
    skip: "Pular",
    tones: {
      humble: { label: "Humilde", hint: "Respeita o adversário. Crescimento pequeno e firme." },
      confident: { label: "Confiante", hint: "Diz que está pronto. Crescimento moderado." },
      provocative: { label: "Provocador", hint: "Cutuca o adversário. Alcance grande, e perder pra ele vira print." },
    },
    text: {
      "seriesWon.1": "{score} contra {opponent}. Série limpa, sem reclamação.",
      "seriesWon.2": "Venceu {opponent} no {event}. Próxima.",
      "seriesWon.3": "{org} fecha em {score}. Hoje eu não falo mais nada.",
      "seriesWon.4": "{opponent} tinha um plano. {org} tinha um melhor.",
      "seriesWon.5": "{score} no {event} e a chave ficou bem mais interessante.",
      "seriesWon.6": "Anotações do {event}: {score} contra {opponent}, rotação afiada a série inteira.",
      "seriesWon.7": "{org} venceu {opponent}. Melhor time da região hoje, e nem é perto.",

      "seriesLost.1": "{opponent} levou por {score}. Dói, mas essa série estava ali pra ganhar.",
      "seriesLost.2": "{opponent} jogou melhor a série no {event}. Respeito, e bora voltar pro treino.",
      "seriesLost.3": "{score}. {org} vai ter muito VOD pra assistir essa semana.",
      "seriesLost.4": "{opponent} tinha resposta pra tudo hoje. {org} tem lição de casa.",
      "seriesLost.5": "{score} no {event}. Não foi o resultado que a gente queria, nem a atuação.",
      "seriesLost.6": "No {event}: {score} contra {opponent}. A gente volta.",

      "upsetWin.1": "No papel, {opponent} deveria ganhar. O {score} diz outra coisa.",
      "upsetWin.2": "O favorito no {event} era {opponent}, mas ninguém avisou o outro lado.",
      "upsetWin.3": "{score}. {org} virou a chave de cabeça pra baixo.",
      "upsetWin.4": "Zebra? {org} acabou de derrubar {opponent}.",
      "upsetWin.5": "Zebra no {event}: {score}. Guarda esse jogo.",
      "upsetWin.6": "Alerta de zebra no {event}: {opponent} perde por {score}. O favorito não viu vir.",

      "upsetLoss.1": "{opponent} vence por {score} quando ninguém esperava. Mérito deles, mas essa doeu.",
      "upsetLoss.2": "Favoritos no papel, derrotados no dia. {opponent} mereceu no {event}.",
      "upsetLoss.3": "{score}. {org} era pra ganhar essa.",
      "upsetLoss.4": "{org} escorregou contra {opponent}. Zebra acontece, agora é responder.",
      "upsetLoss.5": "Susto no {event}: {score}. A chave ficou bagunçada.",
      "upsetLoss.6": "{opponent} leva por {score} no {event} e o favorito caiu.",

      "winStreak.1": "{org} soma {streak} séries vencidas seguidas. A fase é real.",
      "winStreak.2": "São {streak} seguidas, e a da vez foi {opponent}.",
      "winStreak.3": "{streak} seguidas e o {event} não está segurando eles.",
      "winStreak.4": "{streak} séries seguidas, a última por {score}. Fujam desse lado da chave.",
      "winStreak.5": "{org} estica a sequência pra {streak} no {event}. Alguém precisa parar esse time.",
      "winStreak.6": "{score} contra {opponent} e já são {streak} seguidas.",
      "winStreak.7": "{streak} vitórias seguidas. {org} é o melhor time da região, simples assim.",
      "winStreak.8": "{streak} seguidas e os troféus já estão na prateleira. {org} é uma dinastia.",

      "loseStreak.1": "{org} perdeu {streak} séries seguidas. Alguma coisa precisa mudar.",
      "loseStreak.2": "{opponent} dá a derrota número {streak} seguida pra gente.",
      "loseStreak.3": "{streak} derrotas seguidas e o {event} não parou a sequência.",
      "loseStreak.4": "São {streak} seguidas, a última por {score}. Hora de repensar as rotações?",
      "loseStreak.5": "No {event}, {org} soma {streak} derrotas seguidas e a paciência tá acabando.",
      "loseStreak.6": "Derrota por {score} contra {opponent} e a sequência chega a {streak}.",

      "signing.1": "{org} anuncia {player}. Essa eu não vi vindo.",
      "signing.2": "Boas-vindas, {player}. {org} tem um elenco bem mais interessante agora.",
      "signing.3": "{org} contrata {player}. Quero ver como ficam as rotações agora.",
      "signing.4": "Grande pergunta: onde {player} se encaixa no elenco, agora que {org} fechou com ele? Ansioso pra ver.",
      "signing.5": "{player} assina com {org}. A conversa sobre o elenco começa hoje.",
      "signing.6": "Finalmente movimento: {org} fecha com {player}.",
      "signing.7": "{org} pagou {fee} por {player}. Agora as jogadas precisam vir.",
      "signing.8": "{player} deixa {from} e assina com {org}. Contratação discreta, impacto alto.",

      "sale.1": "{org} se despede de {player}. Respeito por tudo que ficou no time.",
      "sale.2": "Fim da linha pra {player}. {org} segue em frente. Só boas energias.",
      "sale.3": "{player} saiu. {org} precisa de um plano pra essa vaga.",
      "sale.4": "Triste ver {player} saindo. {org} fez a escolha, mas faz parte do jogo.",
      "sale.5": "{org} segue sem {player}. Agora mostra o substituto.",
      "sale.6": "Valeu por tudo, {player}. {org} vai sentir falta dessas jogadas.",
      "sale.7": "{player} fecha com {to} e {org} fica sem ele. Torcida, o que acharam?",
      "sale.8": "{fee} por {player}. {org} fez caixa, agora quero ver onde vai gastar.",

      "titleWon.1": "Campeões do {event}: {org}. Eu tô passando mal.",
      "titleWon.2": "CAMPEÕES. {org} leva o {event}.",
      "titleWon.3": "{org} fica com o troféu do {event}. Cada rotação valeu a pena.",
      "titleWon.4": "{org} leva o {event}. Uma temporada inteira de trabalho que compensou.",
      "titleWon.5": "Repete comigo: {org}, campeões do {event}.",
      "titleWon.6": "A gente esperou por isso. {org} levanta o troféu do {event}.",
      "titleWon.7": "{titles} títulos de Major e Mundial na conta. O {event} confirma a dinastia.",
      "titleWon.8": "{org} leva o {event}: título número {titles} no topo, e o primeiro. História.",
      "titleWon.9": "Título número {titles} na conta. O {event} entra pra lista.",

      "finalLost.1": "{opponent} leva o {event}. Foi por pouco, tô com o coração partido.",
      "finalLost.2": "{org} cai na final do {event}. Orgulho da campanha mesmo assim.",
      "finalLost.3": "{org} perde a final contra {opponent}. A gente volta.",
      "finalLost.4": "Vice no {event}, e quem levou foi {opponent}. Prata não é ouro, mas a subida conta.",
      "finalLost.5": "Segundo lugar no {event}. {org} não vai esquecer essa.",
      "finalLost.6": "{opponent} levanta o troféu no {event} e {org} só assiste. Da próxima vai.",

      "managerReply.1": "Classe do manager do time: {org} respeitando {opponent}. Gosto de ver.",
      "managerReply.2": "Semana {week}: o manager segue humilde antes de enfrentar {opponent}. O vestiário parece estar no lugar.",
      "managerReply.3": "{org} respeitando {opponent}. Esse tipo de calma ganha série.",
      "managerReply.4": "{org} confiante antes de enfrentar {opponent}. Agora tem que provar em jogo.",
      "managerReply.5": "Semana {week} e {org} tá seguro contra {opponent}. Gostei da confiança.",
      "managerReply.6": "{org} encara {opponent} com a confiança lá em cima. Confiança é barata, resultado não é.",
      "managerReply.7": "{org} cutucando {opponent} na timeline. Pipoca na mão.",
      "managerReply.8": "Drama da semana {week}: {org} mexendo com {opponent}. Agora não pode perder pra eles.",
      "managerReply.9": "Aquele post cutucando {opponent}? Ousado. {org} é bom entregar.",

      "receipt.1": "{org} falou demais e depois perdeu contra {opponent}. Print salvo.",
      "receipt.2": "{opponent} vence por {score}. Engraçado, lembro de um post sobre esse confronto.",
      "receipt.3": "{opponent} respondeu no {event}, e não foi na timeline.",
      "receipt.4": "{org} falou, o {score} respondeu. Apaga o post?",
      "receipt.5": "No {event}, {opponent} vence por {score}. Alguém confere o post antigo, envelheceu mal.",
      "receipt.6": "Cutucar {opponent} e perder contra eles no {event}. {org} vai ouvir isso por um bom tempo.",

      "managerPost.humble": "{opponent} merece respeito. {org} segue trabalhando e deixa os jogos falarem.",
      "managerPost.confident": "Estamos prontos pra encarar {opponent}. {org} confia no trabalho.",
      "managerPost.provocative": "{opponent} pode se preocupar. {org} vem pra cima.",
    },
  },
};
