# Textos de desbloqueio — rc.38

Inventário extraído das cópias EN/PT e do catálogo usado pela UI. Textos dinâmicos aparecem instanciados por item. Nenhuma remoção adicional de texto.

## Avanço de rank

| Evento | EN exato | PT exato |
|---|---|---|
| Unranked → Bronze | The Collection / Rare special cards / Wings special cards / Content Creator special cards / 4% special card chance | A Coleção / Cartas especiais Rara / Cartas especiais Wings / Cartas especiais Criador de Conteúdo / 4% de chance de carta especial |
| Bronze → Silver | Epic special cards | Cartas especiais Épica |
| Silver → Gold | Mythic special cards | Cartas especiais Mítica |
| Gold → Platinum | Legendary special cards | Cartas especiais Lendária |
| Platinum → Diamond | 6% special card chance | 6% de chance de carta especial |
| Diamond → Champion | 9% special card chance | 9% de chance de carta especial |
| Champion → Grand Champion | 12% special card chance | 12% de chance de carta especial |
| Grand Champion → Supersonic Legend | 16% special card chance | 16% de chance de carta especial |

Saltos de vários ranks comparam o rank inicial ao final, acumulando todas as novas raridades e mostrando apenas a probabilidade final. `creator` é omitido pelo código. “Hard mode” existe na cópia, mas é inalcançável hoje: hardMode=true em todos os ranks.

## Textos fixos realmente usados nas cerimônias

| Tela / condição | Chave | EN | PT |
|---|---|---|---|
| Carta especial nova ao finalizar run | ceremonyKicker | New card unlocked | Nova carta desbloqueada |
| Carta especial nova ao finalizar run | ceremonyTap | Tap anywhere to reveal | Toque em qualquer lugar para revelar |
| Carta especial nova ao finalizar run | ceremonyContinue | Continue | Continuar |
| Carta especial nova ao finalizar run | ceremonyNext | Next card | Próxima carta |
| Avanço de rank | rankUpTitle | Rank up! | Subiu de rank! |
| Avanço de rank | rankUpUnlocked | Unlocked | Desbloqueado |
| Primeira vitória Hard → Legacy | legacyKicker | New mode unlocked | Novo modo desbloqueado |
| Primeira vitória Hard → Legacy | legacyTitle | Legacy Unlocked | Legacy Desbloqueado |
| Primeira vitória Hard → Legacy | legacySub | An all-time gauntlet of championship rosters now awaits. | Um gauntlet histórico de elencos campeões agora espera por você. |
| Primeira vitória Hard → Legacy | legacyHint | Tap anywhere to continue | Toque em qualquer lugar para continuar |
| Modal individual de cosmético (slots cheios / equipado / próximo conforme estado) | unlockKicker | New unlock | Novo desbloqueio |
| Modal individual de cosmético (slots cheios / equipado / próximo conforme estado) | unlockHow | How you earned it | Como você conseguiu |
| Modal individual de cosmético (slots cheios / equipado / próximo conforme estado) | unlockEquip | Wear it now | Usar agora |
| Modal individual de cosmético (slots cheios / equipado / próximo conforme estado) | unlockEquipped | Equipped | Equipado |
| Modal individual de cosmético (slots cheios / equipado / próximo conforme estado) | unlockSlotsFull | Badge slots are full — pick a slot in the locker | Os slots de insígnia estão cheios — escolha um slot no armário |
| Modal individual de cosmético (slots cheios / equipado / próximo conforme estado) | unlockContinue | Continue | Continuar |
| Modal individual de cosmético (slots cheios / equipado / próximo conforme estado) | unlockNext | Next | Próximo |
| Modal individual: tipo badge | unlockKind | New badge | Nova insígnia |
| Modal individual: tipo title | unlockKind | New title | Novo título |
| Modal individual: tipo banner | unlockKind | New banner | Novo banner |
| Fila com mais de um cosmético (exemplo item 1/2) | unlockCount | 1 of 2 | 1 de 2 |

