import { expect, fixture, html } from "@open-wc/testing";

import "../utils/version";
import "../../lib/components/wy-poll";
import type { WyPollOption } from "../../lib/components/wy-poll";
import type { WyBadge } from "../../lib/components/ui/wy-badge";

describe("wy-poll-option", () => {
  const badge = (el: WyPollOption) => el.shadowRoot!.querySelector<WyBadge>('[part~="wy-poll-amount"] wy-badge');

  it("shows the vote count in a badge with the share as hover text", async () => {
    const el = await fixture<WyPollOption>(html`
      <wy-poll-option .totalVotes=${3} .option=${{ id: 1, text: "Monday", votes: { count: 1 } }}></wy-poll-option>
    `);
    await badge(el)!.updateComplete;

    expect(badge(el)!.textContent!.trim()).to.equal("1");
    expect(badge(el)!.color).to.equal("variant");
    expect(badge(el)!.limit).to.equal(999);
    expect(badge(el)!.shadowRoot!.querySelector('[part~="wy-badge"]')!.getAttribute("title")).to.equal("33%");
    expect(el.shadowRoot!.querySelector('[part~="wy-poll-meter"]')!.getAttribute("style")).to.contain("33%");
    expect(el.shadowRoot!.querySelector('[part~="wy-poll-option"]')!.getAttribute("title")).to.equal("Click to vote");
  });

  it("shows no badge for an option without votes", async () => {
    const el = await fixture<WyPollOption>(html`
      <wy-poll-option .totalVotes=${3} .option=${{ id: 2, text: "Tuesday" }}></wy-poll-option>
    `);

    expect(el.shadowRoot!.querySelector('[part~="wy-poll-amount"]')).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part~="wy-poll-meter"]')!.getAttribute("style")).to.contain("0%");
  });
});
