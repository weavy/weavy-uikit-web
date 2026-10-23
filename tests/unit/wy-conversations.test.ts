import { expect, fixture, html, oneEvent } from "@open-wc/testing";

import "../utils/version";
import "../../lib";
import type { WyConversations } from "../../lib/wy-conversations";
import type { WyConversationList } from "../../lib/components/wy-conversation-list";
import { AppTypeGuid, type AppType } from "../../lib/types/app.types";

describe("wy-conversations", () => {
  it("accepts chat types from markup and updates the list when the attribute changes", async () => {
    const el = await fixture<WyConversations>(html`<wy-conversations appTypes="chat"></wy-conversations>`);
    const list = el.shadowRoot!.querySelector<WyConversationList>("wy-conversation-list")!;

    expect(el.appTypes).to.deep.equal([AppTypeGuid.Chat]);
    expect(list.conversationTypes).to.deep.equal([AppTypeGuid.Chat]);

    el.setAttribute("appTypes", `  chat_room \t ${AppTypeGuid.PrivateChat}  `);
    await el.updateComplete;
    expect(list.conversationTypes).to.deep.equal([AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat]);

    el.setAttribute("appTypes", "");
    await el.updateComplete;
    expect(list.conversationTypes).to.deep.equal([]);

    el.removeAttribute("appTypes");
    await el.updateComplete;
    expect(list.conversationTypes).to.deep.equal([AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat]);
  });

  it("renders only the list without creation controls or slots", async () => {
    const el = await fixture<WyConversations>(html`<wy-conversations></wy-conversations>`);
    const list = el.shadowRoot!.querySelector<WyConversationList>("wy-conversation-list")!;

    expect(list.conversationTypes).to.deep.equal([AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat]);
    expect(el.shadowRoot!.querySelector("wy-conversation-new")).to.equal(null);
    expect(el.shadowRoot!.querySelector("slot")).to.equal(null);
    expect("createConversation" in el).to.equal(false);
    expect("selectMembers" in el).to.equal(false);
  });

  it("does not overwrite configured app types when an agent is configured", async () => {
    const el = await fixture<WyConversations>(html`
      <wy-conversations .appTypes=${[AppTypeGuid.Chat]} agent="assistant"></wy-conversations>
    `);
    const list = el.shadowRoot!.querySelector<WyConversationList>("wy-conversation-list")!;

    expect(el.appTypes).to.deep.equal([AppTypeGuid.Chat]);
    expect(list.conversationTypes).to.deep.equal([AppTypeGuid.Chat]);
  });

  it("updates the selection and forwards the select action", async () => {
    const el = await fixture<WyConversations>(html`<wy-conversations></wy-conversations>`);
    const list = el.shadowRoot!.querySelector<WyConversationList>("wy-conversation-list")!;
    const app = { id: 1350, type: AppTypeGuid.Chat, name: "Support" } as AppType;
    const selected = oneEvent(el, "wy-action");

    list.selectConversation(app);
    const event = await selected;
    await el.updateComplete;

    expect(el.conversationId).to.equal(1350);
    expect(event.detail).to.deep.equal({ action: "select", app });
    expect(list.conversationId).to.equal(1350);
  });
});
