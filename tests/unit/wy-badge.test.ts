import { expect, fixture, html } from "@open-wc/testing";
import "../../lib/components/ui/wy-badge";
import type { WyBadge } from "../../lib/components/ui/wy-badge";

describe("wy-badge", () => {
  for (const content of ["3", "Draft"]) {
    for (const dot of [false, true]) {
      it(`does not default the title to ${content} with dot=${dot}`, async () => {
        const badge = await fixture<WyBadge>(html`<wy-badge ?dot=${dot}>${content}</wy-badge>`);
        const container = badge.shadowRoot!.querySelector('[part~="wy-badge"]')!;

        expect(badge.hasAttribute("title")).to.be.false;
        expect(container.hasAttribute("title")).to.be.false;
        expect(container.textContent).to.equal(content);
        if (dot) {
          expect(container.querySelector('[part~="wy-badge-label"]')?.textContent).to.equal(content);
        }
      });

      it(`uses only an explicit title with dot=${dot} and content=${content}`, async () => {
        const badge = await fixture<WyBadge>(
          html`<wy-badge ?dot=${dot} title="Unread conversations">${content}</wy-badge>`
        );
        const container = badge.shadowRoot!.querySelector('[part~="wy-badge"]')!;

        expect(container.getAttribute("title")).to.equal("Unread conversations");

        badge.title = "";
        await badge.updateComplete;

        expect(container.hasAttribute("title")).to.be.false;
      });
    }
  }

  it("adds the variant part only for color=variant", async () => {
    const badge = await fixture<WyBadge>(html`<wy-badge>3</wy-badge>`);
    const container = () => badge.shadowRoot!.querySelector('[part~="wy-badge"]')!;

    expect(container().getAttribute("part")).to.not.contain("wy-badge-variant");

    badge.color = "variant";
    await badge.updateComplete;
    expect(container().getAttribute("part")).to.contain("wy-badge-variant");
    expect(container().getAttribute("part")).to.contain("wy-badge-count");

    const variantText = await fixture<WyBadge>(html`<wy-badge color="variant">Draft</wy-badge>`);
    const textContainer = variantText.shadowRoot!.querySelector('[part~="wy-badge"]')!;
    expect(textContainer.getAttribute("part")).to.contain("wy-badge-variant");
    expect(textContainer.getAttribute("part")).to.contain("wy-badge-text");
  });
});