Carta especial: nome/título e carta real; se houver várias, contador `1/2 ·` etc. O texto “New card unlocked” só se refere a cartas novas. O reveal completo do time aparece nos resultados; não é um novo grant.

No rank-up, o nome anterior + seta e o novo rank continuam visíveis. A prévia do cosmético foi retirada; o modal individual mantém nome, raridade, tipo, descrição, condição e ações abaixo. Chaves rankUpKicker/rankUpHint não são renderizadas na implementação atual.

## Todos os cosméticos: textos e condições no modal individual

| ID / tipo | Nome EN / PT | Descrição EN | Descrição PT | Condição exibida EN | Condição exibida PT | Evento / regra exata |
|---|---|---|---|---|---|---|
| spark / badge | Spark / Spark | Seven days in a row. | Sete dias seguidos. | Log in 7 days in a row | Entre 7 dias seguidos | {"type":"login-streak","days":7} |
| wildfire / badge | Wildfire / Wildfire | Thirty days in a row. | Trinta dias seguidos. | Log in 30 days in a row | Entre 30 dias seguidos | {"type":"login-streak","days":30} |
| rising-star / badge | Rising Star / Rising Star | Twenty-five challenge stars. | Vinte e cinco estrelas de challenge. | Earn 25 challenge stars | Conquiste 25 estrelas de challenge | {"type":"challenge-stars","stars":25} |
| constellation / badge | Constellation / Constellation | Fifty challenge stars. | Cinquenta estrelas de challenge. | Earn 50 challenge stars | Conquiste 50 estrelas de challenge | {"type":"challenge-stars","stars":50} |
| supernova / badge | Supernova / Supernova | Earn 75 challenge stars. | Conquiste 75 estrelas de challenge. | Earn 75 challenge stars | Conquiste 75 estrelas de challenge | {"type":"challenge-stars","stars":75} |
| veteran-drafter-1 / badge | Veteran Drafter I / Veteran Drafter I | Fifty runs won. | Cinquenta runs vencidas. | Win 50 runs | Vença 50 runs | {"type":"runs-won","count":50} |
| veteran-drafter-2 / badge | Veteran Drafter II / Veteran Drafter II | 250 runs won. | 250 runs vencidas. | Win 250 runs | Vença 250 runs | {"type":"runs-won","count":250} |
| veteran-drafter-3 / badge | Veteran Drafter III / Veteran Drafter III | 500 runs won. | 500 runs vencidas. | Win 500 runs | Vença 500 runs | {"type":"runs-won","count":500} |
| veteran-drafter-4 / badge | Veteran Drafter IV / Veteran Drafter IV | 1,000 runs won. Few drafters ever get here. | 1.000 runs vencidas. Poucos drafters chegam aqui. | Win 1,000 runs | Vença 1.000 runs | {"type":"runs-won","count":1000} |
| scholar-1 / badge | Scholar I / Scholar I | Ten daily quizzes solved. | Dez quizzes diários acertados. | Solve 10 daily quizzes | Acerte 10 quizzes diários | {"type":"quiz-solved","count":10} |
| scholar-2 / badge | Scholar II / Scholar II | Twenty-five daily quizzes solved. | Vinte e cinco quizzes diários acertados. | Solve 25 daily quizzes | Acerte 25 quizzes diários | {"type":"quiz-solved","count":25} |
| scholar-3 / badge | Scholar III / Scholar III | Fifty daily quizzes solved. | Cinquenta quizzes diários acertados. | Solve 50 daily quizzes | Acerte 50 quizzes diários | {"type":"quiz-solved","count":50} |
| on-target / badge | On Target / On Target | Twenty-five missions completed. | Vinte e cinco missões completas. | Complete 25 missions | Complete 25 missões | {"type":"missions-completed","count":25} |
| first-chapter / badge | First Chapter / First Chapter | You played the pre-season: the first chapter of Rocket Draft. | Você jogou a pré-temporada: o primeiro capítulo do Rocket Draft. | Finished a run in the pre-season | Concluiu uma run na pré-temporada | {"type":"legacy-participation"} |
| season-champion-ps / badge | Season Champion / Season Champion | Finished the pre-season #1 on the board. | Terminou a pré-temporada em #1 no ranking. | Finished #1 on the pre-season board | Terminou em #1 no ranking da pré-temporada | {"type":"legacy-position","minPosition":1,"maxPosition":1} |
| season-runner-up-ps / badge | Season Runner-up / Season Runner-up | Finished the pre-season 2nd on the board. | Terminou a pré-temporada em 2º no ranking. | Finished #2 on the pre-season board | Terminou em #2 no ranking da pré-temporada | {"type":"legacy-position","minPosition":2,"maxPosition":2} |
| season-third-place-ps / badge | Season Third Place / Season Third Place | Finished the pre-season 3rd on the board. | Terminou a pré-temporada em 3º no ranking. | Finished #3 on the pre-season board | Terminou em #3 no ranking da pré-temporada | {"type":"legacy-position","minPosition":3,"maxPosition":3} |
| season-elite-ps / badge | Season Elite / Season Elite | Finished the pre-season in the top 10 of the board. | Terminou a pré-temporada no top 10 do ranking. | Finished #4–10 on the pre-season board | Terminou entre #4 e #10 no ranking da pré-temporada | {"type":"legacy-position","minPosition":4,"maxPosition":10} |
| season-finalist-ps / badge | Season Finalist / Season Finalist | Finished the pre-season in the top 50 of the board. | Terminou a pré-temporada no top 50 do ranking. | Finished #11–50 on the pre-season board | Terminou entre #11 e #50 no ranking da pré-temporada | {"type":"legacy-position","minPosition":11,"maxPosition":50} |
| pre-season-bronze / badge | Pre-season Bronze / Pre-season Bronze | Reached Bronze in the pre-season. | Chegou ao Bronze na pré-temporada. | Peak pre-season rank: Bronze | Rank máximo na pré-temporada: Bronze | {"type":"legacy-rank","rankId":"bronze"} |
| pre-season-silver / badge | Pre-season Silver / Pre-season Silver | Reached Silver in the pre-season. | Chegou ao Silver na pré-temporada. | Peak pre-season rank: Silver | Rank máximo na pré-temporada: Silver | {"type":"legacy-rank","rankId":"silver"} |
| pre-season-gold / badge | Pre-season Gold / Pre-season Gold | Reached Gold in the pre-season. | Chegou ao Gold na pré-temporada. | Peak pre-season rank: Gold | Rank máximo na pré-temporada: Gold | {"type":"legacy-rank","rankId":"gold"} |
| pre-season-platinum / badge | Pre-season Platinum / Pre-season Platinum | Reached Platinum in the pre-season. | Chegou ao Platinum na pré-temporada. | Peak pre-season rank: Platinum | Rank máximo na pré-temporada: Platinum | {"type":"legacy-rank","rankId":"platinum"} |
| pre-season-diamond / badge | Pre-season Diamond / Pre-season Diamond | Reached Diamond in the pre-season. | Chegou ao Diamond na pré-temporada. | Peak pre-season rank: Diamond | Rank máximo na pré-temporada: Diamond | {"type":"legacy-rank","rankId":"diamond"} |
| pre-season-champion / badge | Pre-season Champion / Pre-season Champion | Reached Champion in the pre-season. | Chegou ao Champion na pré-temporada. | Peak pre-season rank: Champion | Rank máximo na pré-temporada: Champion | {"type":"legacy-rank","rankId":"champion"} |
| pre-season-grand-champion / badge | Pre-season Grand Champion / Pre-season Grand Champion | Reached Grand Champion in the pre-season. | Chegou ao Grand Champion na pré-temporada. | Peak pre-season rank: Grand Champion | Rank máximo na pré-temporada: Grand Champion | {"type":"legacy-rank","rankId":"grand-champion"} |
| pre-season-supersonic / badge | Pre-season Supersonic / Pre-season Supersonic | Supersonic Legend before the first season even started. | Supersonic Legend antes mesmo da primeira temporada começar. | Peak pre-season rank: Supersonic Legend | Rank máximo na pré-temporada: Supersonic Legend | {"type":"legacy-rank","rankId":"supersonic-legend"} |
| road-warrior / badge | Road Warrior / Road Warrior | Reach your fourth season with one org on the Road to Worlds. | Chegue à quarta temporada com uma mesma org no Road to Worlds. | Road to Worlds achievement | Conquista do Road to Worlds | {"type":"career-mark","markId":"car-four-seasons"} |
| world-champion-crowned / badge | Crowned World Champion / Crowned World Champion | Won the World Championship on the Road to Worlds. | Venceu o Campeonato Mundial no Road to Worlds. | Win Worlds on the Road to Worlds | Vença um Mundial no Road to Worlds | {"type":"career-worlds","count":1} |
| dynasty / badge | Dynasty / Dynasty | One season: Supersonic Legend, three Worlds titles and 25 Legacy wins. | Uma season: Supersonic Legend, três Mundiais e 25 vitórias no Legacy. | In one season: reach SSL, win 3 Worlds on the Road to Worlds and 25 Legacy runs | Numa mesma season: chegue a SSL, vença 3 Mundiais no Road to Worlds e 25 runs no Legacy | {"type":"season-feat","rankId":"supersonic-legend","careerWorlds":3,"legacyTitles":25} |
| 50-50-staff / badge | 50/50 Staff / 50/50 Staff | Manually granted to the 50/50 staff. | Concessão manual para a equipe 50/50. | Recognised as a member of the 50/50 staff | Reconhecido como membro da equipe 50/50 | {"type":"grant","grantId":"50-50-staff"} |
| early-supporter / badge | Early Supporter / Early Supporter | Played from the very start and helped spread the word. | Jogou desde o início e ajudou a divulgar o Rocket Draft. | Recognised as an early supporter | Reconhecido como early supporter | {"type":"grant","grantId":"early-supporter"} |
| supporter / badge | Supporter / Supporter | Backed Rocket Draft when it was just getting started. | Apoiou o Rocket Draft quando ele estava só começando. | Recognised as a supporter of the project | Reconhecido como apoiador do projeto | {"type":"grant","grantId":"supporter"} |
| contributor / badge | Contributor / Contributor | Helped build the game: data, art, testing or ideas. | Ajudou a construir o jogo: dados, arte, testes ou ideias. | Recognised as a contributor to the project | Reconhecido como contribuidor do projeto | {"type":"grant","grantId":"contributor"} |
| verified-pro / badge | Verified Pro / Verified Pro | A verified RLCS professional plays here too. | Um profissional de RLCS verificado também joga aqui. | Verified RLCS pro player | Jogador profissional de RLCS verificado | {"type":"grant","grantId":"pro"} |
| login-title-the-regular / title | The Regular / The Regular | Three days in a row. A habit in the making. | Três dias seguidos. Um hábito nascendo. | Log in 3 days in a row | Entre 3 dias seguidos | {"type":"login-streak","days":3} |
| login-banner-kickoff / banner | Kickoff / Kickoff | Five days in a row. The pitch is yours. | Cinco dias seguidos. O campo é seu. | Log in 5 days in a row | Entre 5 dias seguidos | {"type":"login-streak","days":5} |
| login-title-locked-in / title | Locked In / Locked In | Ten days in a row. | Dez dias seguidos. | Log in 10 days in a row | Entre 10 dias seguidos | {"type":"login-streak","days":10} |
| login-banner-after-hours / banner | After Hours / After Hours | Fourteen days in a row. The arena never really closes. | Catorze dias seguidos. A arena nunca fecha de verdade. | Log in 14 days in a row | Entre 14 dias seguidos | {"type":"login-streak","days":14} |
| login-banner-solar-flare / banner | Solar Flare / Solar Flare | Twenty-one days in a row. | Vinte e um dias seguidos. | Log in 21 days in a row | Entre 21 dias seguidos | {"type":"login-streak","days":21} |
| login-title-on-fire / title | On Fire / On Fire | Twenty-one days in a row. | Vinte e um dias seguidos. | Log in 21 days in a row | Entre 21 dias seguidos | {"type":"login-streak","days":21} |
| login-title-cant-stop / title | Can't Stop / Can't Stop | Twenty-five days in a row. | Vinte e cinco dias seguidos. | Log in 25 days in a row | Entre 25 dias seguidos | {"type":"login-streak","days":25} |
| login-banner-wildfire / banner | Wildfire / Wildfire | Thirty days in a row. The flames of the Wildfire badge, full width. | Trinta dias seguidos. As chamas da insígnia Wildfire, em tela cheia. | Log in 30 days in a row | Entre 30 dias seguidos | {"type":"login-streak","days":30} |
| login-title-daily-driver / title | Daily Driver / Daily Driver | Thirty days in a row. | Trinta dias seguidos. | Log in 30 days in a row | Entre 30 dias seguidos | {"type":"login-streak","days":30} |
| rank-banner-circuit / banner | Circuit / Circuit | Reached Bronze in Season 1. | Chegou ao Bronze na Season 1. | Reach Bronze in Season 1 | Alcance Bronze na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"bronze"} |
| rank-title-challenger / title | Challenger / Challenger | Reached Silver in Season 1. | Chegou ao Silver na Season 1. | Reach Silver in Season 1 | Alcance Silver na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"silver"} |
| rank-banner-neon-grid / banner | Neon Grid / Neon Grid | Reached Gold in Season 1. | Chegou ao Gold na Season 1. | Reach Gold in Season 1 | Alcance Gold na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"gold"} |
| rank-title-playmaker / title | Playmaker / Playmaker | Reached Gold in Season 1. | Chegou ao Gold na Season 1. | Reach Gold in Season 1 | Alcance Gold na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"gold"} |
| rank-banner-slipstream / banner | Slipstream / Slipstream | Reached Platinum in Season 1. | Chegou ao Platinum na Season 1. | Reach Platinum in Season 1 | Alcance Platinum na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"platinum"} |
| rank-title-unstoppable / title | Unstoppable / Unstoppable | Reached Diamond in Season 1. | Chegou ao Diamond na Season 1. | Reach Diamond in Season 1 | Alcance Diamond na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"diamond"} |
| rank-banner-singularity / banner | Singularity / Singularity | Reached Champion in Season 1. | Chegou ao Champion na Season 1. | Reach Champion in Season 1 | Alcance Champion na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"champion"} |
| rank-title-rocketeer / title | Rocketeer / Rocketeer | Reached Champion in Season 1. | Chegou ao Champion na Season 1. | Reach Champion in Season 1 | Alcance Champion na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"champion"} |
| rank-banner-overdrive / banner | Overdrive / Overdrive | Reached Grand Champion in Season 1. | Chegou ao Grand Champion na Season 1. | Reach Grand Champion in Season 1 | Alcance Grand Champion na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"grand-champion"} |
| rank-banner-cosmic-ascension / banner | Cosmic Ascension / Cosmic Ascension | Supersonic Legend in Season 1. The top of the ladder. | Supersonic Legend na Season 1. O topo da escada. | Reach Supersonic Legend in Season 1 | Alcance Supersonic Legend na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"supersonic-legend"} |
| rank-title-rocket-demigod / title | Rocket Demigod / Rocket Demigod | Supersonic Legend in Season 1. | Supersonic Legend na Season 1. | Reach Supersonic Legend in Season 1 | Alcance Supersonic Legend na Season 1 | {"type":"season-rank","seasonId":1,"rankId":"supersonic-legend"} |
| runs-title-rookie / title | Rookie / Rookie | Your first run won. | Sua primeira run vencida. | Win your first run | Vença sua primeira run | {"type":"runs-won-since-s1","count":1} |
| runs-banner-blueprint / banner | Blueprint / Blueprint | Ten runs finished, win or lose. | Dez runs finalizadas, vencendo ou não. | Finish 10 runs, win or lose | Finalize 10 runs, vencendo ou não | {"type":"runs-finished-since-s1","count":10} |
| runs-banner-victory-lane / banner | Victory Lane / Victory Lane | Twenty-five runs won. | Vinte e cinco runs vencidas. | Win 25 runs | Vença 25 runs | {"type":"runs-won-since-s1","count":25} |
| runs-title-draft-veteran / title | Draft Veteran / Draft Veteran | One hundred runs won. | Cem runs vencidas. | Win 100 runs | Vença 100 runs | {"type":"runs-won-since-s1","count":100} |
| streak-title-on-a-roll / title | On a Roll / On a Roll | Three Legacy runs won in a row. | Três runs Legacy vencidas em sequência. | Win 3 Legacy runs in a row | Vença 3 runs Legacy em sequência | {"type":"legacy-streak","count":3} |
| streak-banner-heatwave / banner | Heatwave / Heatwave | Five Legacy runs won in a row. | Cinco runs Legacy vencidas em sequência. | Win 5 Legacy runs in a row | Vença 5 runs Legacy em sequência | {"type":"legacy-streak","count":5} |
| specials-title-card-hunter / title | Card Hunter / Card Hunter | Your first special card. | Sua primeira carta especial. | Collect your first special card | Consiga sua primeira carta especial | {"type":"specials-owned","count":1} |
| specials-banner-the-vault / banner | The Vault / The Vault | Ten different special cards collected. | Dez cartas especiais diferentes na coleção. | Collect 10 different special cards | Colecione 10 cartas especiais diferentes | {"type":"specials-owned","count":10} |
| missions-banner-target-practice / banner | Target Practice / Target Practice | Twenty-five missions completed. | Vinte e cinco missões completas. | Complete 25 missions | Complete 25 missões | {"type":"missions-completed","count":25} |
| quiz-title-rl-nerd / title | RL Nerd / RL Nerd | Ten daily quizzes solved. | Dez quizzes diários acertados. | Solve 10 daily quizzes | Acerte 10 quizzes diários | {"type":"quiz-solved","count":10} |
| quiz-banner-playbook / banner | Playbook / Playbook | Fifty daily quizzes solved. | Cinquenta quizzes diários acertados. | Solve 50 daily quizzes | Acerte 50 quizzes diários | {"type":"quiz-solved","count":50} |
| career-title-rtw-champion / title | Road to Worlds World Champion / Road to Worlds World Champion | Your org won the World Championship on the Road to Worlds. | Sua org venceu o Campeonato Mundial no Road to Worlds. | Win Worlds on the Road to Worlds | Vença um Mundial no Road to Worlds | {"type":"career-worlds","count":1} |
| challenge-title-homegrown / title | Homegrown / Homegrown | Three stars on Homegrown: one region, one identity. | Três estrelas em Homegrown: uma região, uma identidade. | Three stars on “Homegrown” | Três estrelas em “Homegrown” | {"type":"challenge-perfect","challengeId":"ch-homegrown"} |
| challenge-banner-golden-era / banner | Golden Era / Golden Era | Three stars on Time Capsule: an era, revisited. | Três estrelas em Time Capsule: uma era revisitada. | Three stars on “Time Capsule” | Três estrelas em “Time Capsule” | {"type":"challenge-perfect","challengeId":"ch-time-capsule"} |
| challenge-banner-back-to-basics / banner | Back to Basics / Back to Basics | Three stars on Pure Talent: base cards only. | Três estrelas em Pure Talent: só cartas base. | Three stars on “Pure Talent” | Três estrelas em “Pure Talent” | {"type":"challenge-perfect","challengeId":"ch-pure-talent"} |
| challenge-title-pure-talent / title | Pure Talent / Pure Talent | Three stars on Pure Talent: no specials, no shortcuts. | Três estrelas em Pure Talent: sem especiais, sem atalhos. | Three stars on “Pure Talent” | Três estrelas em “Pure Talent” | {"type":"challenge-perfect","challengeId":"ch-pure-talent"} |
| legacy-title-first-chapter / title | First Chapter / First Chapter | You were here before Season 1 existed. | Você estava aqui antes da Season 1 existir. | Finished a run in the pre-season | Concluiu uma run na pré-temporada | {"type":"legacy-participation"} |
| legacy-title-ps-board-champion / title | Pre-Season Leaderboard Champion / Pre-Season Leaderboard Champion | The first name at the top of the first board. | O primeiro nome no topo do primeiro ranking. | Finished #1 on the pre-season board | Terminou em #1 no ranking da pré-temporada | {"type":"legacy-position","minPosition":1,"maxPosition":1} |
| legacy-title-ps-board-2 / title | Pre-Season Leaderboard #2 / Pre-Season Leaderboard #2 | Finished the pre-season 2nd on the board. | Terminou a pré-temporada em 2º no ranking. | Finished #2 on the pre-season board | Terminou em #2 no ranking da pré-temporada | {"type":"legacy-position","minPosition":2,"maxPosition":2} |
| legacy-title-ps-board-3 / title | Pre-Season Leaderboard #3 / Pre-Season Leaderboard #3 | Finished the pre-season 3rd on the board. | Terminou a pré-temporada em 3º no ranking. | Finished #3 on the pre-season board | Terminou em #3 no ranking da pré-temporada | {"type":"legacy-position","minPosition":3,"maxPosition":3} |
| legacy-title-ps-board-elite / title | Pre-Season Leaderboard Elite / Pre-Season Leaderboard Elite | Finished the pre-season in the top 10 of the board. | Terminou a pré-temporada no top 10 do ranking. | Finished #4–10 on the pre-season board | Terminou entre #4 e #10 no ranking da pré-temporada | {"type":"legacy-position","minPosition":4,"maxPosition":10} |
| legacy-title-ps-board-finalist / title | Pre-Season Leaderboard Contender / Pre-Season Leaderboard Contender | Finished the pre-season in the top 50 of the board. | Terminou a pré-temporada no top 50 do ranking. | Finished #11–50 on the pre-season board | Terminou entre #11 e #50 no ranking da pré-temporada | {"type":"legacy-position","minPosition":11,"maxPosition":50} |
| legacy-title-ps-bronze / title | Pre-Season Bronze / Pre-Season Bronze | Reached Bronze in the pre-season. | Chegou ao Bronze na pré-temporada. | Peak pre-season rank: Bronze | Rank máximo na pré-temporada: Bronze | {"type":"legacy-rank","rankId":"bronze"} |
| legacy-title-ps-silver / title | Pre-Season Silver / Pre-Season Silver | Reached Silver in the pre-season. | Chegou ao Silver na pré-temporada. | Peak pre-season rank: Silver | Rank máximo na pré-temporada: Silver | {"type":"legacy-rank","rankId":"silver"} |
| legacy-title-ps-gold / title | Pre-Season Gold / Pre-Season Gold | Reached Gold in the pre-season. | Chegou ao Gold na pré-temporada. | Peak pre-season rank: Gold | Rank máximo na pré-temporada: Gold | {"type":"legacy-rank","rankId":"gold"} |
| legacy-title-ps-platinum / title | Pre-Season Platinum / Pre-Season Platinum | Reached Platinum in the pre-season. | Chegou ao Platinum na pré-temporada. | Peak pre-season rank: Platinum | Rank máximo na pré-temporada: Platinum | {"type":"legacy-rank","rankId":"platinum"} |
| legacy-title-ps-diamond / title | Pre-Season Diamond / Pre-Season Diamond | Reached Diamond in the pre-season. | Chegou ao Diamond na pré-temporada. | Peak pre-season rank: Diamond | Rank máximo na pré-temporada: Diamond | {"type":"legacy-rank","rankId":"diamond"} |
| legacy-title-ps-champion / title | Pre-Season Champion / Pre-Season Champion | Reached Champion in the pre-season. | Chegou ao Champion na pré-temporada. | Peak pre-season rank: Champion | Rank máximo na pré-temporada: Champion | {"type":"legacy-rank","rankId":"champion"} |
| legacy-title-ps-grand-champion / title | Pre-Season Grand Champion / Pre-Season Grand Champion | Reached Grand Champion in the pre-season. | Chegou ao Grand Champion na pré-temporada. | Peak pre-season rank: Grand Champion | Rank máximo na pré-temporada: Grand Champion | {"type":"legacy-rank","rankId":"grand-champion"} |
| legacy-title-ps-supersonic-legend / title | Pre-Season Supersonic Legend / Pre-Season Supersonic Legend | Supersonic Legend before the first season even started. | Supersonic Legend antes mesmo da primeira temporada começar. | Peak pre-season rank: Supersonic Legend | Rank máximo na pré-temporada: Supersonic Legend | {"type":"legacy-rank","rankId":"supersonic-legend"} |
| grant-title-50-50-staff / title | 50/50 Staff / 50/50 Staff | Manually granted to the 50/50 staff. | Concessão manual para a equipe 50/50. | Recognised as a member of the 50/50 staff | Reconhecido como membro da equipe 50/50 | {"type":"grant","grantId":"50-50-staff"} |
| grant-title-early-supporter / title | Early Supporter / Early Supporter | Played from the very start and helped spread the word. | Jogou desde o início e ajudou a divulgar o Rocket Draft. | Recognised as an early supporter | Reconhecido como early supporter | {"type":"grant","grantId":"early-supporter"} |
| grant-title-supporter / title | Supporter / Supporter | Backed Rocket Draft when it was just getting started. | Apoiou o Rocket Draft quando ele estava só começando. | Recognised as a supporter of the project | Reconhecido como apoiador do projeto | {"type":"grant","grantId":"supporter"} |
| grant-title-contributor / title | Contributor / Contributor | Helped build the game: data, art, testing or ideas. | Ajudou a construir o jogo: dados, arte, testes ou ideias. | Recognised as a contributor to the project | Reconhecido como contribuidor do projeto | {"type":"grant","grantId":"contributor"} |
| grant-title-pro / title | Pro Player / Pro Player | A verified RLCS professional plays here too. | Um profissional de RLCS verificado também joga aqui. | Verified RLCS pro player | Jogador profissional de RLCS verificado | {"type":"grant","grantId":"pro"} |

Raridades exibidas: exclusive: Exclusive / Exclusivo; common: Common / Comum; uncommon: Uncommon / Incomum; rare: Rare / Raro; epic: Epic / Épico; legend: Legendary / Lendário.

Ordem: cerimônia da carta especial → avanço de rank → Legacy (quando aplicável) → modais individuais de cosméticos após liberar o overlay. ChallengeScreen também usa RankUpCelebration. Recompensas de login/quiz/missões podem enfileirar cosméticos no mesmo modal; suas condições são as do catálogo acima.
