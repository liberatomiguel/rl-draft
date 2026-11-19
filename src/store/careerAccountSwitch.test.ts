/**
 * v2.0.29 (DESIGN-DECISIONS #170): Road to Worlds on a device shared by two
 * accounts. The REAL account store, career store and career cloud store run on
 * a stand-in localStorage (installed BEFORE the stores load, so the career store
 * persists to it); `@/lib/supabase` is mocked.
 *
 * Miguel's report (18/11): signed out of his main account, the progress stayed;
 * signed into a second account, everything went into it. The careers had the
 * same hole: the slots are the device's, so the second account's first sync
 * uploaded the first account's careers as its own.
 */
import type { Session } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CareerSave } from "@/engine/career/types";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("window", { localStorage: storage, addEventListener: () => {}, removeEventListener: () => {}, location: { hostname: "localhost", href: "http://localhost/", pathname: "/" } });

const h = vi.hoisted(() => ({
  onAuthChange: vi.fn(),
  fetchCloudRow: vi.fn(),
  pushCloudProfile: vi.fn(),
  fetchCareerMetas: vi.fn(),
  fetchCareerSave: vi.fn(),
  pushCareerSave: vi.fn(),
  deleteCareerSave: vi.fn(),
}));

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  accountsEnabled: true,
  hasStoredAuthSession: () => false,
  onStoredAuthSession: () => () => {},
  signOut: async () => {},
  ...h,
}));

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: () => {},
}));

type AuthCb = (session: Session | null, event: string) => void;
let auth: AuthCb;
let stores: {
  career: typeof import("./careerStore");
  cloud: typeof import("./careerCloudStore");
  flow: typeof import("./careerFlow");
  account: typeof import("./accountStore");
};

const userA = { user: { id: "user-A", email: "a@example.com" } } as unknown as Session;
const userB = { user: { id: "user-B", email: "b@example.com" } } as unknown as Session;

const tick = () => new Promise<void>((r) => setImmediate(r));
async function settle(): Promise<void> {
  for (let calm = 0, i = 0; calm < 8 && i < 400; i++) {
    await tick();
    const busy = stores.cloud.useCareerCloudStore.getState().syncing || stores.account.useAccountStore.getState().syncing;
    calm = busy ? 0 : calm + 1;
  }
}

/** What each account holds in the cloud, by slot. */
const cloudRows: Record<string, Record<number, { save: CareerSave; revision: number }>> = {};

beforeAll(async () => {
  stores = {
    account: await import("./accountStore"),
    career: await import("./careerStore"),
    cloud: await import("./careerCloudStore"),
    flow: await import("./careerFlow"),
  };
  h.fetchCloudRow.mockResolvedValue({ status: "no-row" });
  h.pushCloudProfile.mockResolvedValue({});
  h.fetchCareerMetas.mockImplementation(async (uid: string) => ({
    status: "ok",
    slots: Object.entries(cloudRows[uid] ?? {}).map(([slot, r]) => ({
      slot: Number(slot),
      careerId: r.save.careerId,
      saveVersion: r.save.saveVersion ?? 1,
      seq: r.save.seq ?? 0,
      revision: r.revision,
      savedAt: r.save.lastPlayedAt ?? 0,
      updatedAt: 1,
      deviceId: "here",
      summary: { orgName: r.save.identity.orgName },
    })),
  }));
  h.pushCareerSave.mockImplementation(async (uid: string, input: { slot: number; careerId: string }) => {
    const save = stores.career.useCareerStore.getState().slots[input.slot]!;
    const rows = (cloudRows[uid] ??= {});
    const revision = (rows[input.slot]?.revision ?? 0) + 1;
    rows[input.slot] = { save: JSON.parse(JSON.stringify(save)), revision };
    return { status: "ok", revision, updatedAt: 2 };
  });
  h.deleteCareerSave.mockResolvedValue({ status: "ok", deleted: true });
  stores.account.useAccountStore.getState().init();
  auth = h.onAuthChange.mock.calls.at(-1)![0] as AuthCb;
  stores.cloud.useCareerCloudStore.getState().start();
});

const slots = () => stores.career.useCareerStore.getState().slots;

describe("one device, two accounts: the careers are the signed-in account's", () => {
  it("a guest's career goes to the first account, leaves with it, and never reaches the second", async () => {
    // A guest founds a club.
    const save = stores.flow.createCareerSave(
      {
        identity: { orgName: "Guest Org", abbrev: "GST", managerName: "M", country: "BR", region: "SAM", crestId: "shield", colors: { primary: "#f97316", secondary: "#fde68a" }, buffType: "consistency" },
        difficulty: "normal",
        rosterKey: "balanced",
      },
      7,
    );
    save.careerId = "career-1";
    stores.career.useCareerStore.setState({ slots: [save, null, null], activeSlot: 0 });
    expect(storage.getItem("rocket-draft:career:v1")).toContain("career-1");

    // Account A signs in: the guest's career becomes A's and goes up.
    auth(userA, "SIGNED_IN");
    await settle();
    expect(cloudRows["user-A"]?.[0]?.save.careerId).toBe("career-1");

    // A signs out: the device has no careers, and nothing is deleted from A's account.
    auth(null, "SIGNED_OUT");
    await settle();
    expect(slots()).toEqual([null, null, null]);
    expect(storage.getItem("rocket-draft:career:v1") ?? "").not.toContain("career-1");
    expect(storage.getItem("rocket-draft:career-stash:v1:user-A")).toContain("career-1");

    // B signs in: B neither sees nor receives A's career.
    auth(userB, "SIGNED_IN");
    await settle();
    expect(slots()).toEqual([null, null, null]);
    expect(cloudRows["user-B"] ?? {}).toEqual({});

    // B signs out, A comes back: A's career is in its slot again, still in A's account.
    auth(null, "SIGNED_OUT");
    await settle();
    auth(userA, "SIGNED_IN");
    await settle();
    expect(slots()[0]?.careerId).toBe("career-1");
    expect(h.deleteCareerSave).not.toHaveBeenCalled();
    expect(cloudRows["user-A"]?.[0]?.save.careerId).toBe("career-1");
    expect(storage.getItem("rocket-draft:career-stash:v1:user-A")).toBeNull();
  });
});
