import { describe, expect, it } from "vitest";
import { PAGE_ROUTES } from "@/content/pageRoutes";
import { isGameRoute } from "./gameRoutes";

describe("isGameRoute", () => {
  it("is true for the home menu and the game screens", () => {
    for (const path of ["/", "/play", "/career", "/career/market", "/challenges", "/collection", "/profile", "/leaderboards", "/quiz", "/settings/"]) {
      expect(isGameRoute(path), path).toBe(true);
    }
  });

  it("is false for every content page, in both languages", () => {
    for (const { en, pt } of Object.values(PAGE_ROUTES)) {
      expect(isGameRoute(en), en).toBe(false);
      expect(isGameRoute(pt), pt).toBe(false);
    }
  });

  it("is false for the PT landing, the database and the reference pages", () => {
    for (const path of ["/pt", "/rlcs", "/rlcs/teams/g2-esports", "/rlcs/2027", "/how-to-play", "/changelog", "/privacy", "/careers"]) {
      expect(isGameRoute(path), path).toBe(false);
    }
  });
});
