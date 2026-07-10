/**
 * Road to Worlds — fictional sponsor brands (career-only data).
 *
 * All INVENTED brands (fan-game caution: no real companies). Ids match the
 * pool used by src/engine/career/economy.ts sponsorOffersFor. Monogram
 * fallback renders the mark; PNG drop-in convention can come later
 * (public/sponsors/<id>.png).
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
];

export const sponsorBrandById = new Map(SPONSOR_BRANDS.map((s) => [s.id, s]));
