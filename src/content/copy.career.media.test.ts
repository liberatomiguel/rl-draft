/** v2.3 MEDIA: EN and PT keyed identically, the brand bank is fictional, every mail key renders in both languages. */
import { describe, expect, it } from "vitest";
import { CAREER_MEDIA } from "@/config/balance";
import { CAREER_MEDIA_EN } from "./copy.career.media.en";
import { CAREER_MEDIA_PT } from "./copy.career.media.pt";
import { CAREER_LOCKER_EN } from "./copy.career.locker.en";
import { CAREER_LOCKER_PT } from "./copy.career.locker.pt";
import { CAREER_EN } from "./copy.career.en";
import { CAREER_PT } from "./copy.career.pt";

function keysOf(o: unknown, prefix = ""): string[] {
  if (!o || typeof o !== "object") return [prefix];
  return Object.keys(o)
    .sort()
    .flatMap((k) => keysOf((o as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
}

/**
 * The real companies the bank plays on, and a wider list of real brands that
 * must never appear in it, as a name or as a whole word of one. "Uberly" is
 * not "Uber"; "Uber Rides" would be.
 */
const REAL_BRANDS = [
  "Red Bull", "Monster", "Adidas", "Nike", "Puma", "Pepsi", "Coca-Cola", "Coke", "Logitech", "Razer", "Nvidia", "Intel", "AMD",
  "Uber", "McDonald's", "McDonalds", "Burger King", "Netflix", "Spotify", "Amazon", "Samsung", "Nubank", "iFood", "Google",
  "Apple", "Microsoft", "Sony", "Visa", "Mastercard", "HyperX", "SteelSeries", "Corsair", "Mercedes", "BMW", "Toyota", "Gatorade",
  "Doritos", "Heineken", "Budweiser", "Rappi", "Itaú", "Bradesco", "Petrobras", "Coca", "Fanta", "Gillette", "Lego", "Dell", "Asus",
];

const P = {
  offerId: "media:1", player: "Zen", brand: 0, cash: "$1,200", days: 3, fromDow: 3, fromD: 12, fromM: 3, toDow: 5, toD: 14, toM: 3,
  deadlineDow: 2, deadlineD: 11, deadlineM: 3, event: "EU Regional 2", event2: "EU Qualifier 2", fatigue: 1, why: "seat",
};

describe("media copy", () => {
  it("EN and PT have the same keys and are spread into the career copy", () => {
    expect(keysOf(CAREER_MEDIA_PT)).toEqual(keysOf(CAREER_MEDIA_EN));
    expect(CAREER_EN.media).toBe(CAREER_MEDIA_EN);
    expect(CAREER_PT.media).toBe(CAREER_MEDIA_PT);
    expect(CAREER_LOCKER_EN.reasons.mediaFatigue).toBeTruthy();
    expect(CAREER_LOCKER_PT.reasons.mediaFatigue).toBeTruthy();
    for (const C of [CAREER_EN, CAREER_PT]) {
      expect(C.hub.absenceReasons.media).toBeTruthy();
      expect(C.finances.ledgerKind.mediaDay).toBeTruthy();
    }
  });

  it("has a bank of at least twelve brands, as many as the config says, none repeated", () => {
    for (const bank of [CAREER_MEDIA_EN.brands, CAREER_MEDIA_PT.brands]) {
      expect(bank.length).toBeGreaterThanOrEqual(12);
      expect(bank.length).toBe(CAREER_MEDIA.brands);
      expect(new Set(bank.map((b) => b.toLowerCase())).size).toBe(bank.length);
    }
  });

  it("names no real company: no brand is, or contains as a word, a real name", () => {
    const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9à-ú' -]/g, " ").split(/[\s-]+/).filter(Boolean);
    for (const bank of [CAREER_MEDIA_EN.brands, CAREER_MEDIA_PT.brands]) {
      for (const name of bank) {
        for (const real of REAL_BRANDS) {
          expect(name.toLowerCase(), `${name} vs ${real}`).not.toBe(real.toLowerCase());
          const padded = ` ${words(name).join(" ")} `;
          expect(padded.includes(` ${words(real).join(" ")} `), `${name} contains ${real}`).toBe(false);
        }
      }
    }
  });

  it("every mail template renders in both languages, with the dates, the cash and the event named", () => {
    for (const C of [CAREER_MEDIA_EN, CAREER_MEDIA_PT]) {
      for (const key of ["mediaOffer", "mediaCalledOff"]) {
        const title = C.mail.tpl[key](P);
        const body = C.mail.body[key](P);
        expect(title).toContain("Zen");
        expect(body).not.toContain("undefined");
        expect(body).not.toContain("NaN");
      }
      const offer = C.mail.body.mediaOffer(P);
      expect(offer).toContain("$1,200");
      expect(offer).toContain("EU Regional 2");
      expect(offer).toContain("EU Qualifier 2");
      expect(offer).toContain("12");
      expect(offer).toContain("14");
      expect(C.mail.body.mediaOffer({ ...P, event: undefined as unknown as string, event2: undefined as unknown as string, fatigue: 0 })).not.toContain("EU Regional");
      for (const status of ["accepted", "declined", "lapsed", "cancelled"]) expect(C.closed[status](P)).toBeTruthy();
      expect(C.answers.accept(P)).toContain("Zen");
      expect(C.answers.decline(P)).toBeTruthy();
      expect(C.mail.body.mediaCalledOff({ ...P, why: "gone" })).not.toBe(C.mail.body.mediaCalledOff(P));
    }
  });
});
