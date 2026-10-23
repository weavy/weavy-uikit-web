import { expect, fixture, html } from "@open-wc/testing";

import "../utils/version";
import "../../lib";
import type { WyChat } from "../../lib/wy-chat";
import type { WyConversation } from "../../lib/components/wy-conversation";
import type { WyEditorMessage } from "../../lib/components/wy-editor-message";

describe("wy-chat", () => {
  it("hides and shows the chat when hidden is toggled", async () => {
    const el = await fixture<WyChat>(html`<wy-chat></wy-chat>`);

    expect(getComputedStyle(el).display).to.equal("flex");

    el.hidden = true;
    expect(getComputedStyle(el).display).to.equal("none");

    el.hidden = false;
    expect(getComputedStyle(el).display).to.equal("flex");
  });

  it("shows the empty slot and disables the editor until a uid is set", async () => {
    const el = await fixture<WyChat>(html`<wy-chat><span slot="empty">Select a chat</span></wy-chat>`);
    const conversation = el.shadowRoot!.querySelector<WyConversation>("wy-conversation")!;
    await conversation.updateComplete;
    const editor = conversation.shadowRoot!.querySelector<WyEditorMessage>("wy-editor-message")!;

    expect(conversation.disabled).to.equal(true);
    expect(editor.disabled).to.equal(true);
    expect(el.shadowRoot!.querySelector('slot[name="empty"]')).to.not.equal(null);

    el.uid = 1350;
    await el.updateComplete;
    await conversation.updateComplete;

    expect(conversation.disabled).to.equal(false);
    expect(editor.disabled).to.equal(false);
    expect(el.shadowRoot!.querySelector('slot[name="empty"]')).to.equal(null);
  });
});
