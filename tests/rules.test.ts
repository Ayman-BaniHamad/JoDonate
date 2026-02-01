import { canMarkDonated } from "../lib/rules";

describe("Mark Donated Business Rule", () => {
  test("returns true when status is accepted", () => {
    expect(canMarkDonated("accepted")).toBe(true);
  });

  test("returns false when status is available", () => {
    expect(canMarkDonated("available")).toBe(false);
  });

  test("returns false when status is donated", () => {
    expect(canMarkDonated("donated")).toBe(false);
  });
});
