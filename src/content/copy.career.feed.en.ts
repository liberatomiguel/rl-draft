/**
 * v2.3 FEED: the fan feed's English copy, spread into the career copy
 * (`copy.career.en.ts`, one line). `copy.career.feed.pt.ts` has the same keys.
 *
 * `feed.text[key]` are the posts: `{slot}` placeholders, the keys of
 * engine/career/fanFeedVariants.ts. Fans write loose and short; no forced
 * memes, no insults, and a real player or org is only ever the subject of a
 * post, never its author and never quoted. `{score}` is the series score,
 * winner first. A claim ("dynasty", "best team in the region", "first title")
 * sits only in a variant the engine gates on the save's data.
 */
export const CAREER_FEED_EN = {
  feed: {
    title: "Fan feed",
    followers: "followers",
    likes: "likes",
    you: "You",
    prompt: "Post after the series?",
    skip: "Skip",
    tones: {
      humble: { label: "Humble", hint: "Respect the opponent. Small, steady growth." },
      confident: { label: "Confident", hint: "Say you are ready. Moderate growth." },
      provocative: { label: "Provocative", hint: "Poke the opponent. Big reach, and a loss to them gets quoted back." },
    },
    /** v2.3 UI (wave 2): the Fans view on the desk and the HQ card. */
    ui: {
      tab: "Fans",
      lead: "What the fans post about your club. Your posts and the receipts sit among theirs.",
      empty: "No posts yet.",
      emptyHint: "The fans start talking after your club's first series.",
      week: (w: number) => `Week ${w}`,
      likes: (n: string) => `${n} likes`,
      manager: "Manager",
      replyTo: "Replying to your post",
      receipt: "Receipt",
      quoting: (w: number) => `Your post, week ${w}`,
      showAll: (n: number) => `Show all ${n}`,
      nowTitle: "Post after the series",
      series: (won: boolean, score: string, opponent: string, event: string) =>
        won ? `${score} win over ${opponent} at ${event}.` : `${score} loss to ${opponent} at ${event}.`,
      pick: "Pick a tone to read the post before it goes out.",
      preview: "Your post",
      post: "Post",
      posted: "Posted",
      toFeed: "Open the fan feed",
      skipHint: "Skipping posts nothing; the fans keep talking either way.",
    },
    text: {
      "seriesWon.1": "Took {opponent} {score}. Clean series, no complaints.",
      "seriesWon.2": "Past {opponent} at {event}. Next one.",
      "seriesWon.3": "{score} for {org}. Not saying anything else today.",
      "seriesWon.4": "{opponent} had a plan. {org} had a better one.",
      "seriesWon.5": "{score} at {event}, and the bracket just got a lot more interesting.",
      "seriesWon.6": "{event} notes: {score} over {opponent}, and the rotations were sharp all series.",
      "seriesWon.7": "{org} beat {opponent}. Best team in the region right now, and it is not close.",

      "seriesLost.1": "{opponent} take it {score}. Hurts, but that series was there to be won.",
      "seriesLost.2": "{opponent} played the better series at {event}. Respect, and back to work.",
      "seriesLost.3": "{score}. {org} will have a lot of VODs to watch this week.",
      "seriesLost.4": "{opponent} had every answer today. {org} has homework.",
      "seriesLost.5": "{score} at {event}. Not the result we wanted, and not the performance either.",
      "seriesLost.6": "{event}: {score} to {opponent}. We go again.",

      "upsetWin.1": "On paper {opponent} should win this. {score} says otherwise.",
      "upsetWin.2": "{opponent} were the favourites at {event}, and nobody told the other side.",
      "upsetWin.3": "{score}. {org} just flipped the bracket upside down.",
      "upsetWin.4": "Underdogs? {org} just took down {opponent}.",
      "upsetWin.5": "Upset at {event}: {score}. Remember this one.",
      "upsetWin.6": "{event} upset alert: {opponent} lose {score}. The favourites did not see it coming.",

      "upsetLoss.1": "{opponent} win {score} when nobody expected it. Credit to them, but this one stings.",
      "upsetLoss.2": "Favourites on paper, beaten on the day. {opponent} earned it at {event}.",
      "upsetLoss.3": "{score}. {org} were supposed to win this one.",
      "upsetLoss.4": "{org} slipped against {opponent}. Upsets happen, now answer it.",
      "upsetLoss.5": "A shock at {event}: {score}. The bracket just got messy.",
      "upsetLoss.6": "{opponent} take it {score} at {event}, and the favourites fell.",

      "winStreak.1": "{streak} series wins in a row for {org}. The form is real.",
      "winStreak.2": "That is {streak} straight, and {opponent} were the latest.",
      "winStreak.3": "{streak} in a row and {event} is not slowing them down.",
      "winStreak.4": "{streak} straight series wins, the latest one {score}. Stay away from their side of the bracket.",
      "winStreak.5": "{org} extend the run to {streak} at {event}. Somebody has to stop them.",
      "winStreak.6": "{score} over {opponent} makes it {streak} in a row.",
      "winStreak.7": "{streak} straight wins. {org} are the best team in the region, simple as that.",
      "winStreak.8": "{streak} in a row, and the trophies are on the shelf. {org} are a dynasty.",

      "loseStreak.1": "{streak} series losses in a row for {org}. Something has to change.",
      "loseStreak.2": "{opponent} hand us loss number {streak} in a row.",
      "loseStreak.3": "{streak} defeats in a row and {event} did not stop it.",
      "loseStreak.4": "That is {streak} in a row, the latest {score}. Time to rethink the rotations?",
      "loseStreak.5": "{org} at {event}: {streak} losses running and patience is wearing thin.",
      "loseStreak.6": "{score} to {opponent} and the skid hits {streak}.",

      "signing.1": "{player} to {org}. Did not see that one coming.",
      "signing.2": "Welcome to {org}, {player}. The lineup just got more interesting.",
      "signing.3": "{org} sign {player}. Curious how the rotations change now.",
      "signing.4": "Big question for {org}: where does {player} fit? Excited to find out.",
      "signing.5": "{player} in {org} colours. The roster talk starts today.",
      "signing.6": "Finally some movement. {player} joins {org}.",
      "signing.7": "{org} paid {fee} for {player}. Now the plays have to follow.",
      "signing.8": "{player} leaves {from} for {org}. Quiet move, loud impact.",

      "sale.1": "{org} part ways with {player}. Respect for everything given to the team.",
      "sale.2": "End of the road for {player} at {org}. Wishing the best.",
      "sale.3": "{player} is out of {org}. What is the plan for that seat?",
      "sale.4": "Sad to see {player} leave {org}, but that is the business.",
      "sale.5": "{org} move on from {player}. Now show us the replacement.",
      "sale.6": "Thanks for everything, {player}. {org} will miss those plays.",
      "sale.7": "{player} off to {to}. {org} fans, thoughts?",
      "sale.8": "{fee} for {player}. {org} cashed in, now let us see how they spend it.",

      "titleWon.1": "{org} are {event} champions. I am not okay.",
      "titleWon.2": "CHAMPIONS. {event} belongs to {org}.",
      "titleWon.3": "{event} trophy goes to {org}. Every rotation was worth it.",
      "titleWon.4": "{org} win {event}. A whole season of work paid off.",
      "titleWon.5": "Say it with me: {org}, {event} champions.",
      "titleWon.6": "We waited for this. {org} lift the {event} trophy.",
      "titleWon.7": "{titles} Major and Worlds titles in the ledger. {event} confirms the dynasty.",
      "titleWon.8": "{org} win {event}: title number {titles} at the top level, and the first. History.",
      "titleWon.9": "Title number {titles} in the ledger. {event} goes on the list.",

      "finalLost.1": "{opponent} take {event}. So close, I am heartbroken.",
      "finalLost.2": "{org} fall in the {event} final. Proud of the run anyway.",
      "finalLost.3": "{org} lose the final to {opponent}. We go again.",
      "finalLost.4": "Runners-up at {event}, behind {opponent}. Silver is not gold, but the climb counts.",
      "finalLost.5": "Second place at {event}. {org} will remember this one.",
      "finalLost.6": "{opponent} lift the trophy at {event} while {org} watch. Next time.",

      "managerReply.1": "Class from the manager of {org} about {opponent}. Love to see it.",
      "managerReply.2": "Week {week}: a humble post about {opponent}. The locker room seems in a good place.",
      "managerReply.3": "{org} showing respect for {opponent}. That kind of calm wins series.",
      "managerReply.4": "{org} sound confident about {opponent}. Now they have to back it up.",
      "managerReply.5": "Week {week} and {org} sound sure about {opponent}. I like the confidence.",
      "managerReply.6": "{org} on {opponent}: confident. Confidence is cheap, results are not.",
      "managerReply.7": "{org} poking at {opponent} on the timeline. Popcorn ready.",
      "managerReply.8": "Week {week} drama: {org} stirring things up with {opponent}. Do not lose to them now.",
      "managerReply.9": "That post about {opponent}? Bold. {org} better deliver.",

      "receipt.1": "{org} had a lot to say about {opponent} and then lost. Receipts saved.",
      "receipt.2": "{opponent} win {score}. Funny, I remember a post about this matchup.",
      "receipt.3": "{opponent} replied at {event}, and not on the timeline.",
      "receipt.4": "{org} said it, {score} said otherwise. Delete the post?",
      "receipt.5": "{event}: {opponent} win {score}. Someone check that old post, it aged badly.",
      "receipt.6": "Poking {opponent} and losing to them at {event}. {org} will hear about this one for a while.",

      "managerPost.humble": "Great respect for {opponent}. {org} keeps working and lets the games talk.",
      "managerPost.confident": "{org} is ready for {opponent}. We trust our work.",
      "managerPost.provocative": "{opponent} should be worried. {org} is coming for this one.",
    } as Record<string, string>,
  },
};
