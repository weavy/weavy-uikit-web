import "../dist/weavy";

import { expect, fixture, html } from "@open-wc/testing";
import type WyContext from "../src/wy-context";

function testReadOnly(obj: any, property: any) {
  return () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line no-self-assign
    obj[property] = obj[property];
  };
}

describe("wy-context", () => {
  it("has a shadowDom and a slot", async () => {
    const el = await fixture<WyContext>(html` <wy-context>Test</wy-context> `);

    await el.updateComplete;

    expect(el).shadowDom.to.exist;
    expect(el).shadowDom.to.equal(`<slot></slot>`);
    expect(el).lightDom.to.equal(`Test`);
  });

  it('has an "url" attribute with unreflected property', async () => {
    const el = await fixture<WyContext>(html` <wy-context url="http://localhost/"></wy-context> `);
    await el.updateComplete;

    expect(el, "initial url attribute").to.have.property("url")
    expect(el.url?.toString(), "initial url attribute as string").to.equal("http://localhost/");
    expect(el.url, "initial url as URL").to.have.property("host").that.equals("localhost");
    expect(() => {
      el.url = "https://192.168.0.1/";
    }).to.change(el, "url");
    expect(() => {
      el.url = new URL("/", "https://weavy.test/");
    }).to.change(el, "url");
    expect(el, "changed property url").to.have.attribute("url").that.equals("http://localhost/");
  });

  it('has a "tokenFactory" attribute with unreflected property that can be invoked', async () => {
    const el = await fixture<WyContext>(
      html` <wy-context tokenfactory="async () =&gt; 'token-factory-result'"></wy-context> `
    );
    await el.updateComplete;
    expect(el).to.respondTo("tokenFactory");
    expect(await el.tokenFactory?.()).to.equal("token-factory-result");
  });

  /*it('has a "config" attribute with unreflected property', async () => {
    const el = await fixture<WyContext>(html`
      <wy-context
        config='{ 
        "zoomAuthenticationUrl": "https://localhost:8001",
        "cloudFilePickerUrl": "https://localhost:8002",
        "reactions": ["⛓️‍💥", "🫎"],
        "locales": ["en-PI", "xx-pirate"],
        "localesUrl": "https://localhost:8003",
        "staleTime": 1,
        "gcTime": 1
      }'></wy-context>
    `);
    await el.updateComplete;

    expect(el).to.have.property("config").that.is.instanceOf(Object);
    expect(el.config).to.have.property("zoomAuthenticationUrl").that.equals("https://localhost:8001");
    expect(el.config).to.have.property("cloudFilePickerUrl").that.equals("https://localhost:8002");
    expect(el.config)
      .to.have.property("reactions")
      .that.is.instanceOf(Array)
      .with.lengthOf(2)
      .and.contains("⛓️‍💥")
      .and.contains("🫎");
    expect(el.config)
      .to.have.property("locales")
      .that.is.instanceOf(Array)
      .with.lengthOf(2)
      .and.contains("en-PI")
      .and.contains("xx-pirate");
    expect(el.config).to.have.property("localesUrl").that.equals("https://localhost:8003");
    expect(el.config).to.have.property("staleTime").that.equals(1);
    expect(el.config).to.have.property("gcTime").that.equals(1);

    expect(() => {
      el.setAttribute("config", "{ 'gcTime': 1 }");
    }, "invalid JSON").to.change(el, "config");
    expect(el).property("config").to.be.null;
  });
  */

  it('has a "locale" attribute with unreflected property that sets locale', async () => {
    const el = await fixture<WyContext>(html` <wy-context locale="en"></wy-context> `);
    expect(() => (el.locales = ["en-PI"])).to.not.throw;
    await el.updateComplete;

    expect(el).to.have.property("locale").that.equals("en");
    expect(() => el.setAttribute("locale", "en-PI")).to.change(el, "locale");
    expect(el.locale).to.equal("en-PI");
    expect(() => (el.locale = "xx-pirate")).to.throw;
  });



  /*it('has an "_weavyContext" property that is unaccessible from the outside', async () => {
    const el = await fixture<WeavyProvider>(html` <wy-provider></wy-provider> `)
    await el.updateComplete
    expect(el).property("_weavyContext").property("version").to.throw
    expect(el).property("_weavyContext").to.not.have.property("version").that.equals(el.version)
  })*/
});
