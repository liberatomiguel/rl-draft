# rc.37 F1 handoff — market, valuation and renewals (`claude/rc37-market`)

1. **Catalog**: `listingFor` keeps the top 120 contracted (stars included) and tops up with signable players until 24 are signable, as the free agents do; prices, windows and rules unchanged. Dead `signableCapFreeAt` removed (no cap changes).
2. **Valuation**: ONE helper (`economy.talentFactorsFor`) feeds `marketValueFor`, `computeSalaryAsk` and the readout. It prices the reach gap: the potential his arc still lets him close (view `peakAge` + profile `plateauYears`, never the hidden peakOffset). Tiers: ×1.20 at gap 10 (= rc.36), ×1.40 at 15, ×1.70 at 20, ×2.34 at 28. A 70/98 is 1.67× a 70/85; the same talent costs the same at 17 and 21 (an u18 talent loses the 0.9 discount); an unreachable gap past the plateau is no longer paid. 19+ with gap ≤ 10: bit-identical to rc.36. Founding deals keep rc.36's factors exactly (`founding`, the project contract: real prospects founders would found at ×1.7). Careers on rc.31's model 1 price profile-free (no plateau in their growth).
3. **For F2**: price a player with `marketValueFor(market.valueInputOf(p, careerSeed, seasonIndex, growthModelOf(save.world)))`. A sale must honour `market.resaleLocked(p, seasonIndex, day)`: no sale in the signing window or the next one (Worlds window → next preseason). AI bids and the Blockbuster degrade already honour it.
4. **AI interest**: `bidWeightOf` adds the reach gap (8–30) at any age (70/98@17: 9 → 29). The daily chance keeps rc.36's formula over the players a bid may target only (not pending, not locked).
5. **Renewals**: the first renewal at the club (`SquadPlayer.renewalCount` 0) and tenure ≤ 2 stay rc.36. After that the jump climbs ×2.75 / ×3.0. The floor stays 0.6 (`floorPerSeason` 0): measured, a rising floor (0.9, even 0.7) sent the median hands-off career to the Backer. Premiums capped at ×1.45 and ×2.2 ÷ repPremium (worst single renewal ×4.35, rc.36 ×4.47). Title window fixed: `CareerSave.userTitlesBySeason`, per season with days; a mid-season signing only counts later titles.
6. **DEV-04**: new careers stamp `bandModel` 3. The true potential sits at a uniform place in the band (the L0 and L1 places uniform, L2 exactly 50/50 against earlier bands), and the age cap applies only once the age clock binds. rc.36-and-older careers keep their band.
7. **Tunables** (balance.ts, `// rc.37 F1` block): `CAREER_VALUATION`, `CAREER_TALENT`, `CAREER_RENEWAL_TENURE`. BALANCE_VERSION is not bumped, so `balanceVersion.test.ts` fails until integration. Saves are additive only (`renewalCount`, `userTitlesBySeason`, `bandModel` 3).
8. **Bot A/B** (playArcCareer, 7 regions, seed 9100, 7 seasons, vs an rc.36 approximation):
   - autopilot Normal: same Backer count (0); end balance p50 $186k (rc.36 $190k).
   - autopilot Hard: Backer 1 (rc.36 1); end balance p50 $21k (rc.36 $63k).
   - prospects hands-off: 0 Backer and 0 insolvency on both difficulties.
   - youth bot Hard: end balance p50 halves ($421k → $205k), from the talent prices. The battery should watch this.
9. **Tests**: `engine/career/rc37F1.test.ts` and `store/careerRc37Market.test.ts`. They cover the tiers, 70/85 vs 70/98, 17 vs 21, rc.36 parity, no time-only rise, the lock, the anti-flip, the Blockbuster, arc-priced bids, eligible-pool chance, model 1, founding, the ladder, the caps and the titles. Updated on purpose: careerJustSigned, careerAnalytics, careerDev04, careerContract, careerV03, careerM2. The renewal readout was checked in the browser.
10. **For Miguel**:
    - (a) A wonderkid on 3-season deals still renews at 2–6% of market (jumpMax 3.0).
    - (b) u18 non-talents keep 0.9.
    - (c) declineRate is not priced.
    - (d) Decliners with pot > ovr lose up to 23% of their price.
    - (e) The ask readout's "potential" line reveals the reach gap.
    - (f) The premium caps cut the 95@rep-30 extreme by 35%.
    - (g) Should a floor ladder come back for developed players only?
