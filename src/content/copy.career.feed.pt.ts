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
      "seriesWon.1": "Passou por {opponent} em {score}. Série limpa, sem reclamação.",
      "seriesWon.2": "Passou por {opponent} em {event}. Próxima.",
      "seriesWon.3": "{score} pra {org}. Hoje eu não falo mais nada.",
      "seriesWon.4": "{opponent} tinha um plano. {org} tinha um melhor.",
      "seriesWon.5": "{score} em {event} e a chave ficou bem mais interessante.",
      "seriesWon.6": "Anotações de {event}: {score} em cima de {opponent}, rotação afiada a série inteira.",
      "seriesWon.7": "{org} passou por {opponent}. Melhor time da região hoje, e nem é perto.",

      "seriesLost.1": "{opponent} levou por {score}. Dói, mas essa série estava ali pra ganhar.",
      "seriesLost.2": "{opponent} jogou melhor a série em {event}. Respeito, e bora voltar pro treino.",
      "seriesLost.3": "{score}. {org} vai ter muito VOD pra assistir essa semana.",
      "seriesLost.4": "{opponent} tinha resposta pra tudo hoje. {org} tem lição de casa.",
      "seriesLost.5": "{score} em {event}. Não foi o resultado que a gente queria, nem a atuação.",
      "seriesLost.6": "{event}: {score} pra {opponent}. A gente volta.",

      "upsetWin.1": "No papel, {opponent} deveria ganhar. O {score} diz outra coisa.",
      "upsetWin.2": "O favorito em {event} era {opponent}, mas ninguém avisou o outro lado.",
      "upsetWin.3": "{score}. {org} virou a chave de cabeça pra baixo.",
      "upsetWin.4": "Zebra? {org} acabou de derrubar {opponent}.",
      "upsetWin.5": "Zebra em {event}: {score}. Guarda esse jogo.",
      "upsetWin.6": "Alerta de zebra em {event}: {opponent} perde por {score}. O favorito não viu vir.",

      "upsetLoss.1": "{opponent} vence por {score} quando ninguém esperava. Mérito deles, mas essa doeu.",
      "upsetLoss.2": "Favoritos no papel, derrotados no dia. {opponent} mereceu em {event}.",
      "upsetLoss.3": "{score}. {org} era pra ganhar essa.",
      "upsetLoss.4": "{org} escorregou contra {opponent}. Zebra acontece, agora é responder.",
      "upsetLoss.5": "Susto em {event}: {score}. A chave ficou bagunçada.",
      "upsetLoss.6": "{opponent} leva por {score} em {event} e o favorito caiu.",

      "winStreak.1": "{streak} séries vencidas seguidas pra {org}. A fase é real.",
      "winStreak.2": "São {streak} seguidas, e a da vez foi {opponent}.",
      "winStreak.3": "{streak} seguidas e {event} não está segurando eles.",
      "winStreak.4": "{streak} séries seguidas, a última por {score}. Fujam desse lado da chave.",
      "winStreak.5": "{org} estica a sequência pra {streak} em {event}. Alguém precisa parar esse time.",
      "winStreak.6": "{score} em cima de {opponent} e já são {streak} seguidas.",
      "winStreak.7": "{streak} vitórias seguidas. {org} é o melhor time da região, simples assim.",
      "winStreak.8": "{streak} seguidas e os troféus já estão na prateleira. {org} é uma dinastia.",

      "loseStreak.1": "{streak} séries perdidas seguidas pra {org}. Alguma coisa precisa mudar.",
      "loseStreak.2": "{opponent} dá a derrota número {streak} seguida pra gente.",
      "loseStreak.3": "{streak} derrotas seguidas e {event} não parou a sequência.",
      "loseStreak.4": "São {streak} seguidas, a última por {score}. Hora de repensar as rotações?",
      "loseStreak.5": "{org} em {event}: {streak} derrotas seguidas e a paciência tá acabando.",
      "loseStreak.6": "{score} pra {opponent} e a sequência de derrotas chega a {streak}.",

      "signing.1": "{player} pra {org}. Essa eu não vi vindo.",
      "signing.2": "Boas-vindas a {org}, {player}. O elenco ficou bem mais interessante.",
      "signing.3": "{org} contrata {player}. Quero ver como ficam as rotações agora.",
      "signing.4": "A grande pergunta pra {org}: onde {player} se encaixa? Ansioso pra ver.",
      "signing.5": "{player} com a camisa de {org}. A conversa sobre o elenco começa hoje.",
      "signing.6": "Finalmente movimento. {player} chega em {org}.",
      "signing.7": "{org} pagou {fee} em {player}. Agora as jogadas precisam vir.",
      "signing.8": "{player} sai de {from} e vai pra {org}. Contratação discreta, impacto alto.",

      "sale.1": "{org} se despede de {player}. Respeito por tudo que ficou no time.",
      "sale.2": "Fim da linha pra {player} em {org}. Só boas energias.",
      "sale.3": "{player} saiu de {org}. Qual é o plano pra essa vaga?",
      "sale.4": "Triste ver {player} saindo de {org}, mas faz parte do jogo.",
      "sale.5": "{org} segue sem {player}. Agora mostra o substituto.",
      "sale.6": "Valeu por tudo, {player}. {org} vai sentir falta dessas jogadas.",
      "sale.7": "{player} indo pra {to}. Torcida de {org}, o que acharam?",
      "sale.8": "{fee} por {player}. {org} fez caixa, agora quero ver onde vai gastar.",

      "titleWon.1": "Campeões de {event}: {org}. Eu tô passando mal.",
      "titleWon.2": "CAMPEÕES. {event} é de {org}.",
      "titleWon.3": "O troféu de {event} vai pra {org}. Cada rotação valeu a pena.",
      "titleWon.4": "{org} leva {event}. Uma temporada inteira de trabalho que compensou.",
      "titleWon.5": "Repete comigo: {org}, campeões de {event}.",
      "titleWon.6": "A gente esperou por isso. {org} levanta o troféu de {event}.",
      "titleWon.7": "{titles} títulos de Major e Mundial na conta. {event} confirma a dinastia.",
      "titleWon.8": "{org} leva {event}: título número {titles} no topo, e o primeiro. História.",
      "titleWon.9": "Título número {titles} na conta. {event} entra pra lista.",

      "finalLost.1": "{opponent} leva {event}. Foi por pouco, tô com o coração partido.",
      "finalLost.2": "{org} cai na final de {event}. Orgulho da campanha mesmo assim.",
      "finalLost.3": "{org} perde a final pra {opponent}. A gente volta.",
      "finalLost.4": "Vice em {event}, atrás de {opponent}. Prata não é ouro, mas a subida conta.",
      "finalLost.5": "Segundo lugar em {event}. {org} não vai esquecer essa.",
      "finalLost.6": "{opponent} levanta o troféu em {event} e {org} só assiste. Da próxima vai.",

      "managerReply.1": "Classe do manager de {org} falando de {opponent}. Gosto de ver.",
      "managerReply.2": "Semana {week}: post humilde sobre {opponent}. O vestiário parece estar no lugar.",
      "managerReply.3": "{org} mostrando respeito por {opponent}. Esse tipo de calma ganha série.",
      "managerReply.4": "{org} confiante sobre {opponent}. Agora tem que provar em jogo.",
      "managerReply.5": "Semana {week} e {org} tá seguro contra {opponent}. Gostei da confiança.",
      "managerReply.6": "{org} sobre {opponent}: confiança lá em cima. Confiança é barata, resultado não é.",
      "managerReply.7": "{org} cutucando {opponent} na timeline. Pipoca na mão.",
      "managerReply.8": "Drama da semana {week}: {org} mexendo com {opponent}. Agora não pode perder pra eles.",
      "managerReply.9": "Aquele post sobre {opponent}? Ousado. {org} é bom entregar.",

      "receipt.1": "{org} falou muito de {opponent} e depois perdeu. Print salvo.",
      "receipt.2": "{opponent} vence por {score}. Engraçado, lembro de um post sobre esse confronto.",
      "receipt.3": "{opponent} respondeu em {event}, e não foi na timeline.",
      "receipt.4": "{org} falou, o {score} respondeu. Apaga o post?",
      "receipt.5": "{event}: {opponent} vence por {score}. Alguém confere o post antigo, envelheceu mal.",
      "receipt.6": "Cutucar {opponent} e perder pra eles em {event}. {org} vai ouvir isso por um bom tempo.",

      "managerPost.humble": "Muito respeito por {opponent}. {org} segue trabalhando e deixa os jogos falarem.",
      "managerPost.confident": "Estamos prontos pra {opponent}. {org} confia no trabalho.",
      "managerPost.provocative": "{opponent} pode se preocupar. {org} vem pra cima.",
    },
  },
};
