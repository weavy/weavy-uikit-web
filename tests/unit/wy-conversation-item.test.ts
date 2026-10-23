import { expect, fixture, html, oneEvent } from "@open-wc/testing";

import "../utils/version";
import "../../lib/components/wy-conversation-item";
import type { WyConversationItem } from "../../lib/components/wy-conversation-item";
import { AppTypeGuid } from "../../lib/types/app.types";
import type { MsgType } from "../../lib/types/msg.types";
import type { WyAvatar } from "../../lib/components/ui/wy-avatar";

describe("wy-conversation-item", () => {
  const lastMessage = {
    id: 1,
    text: "Hello",
    plain: "Hello",
    created_at: "2026-10-20T12:00:00Z",
    created_by: { id: 2, name: "Support" },
  } as MsgType;

  it("renders and selects a contextual chat without members", async () => {
    const el = await fixture<WyConversationItem>(html`
      <wy-conversation-item
        .conversationId=${1350}
        .type=${AppTypeGuid.Chat}
        .name=${"Support chat"}
        .lastMessage=${lastMessage}
        .user=${{ id: 1, name: "Customer" }}
      ></wy-conversation-item>
    `);

    expect(el.shadowRoot!.querySelector('[slot="title"]')!.textContent).to.equal("Support chat");
    expect(el.shadowRoot!.querySelector("wy-typing")!.textContent).to.contain("Hello");
    expect(el.shadowRoot!.querySelector("wy-typing")!.textContent).to.contain("Support:");

    const avatar = el.shadowRoot!.querySelector<WyAvatar>("wy-avatar")!;
    await avatar.updateComplete;
    expect(avatar.shadowRoot!.querySelector('[part="wy-avatar-initials-text"]')!.textContent).to.equal("SC");
    expect(avatar.hasAttribute("presence")).to.equal(false);

    const selected = oneEvent(el, "selected");
    el.shadowRoot!.querySelector<HTMLElement>("wy-item")!.click();
    expect((await selected).detail.id).to.equal(1350);
  });

  it("keeps the other member's avatar name and presence for private chats", async () => {
    const el = await fixture<WyConversationItem>(html`
      <wy-conversation-item
        .type=${AppTypeGuid.PrivateChat}
        .name=${"Support chat"}
        .members=${{ data: [{ id: 2, name: "Jane Doe", presence: "active" }], count: 1 }}
        .user=${{ id: 1, name: "Customer" }}
      ></wy-conversation-item>
    `);
    const avatar = el.shadowRoot!.querySelector<WyAvatar>("wy-avatar")!;
    await avatar.updateComplete;

    expect(avatar.shadowRoot!.querySelector('[part="wy-avatar-initials-text"]')!.textContent).to.equal("JD");
    expect(avatar.getAttribute("presence")).to.equal("active");
  });

  it("prefixes messages from other members in group conversations even with only two members", async () => {
    const el = await fixture<WyConversationItem>(html`
      <wy-conversation-item
        .type=${AppTypeGuid.ChatRoom}
        .lastMessage=${lastMessage}
        .members=${{ data: [], count: 2 }}
        .user=${{ id: 1, name: "Customer" }}
      ></wy-conversation-item>
    `);

    expect(el.shadowRoot!.querySelector("wy-typing")!.textContent).to.contain("Support:");
    expect(el.shadowRoot!.querySelector("wy-typing")!.textContent).to.contain("Hello");
  });

  for (const type of [AppTypeGuid.PrivateChat, AppTypeGuid.AgentChat]) {
    it(`omits the other sender's name for ${type}`, async () => {
      const el = await fixture<WyConversationItem>(html`
        <wy-conversation-item
          .type=${type}
          .lastMessage=${lastMessage}
          .members=${{ data: [], count: 3 }}
          .user=${{ id: 1, name: "Customer" }}
        ></wy-conversation-item>
      `);

      const preview = el.shadowRoot!.querySelector("wy-typing")!.textContent!;
      expect(preview).to.contain("Hello");
      expect(preview).not.to.contain("Support:");
    });
  }

  for (const type of [AppTypeGuid.Chat, AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat, AppTypeGuid.AgentChat]) {
    it(`keeps the You prefix without adding the sender's name for ${type}`, async () => {
      const el = await fixture<WyConversationItem>(html`
        <wy-conversation-item
          .type=${type}
          .lastMessage=${lastMessage}
          .user=${{ id: 2, name: "Support" }}
        ></wy-conversation-item>
      `);

      const preview = el.shadowRoot!.querySelector("wy-typing")!.textContent!;
      expect(preview).to.contain("You:");
      expect(preview).not.to.contain("Support:");
    });
  }
});
