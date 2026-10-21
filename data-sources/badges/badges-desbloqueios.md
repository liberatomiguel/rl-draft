# Rocket Draft: catálogo de rewards e condições de desbloqueio

Documento atualizado em 21/10/2026 (revisão do HTML `Badges-Rocket-Draft-Revisado`). Reúne as 35 entradas do catálogo aprovado de badges. Os titles e banners oficiais estão em `cosmeticos-atualizado.md` (implementados no rc.20) — a proposta antiga de 42 cosméticos que vivia aqui foi substituída por aquele documento.

Mudanças da revisão: Season Elite cobre 4º–10º (as badges de 4º e 5º lugar saíram); Crowned World Champion passa a ser o PRIMEIRO Worlds (a World Champion original foi aposentada); Early Supporter entra nas concessões manuais; On Target em 25 missões; Pre-season Champion volta a épica; o pico de rank da pré-season é cumulativo ("pico ≥").

## Identificação

- Os **IDs das 36 badges aprovadas** correspondem exatamente ao campo `key` do HTML e ao nome do SVG, sem a extensão `.svg`. 
- As badges de leaderboard e de rank listadas são da **Pre-season**, identificada por `PS`. A entrega ocorre no encerramento da temporada, usando a posição final no leaderboard ou o pico de rank alcançado.
- A nova trilha de progressão da season entrega cosméticos imediatamente ao atingir cada rank; ela está detalhada na seção de novas recompensas.
- As metas de runs dos Veterans consideram **vitórias**. First Chapter exige concluir uma run válida na pré-season, antes do update da season 1.
- Leaderboard da pré-season: o jogador recebe só a faixa da sua posição (não cumulativo). Pico de rank: cumulativo — um pico Gold recebe Bronze, Silver e Gold (critério "pico ≥" do HTML).

## Sequência de login

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Spark | `spark` | Incomum | Fazer login em 7 dias consecutivos. |
| Wildfire | `wildfire` | Épica | Fazer login em 30 dias consecutivos. |

## Estrelas de challenges

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Rising Star | `rising-star` | Incomum | Acumular 25 estrelas em challenges. |
| Constellation | `constellation` | Rara | Acumular 50 estrelas em challenges. |

## Runs vencidas

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Veteran Drafter I | `veteran-drafter-1` | Incomum | Ganhar 50 runs. |
| Veteran Drafter II | `veteran-drafter-2` | Rara | Ganhar 250 runs. |
| Veteran Drafter III | `veteran-drafter-3` | Épica | Ganhar 500 runs. |
| Veteran Drafter IV | `veteran-drafter-4` | Lendária | Ganhar 1.000 runs. |

## Daily quiz

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Scholar I | `scholar-1` | Incomum | Acumular 10 acertos no daily quiz.  |
| Scholar II | `scholar-2` | Rara | Acumular 25 acertos no daily quiz.  |
| Scholar III | `scholar-3` | Épica | Acumular 50 acertos no daily quiz.  |

## Missões

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| On Target | `on-target` | Rara | Concluir 25 missões. |

## Participação na Pre-season

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| First Chapter | `first-chapter` | Rara | Concluir pelo menos 1 run durante a Pre-season. |

## Leaderboard da Pre-season

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Season Finalist | `season-finalist-ps` | Rara | Encerrar a Pre-season entre o 11º e o 50º lugar do leaderboard. |
| Season Elite | `season-elite-ps` | Épica | Encerrar a Pre-season entre o 4º e o 10º lugar do leaderboard. |
| Season Third Place | `season-third-place-ps` | Épica | Encerrar a Pre-season em 3º lugar no leaderboard. |
| Season Runner-up | `season-runner-up-ps` | Épica | Encerrar a Pre-season em 2º lugar no leaderboard. |
| Season Champion | `season-champion-ps` | Lendária | Encerrar a Pre-season em 1º lugar no leaderboard. |

## Pico de rank na Pre-season

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Pre-season Bronze | `pre-season-bronze` | Comum | Atingir Bronze ou superior como pico de rank durante a Pre-season. |
| Pre-season Silver | `pre-season-silver` | Comum | Atingir Silver ou superior como pico de rank durante a Pre-season. |
| Pre-season Gold | `pre-season-gold` | Incomum | Atingir Gold ou superior como pico de rank durante a Pre-season. |
| Pre-season Platinum | `pre-season-platinum` | Incomum | Atingir Platinum ou superior como pico de rank durante a Pre-season. |
| Pre-season Diamond | `pre-season-diamond` | Rara | Atingir Diamond ou superior como pico de rank durante a Pre-season. |
| Pre-season Champion | `pre-season-champion` | Épica | Atingir Champion ou superior como pico de rank durante a Pre-season. |
| Pre-season Grand Champion | `pre-season-grand-champion` | Épica | Atingir Grand Champion ou superior como pico de rank durante a Pre-season. |
| Pre-season Supersonic | `pre-season-supersonic` | Lendária | Atingir Supersonic Legend como pico de rank durante a Pre-season. |

## Road to Worlds

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Road Warrior | `road-warrior` | Rara | completar 3 temporadas no Road to Worlds. O catálogo registra o código `car-three-seasons`. |
| Underdog | `underdog` | Rara |  vencer um regional, major ou worlds como azarão no Road to Worlds (overall +3 pontos abaixo dos outros times). Código atual: `car-worlds-underdog`. |
| Dynasty | `dynasty` | Lendária | Na mesma season, atingir SSL, vencer 3 Worlds no Road to Worlds e ganhar 25 runs no modo legacy. |

Regras da Dynasty
- Usar o pico de rank da season para verificar SSL. Uma queda de rank posterior mantém esse requisito cumprido.
- Os três requisitos podem ser cumpridos em qualquer ordem.
- As 3 vitórias de Worlds e as 25 vitórias no modo Legacy devem pertencer à mesma season em que o pico de SSL foi alcançado.
- Conceder a badge assim que o último requisito for cumprido. A badge permanece na coleção após o encerramento da season.

## Crowned World Champion

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Crowned World Champion | `world-champion-crowned` | Épica | Vencer o primeiro Worlds no Road to Worlds (acompanha o title Road to Worlds Champion). |

## Concessão manual

| Badge | ID | Raridade | Condição de desbloqueio |
| --- | --- | --- | --- |
| Early Supporter | `early-supporter` | Épica | Receber concessão manual como early supporter: jogou desde o início e ajudou a divulgar o Rocket Draft. |
| Contributor | `contributor` | Épica | Receber concessão manual como contributor, por contribuição ao projeto. |
| Verified Pro | `verified-pro` | Épica | Receber concessão manual como jogador profissional verificado. |
| Supporter | `supporter` | Épica | Receber concessão manual como apoiador do projeto. |

## Temporadas futuras

O HTML já possui um gerador de badges de rank por temporada: `rankBadge(rankKey, seasonKey)`. As amostras de S1, S2 e S3 demonstram a aplicação do selo de temporada.

| Temporada | Prefixo gerado para badges de rank | Exemplo |
| --- | --- | --- |
| Pre-season | `pre-season-` | `pre-season-gold` |
| Season 1 | `season-1-` | `season-1-gold` |
| Season 2 | `season-2-` | `season-2-gold` |
| Season 3 | `season-3-` | `season-3-gold` |

O rank Supersonic Legend usa o sufixo `supersonic` nos IDs, como `pre-season-supersonic`. Para o leaderboard, os IDs cadastrados terminam em `-ps`; o padrão de IDs das próximas temporadas ainda precisa ser definido.

---
