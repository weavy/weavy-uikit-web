import "../dist/weavy-web";

import { expect, fixture, html } from "@open-wc/testing";
import type WyMessenger from "../src/wy-messenger";

function testReadOnly(obj: any, property: any) {
  return () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line no-self-assign
    obj[property] = obj[property];
  };
}

describe("wy-messenger", () => {
  it("has a shadowDom and a slot", async () => {
    const el = await fixture<WyMessenger>(html` <wy-messenger></wy-messenger> `);

    await el.updateComplete;

    expect(el).shadowDom.to.exist;
    //expect(el).shadowDom.to.equal(``);
    expect(el).lightDom.to.equal(``);
  });

  it('has a "themeColor" attribute with unreflected property that sets --wy-theme-color', async () => {
    const el = await fixture<WyMessenger>(html` <wy-messenger themecolor="#123456"></wy-messenger> `);
    await el.updateComplete;

    expect(el).to.have.property("themeColor").that.equals("#123456");
    expect(window.getComputedStyle(el).getPropertyValue("--wy-theme-color")).to.equal("#123456");

    const shadowRootElement =
      el.shadowRoot?.firstElementChild && window.getComputedStyle(el.shadowRoot.firstElementChild);
    expect(shadowRootElement?.getPropertyValue("--wy-theme-color")).to.equal("#123456");
  });


  it('has a "weavyContext" property that is unaccessible from the outside', async () => {
    const el = await fixture<WyMessenger>(html` <wy-messenger></wy-messenger> `)
    await el.updateComplete
    expect(el).property("weavyContext").property("version").to.throw
  })
});
