import { describe, expect, it } from "vitest";
import { CAREER_CLOUD_STAFF_GRANTS, careerCloudAllowed } from "./careerCloudGate";

describe("careerCloudAllowed", () => {
  const staff = CAREER_CLOUD_STAFF_GRANTS[0];
  it("all: everyone, even with null grants", () => {
    expect(careerCloudAllowed(null, "all")).toBe(true);
    expect(careerCloudAllowed([], "all")).toBe(true);
  });
  it("off: nobody, not even Staff", () => {
    expect(careerCloudAllowed([staff], "off")).toBe(false);
    expect(careerCloudAllowed(null, "off")).toBe(false);
  });
  it("staff: only with the staff grant", () => {
    expect(careerCloudAllowed([staff], "staff")).toBe(true);
    expect(careerCloudAllowed(["pro", staff], "staff")).toBe(true);
    expect(careerCloudAllowed(["pro", "supporter"], "staff")).toBe(false);
    expect(careerCloudAllowed([], "staff")).toBe(false);
    expect(careerCloudAllowed(null, "staff")).toBe(false);
    expect(careerCloudAllowed(undefined, "staff")).toBe(false);
  });
  it("the default audience answers a boolean", () => {
    expect(typeof careerCloudAllowed([staff])).toBe("boolean");
  });
});
