//import { Weavy } from "../dist/weavy.esm";
import { Weavy } from "../src/index"

import { expect} from "@open-wc/testing";

function testReadOnly(obj: any, property: any) {
  return () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line no-self-assign
    obj[property] = obj[property];
  };
}

describe("WeavyContext", () => {

  it('has a static readonly "version"', async () => {


    expect(Weavy).to.have.property("version");
    expect(Weavy.version).to.have.length.above(0);
    expect(testReadOnly(Weavy, "version")).to.throw;
  });

  it('has a static readonly "name"', async () => {
    expect(Weavy).to.have.property("name");
    expect(Weavy.name).to.have.length.above(0);
    expect(testReadOnly(Weavy, "name")).to.throw;
  });

  it('has an "url" attribute with unreflected property', async () => {
    const weavy = new Weavy({ url: "http://localhost/" });

    expect(weavy).to.have.property("url").that.equals("http://localhost/");
    expect(() => {
      weavy.url = "https://192.168.0.1/";
    }).to.change(weavy, "url");
    expect(() => {
      weavy.url = new URL("/", "https://weavy.test/");
    }).to.change(weavy, "url");
    expect(() => { weavy.url = "not valid url" }).to.throw;
    expect(weavy.url).to.be.instanceOf(URL);
    expect(weavy.url?.toString()).to.equal("http://weavy/");
  });

  /*it('has a "config" attribute with unreflected property', async () => {
    const el = await fixture<WyProvider>(html`
      <wy-provider
        config='{ 
        "zoomAuthenticationUrl": "https://localhost:8001",
        "cloudFilePickerUrl": "https://localhost:8002",
        "reactions": ["⛓️‍💥", "🫎"],
        "locales": ["en-PI", "xx-pirate"],
        "localesUrl": "https://localhost:8003",
        "staleTime": 1,
        "gcTime": 1
      }'></wy-provider>
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
  });*/

  it('has a "locale" property that sets locale', async () => {
    const weavy = new Weavy({ locale: "en" });
    expect(() => (weavy.locales = ["en-PI"])).to.not.throw;
    expect(weavy).to.have.property("localization");

    expect(weavy).to.have.property("locale").that.equals("en");
    expect(() => weavy.localization?.setLocale("en-PI")).to.change(weavy, "locale");
    expect(weavy.locale).to.equal("en-PI");
    expect(() => (weavy.locale = "xx-pirate")).to.throw;
  });

  it('has a "tokenFactory" property that can be invoked', async () => {
    const weavy = new Weavy({ tokenFactory: async () => "token-factory-result"})

    expect(weavy).to.respondTo("tokenFactory");
    expect(await weavy.tokenFactory?.()).to.equal("token-factory-result");
  });

  /*it('has an "_weavyContext" property that is unaccessible from the outside', async () => {
    const el = await fixture<WeavyProvider>(html` <wy-provider></wy-provider> `)
    await el.updateComplete
    expect(el).property("_weavyContext").property("version").to.throw
    expect(el).property("_weavyContext").to.not.have.property("version").that.equals(el.version)
  })*/
});
