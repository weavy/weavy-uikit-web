import { expect, fixture, html } from "@open-wc/testing";

import "../utils/version";
import "../../lib";
import { type WyMessenger } from "../../lib";
import type { WyConversationList } from "../../lib/components/wy-conversation-list";
import { AppTypeGuid } from "../../lib/types/app.types";

describe("wy-messenger", () => {
  it("has a shadowDom and a slot", async () => {
    const el = await fixture<WyMessenger>(html` <wy-messenger></wy-messenger> `);

    await el.updateComplete;

    expect(el).shadowDom.to.exist;
    //expect(el).shadowDom.to.equal(``);
    await expect(el).lightDom.to.equal(``);
  });

  it("keeps the messenger conversation types when an agent is configured", async () => {
    const el = await fixture<WyMessenger>(html`<wy-messenger></wy-messenger>`);
    const list = el.shadowRoot!.querySelector<WyConversationList>("wy-conversation-list")!;

    expect(list.conversationTypes).to.deep.equal([AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat]);

    // The inherited `agent` property no longer switches the messenger into agent mode
    el.agent = "assistant";
    await el.updateComplete;
    expect(list.conversationTypes).to.deep.equal([AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat]);
    expect("instructions" in el).to.equal(false);
  });

  /*it('has a "themeColor" attribute with unreflected property that sets --wy-theme-color', async () => {
    const el = await fixture<WyMessenger>(html` <wy-messenger themeColor="#123456"></wy-messenger> `);
    await el.updateComplete;

    expect(el).to.have.property("themeColor").that.equals("#123456");
    expect(window.getComputedStyle(el).getPropertyValue("--wy-theme-color")).to.equal("#123456");

    const shadowRootElement =
      el.shadowRoot?.firstElementChild && window.getComputedStyle(el.shadowRoot.firstElementChild);
    expect(shadowRootElement?.getPropertyValue("--wy-theme-color")).to.equal("#123456");
  });*/


  /*it('has a "weavy" property that is unaccessible from the outside', async () => {
    const el = await fixture<WyMessenger>(html` <wy-messenger></wy-messenger> `)
    await el.updateComplete
    expect(el).property("weavy").property("version").to.throw
  })*/
});
