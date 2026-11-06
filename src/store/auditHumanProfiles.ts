/** Test protocol, not gameplay tuning. Derived from the 04/11 evidence's source/final. */
import type { StatKey } from "@/engine/types";
import type { SquadFocus, TrainingObjective, TrainingWorkload } from "@/engine/career/types";
import type { ArcPolicy, ArcPolicyId } from "./auditHumanBot";
export interface HumanProfile { base: ArcPolicyId; changes: Partial<ArcPolicy>; description: string }
const common: Partial<ArcPolicy> = {
  humanPrefs: true, adaptFinances: true, regularCoachUpgrades: true, atomicMoves: true,
  maxUpgradePerWindow: true, infrastructure: true, fullSupport: true,
  bids: "whenTight", others: "take", protectPotential: true,
};
const prudent: Partial<ArcPolicy> = {
  ...common, negotiate: true, reserveWeeks: 4, runwayWeeks: 10,
  briefing: "adaptive", renewAtReviewOnly: true, payDebtIfCovered: true,
};
export const profiles: Record<string, HumanProfile> = {
  // Retain the four baseline policy definitions; new profiles are separate cohorts.
  learner: { base: "professional", changes: { ...common, market: "upgrade", upgradeMargin: 4, renew: "all", training: "delegate", negotiate: false, reserveWeeks: 2, runwayWeeks: 6, briefing: "keep" }, description: "Baseline learner: delegates, accepts asks, keeps a small reserve." },
  academy: { base: "academy", changes: { ...common, candidateMaxAge: 19, candidateMinBand: 88, buffType: "experience", coachPlans: false, scoutShortlist: true, negotiate: true, reserveWeeks: 4, runwayWeeks: 10, briefing: "recover" }, description: "Baseline academy: recruits by visible potential band, develops and retains youngsters." },
  known: { base: "professional", changes: { ...common, candidateKind: "real", buffType: "mechanics", upgradeMargin: 2, candidateMaxAge: 24, negotiate: true, reserveWeeks: 4, runwayWeeks: 10, briefing: "prepare" }, description: "Baseline fan of known real players." },
  ambitious: { base: "spender", changes: { ...common, market: "stars", buffType: "offense", coachPlans: false, trainingObjective: "preparation", upgradeMargin: 2, negotiate: true, shareWage: true, protectPotential: false, reserveWeeks: 2, runwayWeeks: 6, eagerInfrastructure: true, bank: true, sponsor: "bold", briefing: "prepare" }, description: "Baseline ambitious spender: strongest affordable players and progression early." },
  homegrown: { base: "academy", changes: { ...prudent, market: "keep", bids: "decline", renew: "all", coachPlans: false }, description: "Develops founding core; only replaces departures, including retirements." },
  prospectsOnly: { base: "academy", changes: { ...prudent, market: "youth", candidateMaxAge: 19, candidateMinBand: 85, scoutShortlist: true, coachPlans: false, bids: "decline" }, description: "Only prospects by public band; emergency seat filling may use a legal fallback (reported)." },
  stars: { base: "spender", changes: { ...prudent, market: "stars", candidateKind: "real", upgradeMargin: 1, protectPotential: false }, description: "Saves for known stars, constrained by real reputation gates and budget." },
  trader: { base: "professional", changes: { ...prudent, sellToFund: true, sellMinAge: 19, maxSalesPerSeason: true, protectPotential: false, upgradeMargin: 2 }, description: "One planned sale per season, reinvests in strength; can sell more to avert insolvency." },
  continuous: { base: "professional", changes: { ...prudent, sellToFund: true, sellMinAge: 0, maxSalesPerSplit: true, maxUpgradePerWindow: false, protectPotential: false, upgradeMargin: 1 }, description: "Seeks a sale every split and repeated upgrades; only real incoming AI bids." },
  buyAll: { base: "professional", changes: { ...prudent, eagerInfrastructure: true, reserveWeeks: 1, runwayWeeks: 4 }, description: "Buys every unlocked progression item as soon as the real flow permits it." },
  experienced: { base: "professional", changes: { ...prudent, sponsor: "steady", reserveWeeks: 8, runwayWeeks: 16, upgradeMargin: 4, sellToFund: true, sellMinAge: 23, maxSalesPerSeason: true }, description: "Negotiates, saves early, renews selectively, pays covered debt." },
  novice: { base: "professional", changes: { ...common, negotiate: false, reserveWeeks: 0, runwayWeeks: 0, eagerInfrastructure: true, renew: "all", protectPotential: false, training: "delegate", briefing: "keep" }, description: "Accepts asks, spends without a reserve, reacts to visible distress." },
  coachFixed: { base: "professional", changes: { ...prudent, keepFirstCoach: true }, description: "Keeps the first affordable coach." },
  coachUpgrades: { base: "professional", changes: { ...prudent, keepFirstCoach: false }, description: "Revisits coaches weekly and upgrades when affordable." },
};
// One-factor cohorts, not a factorial explosion; every style/plan is crossed with both seeds
// and every region/difficulty/roster. Other decisions use the same base to permit pairing.
for (const buffType of ["offense", "defense", "mechanics", "consistency", "experience", "clutch"] satisfies StatKey[]) {
  profiles['style-' + buffType] = { base: "professional", changes: { ...prudent, buffType }, description: "Founding style: " + buffType };
}
for (const objective of ["development", "preparation", "recovery"] satisfies TrainingObjective[]) {
  profiles['plan-' + objective] = { base: "professional", changes: { ...prudent, coachPlans: false, training: "repeat", trainingObjective: objective }, description: "Manual " + objective + ", normal workload, balanced focus, even scrims." };
}
for (const workload of ["light", "heavy"] satisfies TrainingWorkload[]) {
  profiles['load-' + workload] = { base: "professional", changes: { ...prudent, coachPlans: false, trainingPackage: { workload } }, description: "Manual development with " + workload + " workload." };
}
for (const focus of ["mechanics-lab", "rotations", "set-plays", "film-room", "clutch-sets"] satisfies SquadFocus[]) {
  profiles['focus-' + focus] = { base: "professional", changes: { ...prudent, coachPlans: false, trainingPackage: { focus } }, description: "Manual development focused on " + focus };
}
for (const scrimLevel of ["easy", "hard", "auto"] as const) {
  profiles['scrim-' + scrimLevel] = { base: "professional", changes: { ...prudent, coachPlans: false, scrimLevel }, description: "Manual development with " + scrimLevel + " scrims." };
}
profiles['scrim-off'] = { base: "professional", changes: { ...prudent, coachPlans: false, scrims: false }, description: "Manual development without scrims." };
profiles['plan-base'] = { base: "professional", changes: { ...prudent, training: "base", coachPlans: false }, description: "No paid package; same legal staff/gear purchases." };
profiles['plan-delegated'] = { base: "professional", changes: { ...prudent, training: "delegate" }, description: "Delegates available recommended plans to the coach." };
for (const briefing of ["none", "keep", "recover", "prepare", "adaptive"] as const) {
  profiles['briefing-' + briefing] = { base: "professional", changes: { ...prudent, briefing }, description: briefing === "none" ? "No explicit selection: real flow applies default briefing (currently Keep)." : "Uses " + briefing + " at each legal Sunday stop." };
}
