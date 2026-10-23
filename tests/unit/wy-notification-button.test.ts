import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import "../utils/version";
import "../../lib/wy-notification-button";
import type { WyNotificationButton } from "../../lib/wy-notification-button";

describe("wy-notification-button", () => {
  for (const appearance of ["sheet", "drawer", "modal", "full"] as const) {
    it(`scrolls overflowing notifications inside the ${appearance} overlay`, async () => {
      const button = await fixture<WyNotificationButton>(
        html`<wy-notification-button overlay=${appearance}></wy-notification-button>`
      );
      button.shadowRoot!.querySelector("wy-button")!.click();
      await button.updateComplete;

      const overlay = button.shadowRoot!.querySelector("wy-overlay")!;
      const container = overlay.querySelector("wy-container")!;
      await overlay.updateComplete;
      await container.updateComplete;

      // Use deterministic overflow without requiring a backend or notification query.
      const content = document.createElement("div");
      content.style.height = "2000px";
      content.style.flexShrink = "0";
      container.replaceChildren(content);

      const scroller = container.shadowRoot!.querySelector<HTMLElement>('[part~="wy-scroll-y"]')!;
      const panel = overlay.shadowRoot!.querySelector<HTMLElement>('[part~="wy-overlay"]')!;
      await waitUntil(() => panel.getBoundingClientRect().height > 0);

      expect(scroller.clientHeight).to.be.greaterThan(0);
      expect(scroller.scrollHeight).to.be.greaterThan(scroller.clientHeight);
      expect(scroller.getBoundingClientRect().bottom).to.be.at.most(panel.getBoundingClientRect().bottom + 1);

      scroller.scrollTop = scroller.scrollHeight;
      expect(scroller.scrollTop).to.be.greaterThan(0);
    });
  }
});
