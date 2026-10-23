import { expect } from "@open-wc/testing";
import { normalizeAppearanceMode } from "../../lib/types/ui.types";

describe("normalizeAppearanceMode", () => {
  it("defaults unsupported values to interactive", () => {
    expect(normalizeAppearanceMode("invalid")).to.equal("interactive");
  });

  it("preserves supported non-interactive modes", () => {
    expect(normalizeAppearanceMode("empty")).to.equal("empty");
    expect(normalizeAppearanceMode("none")).to.equal("none");
  });
});
