import { expect, fixture, html } from "@open-wc/testing";

import "../utils/version";
import "../../lib";
import { type WyMessenger } from "../../lib";

describe("wy-messenger", () => {
  it("has a shadowDom and a slot", async () => {
    const el = await fixture<WyMessenger>(html` <wy-messenger></wy-messenger> `);

    await el.updateComplete;

    expect(el).shadowDom.to.exist;
    //expect(el).shadowDom.to.equal(``);
    expect(el).lightDom.to.equal(``);
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


  /*it('has a "weavyContext" property that is unaccessible from the outside', async () => {
    const el = await fixture<WyMessenger>(html` <wy-messenger></wy-messenger> `)
    await el.updateComplete
    expect(el).property("weavyContext").property("version").to.throw
  })*/
});
