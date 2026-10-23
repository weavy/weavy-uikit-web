import { expect, fixture, html } from "@open-wc/testing";

import "../utils/version";
import { Weavy } from "../../lib/client/weavy";
import "../../lib/components/wy-conversation-header";
import type { WyConversationHeader } from "../../lib/components/wy-conversation-header";
import type { WyOverlay } from "../../lib/components/ui/wy-overlay";
import type { WyButton } from "../../lib/components/ui/wy-button";
import { AppTypeGuid, type AppType } from "../../lib/types/app.types";
import "../../lib/components/wy-conversation-list";
import type { WyConversationList } from "../../lib/components/wy-conversation-list";
import type { AppsResultType } from "../../lib/types/app.types";
import type { InfiniteData } from "@tanstack/query-core";

describe("wy-conversation-header", () => {
  let weavy: Weavy;
  let el: WyConversationHeader;

  beforeEach(async () => {
    weavy = new Weavy();
    weavy.queryClient.setQueryData(["members", 1], { data: [], count: 0 });
    el = await fixture<WyConversationHeader>(html`
      <wy-conversation-header
        .weavy=${weavy}
        .user=${{ id: 1, name: "Admin" }}
        .conversationId=${1}
        .conversation=${{ id: 1, type: AppTypeGuid.ChatRoom, name: "Room" } as AppType}
      ></wy-conversation-header>
    `);
  });

  afterEach(() => {
    el.remove();
    weavy.destroy();
  });

  it("ignores presence for contextual chats without members", async () => {
    el.conversation = { id: 1, type: AppTypeGuid.Chat, name: "Support" } as AppType;
    await el.updateComplete;
    weavy.queryClient.setQueryData(["apps", 1], el.conversation);
    weavy.queryClient.setQueryData(["members", 1], { data: [{ id: 2, presence: "away" }], count: 1 });

    el["handlePresenceChange"]([2]);

    expect(weavy.queryClient.getQueryData(["apps", 1])).to.equal(el.conversation);
    expect(weavy.queryClient.getQueryData(["members", 1])).to.deep.equal({
      data: [{ id: 2, presence: "away" }],
      count: 1,
    });
  });

  it("updates only private chat presence in mixed conversation lists", async () => {
    const list = await fixture<WyConversationList>(html`<wy-conversation-list></wy-conversation-list>`);
    list.weavy = weavy;
    const apps = [
      { id: 1, type: AppTypeGuid.Chat },
      { id: 2, type: AppTypeGuid.ChatRoom, members: { data: [{ id: 2, presence: "away" }], count: 1 } },
      { id: 3, type: AppTypeGuid.PrivateChat, members: { data: [{ id: 2, presence: "away" }], count: 1 } },
    ];
    const key = ["apps", "list"];
    weavy.queryClient.setQueryData(key, { pages: [{ data: apps, count: 3 }], pageParams: [{}] });

    list["handlePresenceChange"]([2]);

    const result = weavy.queryClient.getQueryData<InfiniteData<AppsResultType>>(key)!.pages[0].data;
    expect(result[0].members).to.equal(undefined);
    expect(result[1].members.data[0].presence).to.equal("away");
    expect(result[2].members.data[0].presence).to.equal("active");
    list.remove();
  });

  it("updates private chat presence in app and paged member caches", async () => {
    const members = { data: [{ id: 2, presence: "away" }, { id: 3, presence: "active" }], count: 2 };
    el.conversation = { id: 1, type: AppTypeGuid.PrivateChat, name: "Private", members } as AppType;
    await el.updateComplete;
    weavy.queryClient.setQueryData(["apps", 1], el.conversation);
    weavy.queryClient.setQueryData(["members", 1], members);

    el["handlePresenceChange"]([2]);

    const expected = { data: [{ id: 2, presence: "active" }, { id: 3, presence: "away" }], count: 2 };
    expect(weavy.queryClient.getQueryData<AppType>(["apps", 1])!.members).to.deep.equal(expected);
    expect(weavy.queryClient.getQueryData(["members", 1])).to.deep.equal(expected);
  });

  it("does not create cache entries when private chat presence arrives before data", async () => {
    el.conversation = { id: 1, type: AppTypeGuid.PrivateChat, name: "Private" } as AppType;
    await el.updateComplete;
    weavy.queryClient.removeQueries({ queryKey: ["apps", 1] });
    weavy.queryClient.removeQueries({ queryKey: ["members", 1] });

    el["handlePresenceChange"]([2]);

    expect(weavy.queryClient.getQueryData(["apps", 1])).to.equal(undefined);
    expect(weavy.queryClient.getQueryData(["members", 1])).to.equal(undefined);
  });

  it("replaces the default overlay header when opening Add members from Room details", async () => {
    el.shadowRoot!.querySelector<WyButton>("wy-titlebar wy-button")!.click();
    await el.updateComplete;

    const details = el.shadowRoot!.querySelector<WyOverlay>('wy-overlay[part~="wy-conversation-details"]')!;
    expect(details.show).to.equal(true);
    details.querySelector<HTMLElement>('wy-dropdown-item[part~="wy-conversation-details-add-members-action"]')!.click();
    await el.updateComplete;

    const overlay = el.shadowRoot!.querySelector<WyOverlay>('wy-overlay[part~="wy-conversation-add-members"]')!;
    await overlay.updateComplete;
    expect(details.show).to.equal(false);
    expect(overlay.show).to.equal(true);

    const headerSlot = overlay.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="header"]')!;
    const headers = headerSlot.assignedElements();
    expect(headers).to.have.lengthOf(1);
    expect(headers[0].tagName).to.equal("WY-TITLEBAR");
    expect(headers[0].querySelector('[slot="title"]')!.textContent).to.equal("Add members");
    expect(overlay.shadowRoot!.querySelector<HTMLSlotElement>("slot:not([name])")!.assignedElements()
      .some((element) => element.tagName === "WY-TITLEBAR")).to.equal(false);

    headers[0].querySelector("wy-button")!.click();
    await el.updateComplete;
    expect(overlay.show).to.equal(false);
  });

  it("shows a cancel icon before the title of a blocked private chat", async () => {
    el.conversation = {
      id: 1,
      type: AppTypeGuid.PrivateChat,
      name: "Wile E. Coyote",
      members: {
        data: [
          { id: 1, name: "Admin" },
          { id: 2, name: "Wile E. Coyote", is_blocked: true },
        ],
        count: 2,
      },
    } as AppType;
    await el.updateComplete;

    const title = el.shadowRoot!.querySelector("wy-titlebar-text")!;
    expect(title.firstElementChild?.firstElementChild?.tagName).to.equal("WY-ICON");
    expect(title.querySelector('wy-icon[name="cancel"]')).not.to.be.null;
  });
});
