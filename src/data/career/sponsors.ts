/**
 * Road to Worlds — fictional sponsor brands (career-only data).
 *
 * All INVENTED brands (fan-game caution: no real companies). The first two
 * of each tier are the pool rc.33's offers drew from (economy.ts
 * sponsorOffersFor, kept for older saves and tests); rc.34 (ECO-04, S4)
 * offers three deals per decision, one per profile, each from a different
 * brand of the tier (sponsorDeals.sponsorDecisionFor), so the pool grows to
 * four a tier. Monogram fallback renders the mark; PNG drop-in convention
 * can come later (public/sponsors/<id>.png).
 */

export interface SponsorBrand {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  flavorEn: string;
  flavorPt: string;
}

export const SPONSOR_BRANDS: SponsorBrand[] = [
  {
    id: "voltway",
    name: "Voltway",
    tier: 1,
    flavorEn: "Community peripherals with lightning in the logo.",
    flavorPt: "Periféricos de comunidade com um raio no logo.",
  },
  {
    id: "nitrocore",
    name: "NitroCore",
    tier: 1,
    flavorEn: "Energy gum for people who type too fast.",
    flavorPt: "Chiclete energético para quem digita rápido demais.",
  },
  {
    id: "apexfuel",
    name: "ApexFuel",
    tier: 2,
    flavorEn: "The hydration brand of every underdog bracket run.",
    flavorPt: "A marca de hidratação de toda campanha de zebra.",
  },
  {
    id: "skyline-hw",
    name: "Skyline Hardware",
    tier: 2,
    flavorEn: "Mid-range rigs, top-range dreams.",
    flavorPt: "Máquinas intermediárias, sonhos de elite.",
  },
  {
    id: "turbomate",
    name: "TurboMate",
    tier: 3,
    flavorEn: "The global energy drink that shows up when you start winning.",
    flavorPt: "O energético global que aparece quando você começa a vencer.",
  },
  {
    id: "gridlock",
    name: "Gridlock Apparel",
    tier: 3,
    flavorEn: "Jersey drops that sell out before the grand final.",
    flavorPt: "Camisas que esgotam antes da grande final.",
  },
  {
    id: "ionbeam",
    name: "IonBeam",
    tier: 4,
    flavorEn: "Title-partner money. Championship expectations.",
    flavorPt: "Dinheiro de parceiro de título. Expectativa de campeonato.",
  },
  {
    id: "hyperlane",
    name: "Hyperlane",
    tier: 4,
    flavorEn: "A tech giant that only signs future world champions.",
    flavorPt: "Uma gigante de tecnologia que só assina com futuros campeões mundiais.",
  },
  // rc.34 (ECO-04, S4): two more brands a tier — a decision offers three.
  {
    id: "pixelpress",
    name: "PixelPress",
    tier: 1,
    flavorEn: "A print shop that sponsors anyone with a logo and a dream.",
    flavorPt: "Uma gráfica que patrocina qualquer um com um logo e um sonho.",
  },
  {
    id: "overclock-snacks",
    name: "Overclock Snacks",
    tier: 1,
    flavorEn: "Protein snacks sold at every LAN café in town.",
    flavorPt: "Barrinhas de proteína vendidas em toda lan house da cidade.",
  },
  {
    id: "kickoff-mobile",
    name: "Kickoff Mobile",
    tier: 2,
    flavorEn: "A phone network that wants its logo on every stream overlay.",
    flavorPt: "Uma operadora que quer o logo em todo overlay de stream.",
  },
  {
    id: "wallride-gear",
    name: "Wallride Gear",
    tier: 2,
    flavorEn: "Controllers tuned for players who live on the wall.",
    flavorPt: "Controles ajustados para quem vive na parede.",
  },
  {
    id: "ledgerline",
    name: "Ledgerline",
    tier: 3,
    flavorEn: "A digital bank that sponsors teams the way it lends: on numbers.",
    flavorPt: "Um banco digital que patrocina como empresta: pelos números.",
  },
  {
    id: "aerowave",
    name: "AeroWave Audio",
    tier: 3,
    flavorEn: "Headsets worn on every main stage this season.",
    flavorPt: "Headsets usados em todo palco principal da temporada.",
  },
  {
    id: "quantum-arc",
    name: "Quantum Arc",
    tier: 4,
    flavorEn: "A chipmaker that buys the jersey's front and the naming rights.",
    flavorPt: "Uma fabricante de chips que compra a frente da camisa e o nome da equipe.",
  },
  {
    id: "solstice-air",
    name: "Solstice Air",
    tier: 4,
    flavorEn: "An airline that flies its partners to every Major in first class.",
    flavorPt: "Uma companhia aérea que leva seus parceiros a todo Major de primeira classe.",
  },
];

export const sponsorBrandById = new Map(SPONSOR_BRANDS.map((s) => [s.id, s]));

/**
 * rc.33 (ECO-07): the rescue partner's brand (INVENTED) — the help that comes
 * with the Backer's loan at Easy's first breach (CAREER_LOAN.rescuePartner).
 * Not a sponsor deal: no tier, no objective; the terms live in balance.ts and
 * the copy (`finances.rescue*`).
 */
export const RESCUE_PARTNER_BRAND = { id: "overtime-fund", name: "Overtime Fund" } as const;
