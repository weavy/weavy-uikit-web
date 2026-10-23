import { expect, fixture } from "@open-wc/testing";
import type { LitElement } from "lit";

import "../utils/version";
import "../../lib";

describe("public component visibility", () => {
  const layouts = {
    flex: [
      "wy-chat",
      "wy-comments",
      "wy-conversations",
      "wy-copilot",
      "wy-feed",
      "wy-file",
      "wy-files",
      "wy-messenger",
      "wy-notifications",
      "wy-post-editor",
      "wy-posts",
    ],
    "inline-flex": ["wy-file-new", "wy-messenger-badge", "wy-notification-badge"],
    contents: [
      "wy-component",
      "wy-context",
      "wy-messenger-button",
      "wy-messenger-new",
      "wy-notification-button",
      "wy-notification-toasts",
    ],
  };

  for (const [display, tags] of Object.entries(layouts)) {
    for (const tag of tags) {
      it(`hides and restores ${tag} when hidden is toggled`, async () => {
        const el = await fixture<LitElement>(`<${tag}></${tag}>`);

        expect(getComputedStyle(el).display).to.equal(display);

        el.hidden = true;
        await el.updateComplete;
        expect(getComputedStyle(el).display).to.equal("none");

        el.hidden = false;
        await el.updateComplete;
        expect(getComputedStyle(el).display).to.equal(display);
      });
    }
  }
});
