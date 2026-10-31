import { describe, expect, it } from "vitest";
import { followBoardOf } from "./followView";
const event: Parameters<typeof followBoardOf>[0] = {
  teams: ["a", "b", "c"].map((id) => ({ id, name: id, rating: 80 })),
  seeds: ["c", "a", "b"],
  swiss: [[{ a: "a", b: "b", sa: 3, sb: 1 }], [{ a: "a", b: "c", sa: 0, sb: 3 }]],
  playoffs: [{ name: "semifinal", series: [{ a: "a", b: "b", sa: 4, sb: 2 }] }, { name: "final", series: [{ a: "a", b: "c", sa: 2, sb: 4 }] }],
};
describe("spectator boards from recorded rounds", () => {
  it("keeps playoff seeds and results hidden while Swiss is being revealed", () => {
    const initial = followBoardOf(event, 0);
    expect(initial.tournament.playoffs?.seeds).toEqual([]);
    expect(initial.tournament.playoffs?.rounds).toEqual([]);
    expect(initial.records.get("a")?.wins).toBe(0);
    const next = followBoardOf(event, 1);
    expect(next.records.get("a")?.wins).toBe(1);
    expect(next.records.get("c")?.wins).toBe(0);
    expect(next.tournament.playoffs?.rounds).toEqual([]);
  });
  it("uses the actual recorded bracket and only marks watched rounds as revealed", () => {
    const swiss = followBoardOf(event, 2);
    expect(swiss.tournament.playoffs?.seeds).toEqual(event.seeds);
    expect(swiss.revealed.size).toBe(0);
    const semi = followBoardOf(event, 3);
    expect([...semi.revealed]).toEqual(["po:0:0"]);
    expect(semi.tournament.playoffs?.rounds[0].series[0].score).toEqual([4, 2]);
    expect([...followBoardOf(event, 4).revealed]).toEqual(["po:0:0", "po:1:0"]);
  });
});
