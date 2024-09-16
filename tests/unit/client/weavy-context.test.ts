import { defineCE, expect, fixture } from "@open-wc/testing";
import { testReadOnly } from "../../utils/properties";

import "../../utils/version";
import { Weavy, type WeavyType } from "../../../lib";
import { isPlainObject } from "../../../lib/utils/objects";
import { LitElement } from "lit";
import { WeavyContext } from "../../../lib/contexts/weavy-context";
import { ContextConsumer } from "@lit/context";
import { DestroyError } from "../../../lib/utils/errors";

describe("Weavy class", () => {
  it('has a "version"', async () => {
    expect(Weavy).to.have.property("version");
    expect(Weavy.version).to.have.length.above(0);
    expect(testReadOnly(Weavy, "version")).to.not.throw(TypeError);
  });

  it('has a "sourceName"', async () => {
    expect(Weavy).to.have.property("sourceName");
    expect(Weavy.sourceName).to.have.length.above(0);
    expect(testReadOnly(Weavy, "sourceName")).to.not.throw(TypeError);
  });

  it('has "default" config properties', async () => {
    expect(Weavy).to.have.property("defaults").that.satisfies(isPlainObject);
    expect(Weavy.defaults).to.have.property("cloudFilePickerUrl", "https://filebrowser.weavy.io/v14/");
    expect(Weavy.defaults).to.have.property("confluenceAuthenticationUrl", undefined);
    expect(Weavy.defaults).to.have.property("confluenceProductName", undefined);
    expect(Weavy.defaults).to.have.property("disableEnvironmentImports", false);
    expect(Weavy.defaults).to.have.property("gcTime", 86400000);
    expect(Weavy.defaults).to.have.property("locale", "en");
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(Weavy.defaults).to.have.property("reactions").to.be.an("array").that.is.not.empty;
    expect(Weavy.defaults).to.have.property("scrollBehavior").to.be.oneOf(["smooth", "instant"]);
    expect(Weavy.defaults).to.have.property("staleTime", 1000);
    expect(Weavy.defaults).to.have.property("tokenFactoryRetryDelay", 2000);
    expect(Weavy.defaults).to.have.property("tokenFactoryTimeout", 20000);
    expect(Weavy.defaults).to.have.property("zoomAuthenticationUrl", undefined);
  });
});

describe("WeavyClient", () => {
  let weavy: WeavyType;
  let anotherWeavy: WeavyType;

  afterEach(() => {
    weavy?.destroy();
    anotherWeavy?.destroy();
  });

  it('has a "weavySid" property that is unique', async () => {
    weavy = new Weavy();
    expect(weavy).to.have.property("weavySid").with.lengthOf(4);
    //expect(testReadOnly(weavy, "weavySid")).to.throw(TypeError);

    anotherWeavy = new Weavy();
    expect(anotherWeavy.weavySid).to.not.equal(weavy.weavySid);
  });

  it('has a "weavyId" property that is unique', async () => {
    weavy = new Weavy();
    expect(weavy).to.have.property("weavyId").with.lengthOf.at.least(3).and.contain("#");
    //expect(testReadOnly(weavy, "weavyId")).to.throw(TypeError);

    anotherWeavy = new Weavy();
    expect(anotherWeavy.weavyId).to.not.equal(weavy.weavyId);
  });

  it('has a "host" property of type Element', async () => {
    weavy = new Weavy();
    expect(weavy).to.have.property("host").that.is.instanceOf(HTMLElement);
    //expect(testReadOnly(weavy, "host")).to.throw(TypeError);
  });

  it('has an "url" property that returns an URL', async () => {
    weavy = new Weavy({ url: "http://localhost/" });

    expect(weavy).to.have.property("url").with.property("href").that.equals("http://localhost/");
    expect(() => {
      weavy.url = "https://192.168.0.1/";
    }).to.change(weavy, "url");
    expect(() => {
      weavy.url = new URL("/", "https://weavy.test/");
    }).to.change(weavy, "url");

    expect(weavy.url).to.be.instanceOf(URL);
    expect(weavy.url?.toString()).to.equal("https://weavy.test/");
    
    expect(() => {
      weavy.url = "";
    }).to.not.change(weavy, "url");
    expect(() => {
      weavy.url = "this becomes a relative url";
    }).to.not.throw(TypeError);
    expect(weavy.url?.toString()).to.satisfy((s: string) => s.endsWith("/this%20becomes%20a%20relative%20url"));
  });

  it("registers a context provider that is consumable", async () => {
    weavy = new Weavy();

    const ContextConsumerCE = class extends LitElement {
      weavy = new ContextConsumer(this, { context: WeavyContext });
    };

    const tag = defineCE(ContextConsumerCE);
    const contextConsumer = await fixture<typeof ContextConsumerCE & LitElement>(`<${tag}></${tag}>`);
    await contextConsumer.updateComplete;

    expect(contextConsumer).to.have.property("weavy").with.property("value").that.equals(weavy);
  });

  it("is destructible", async () => {
    weavy = new Weavy();
    expect(weavy).to.respondTo("destroy");
    expect(weavy).to.have.property("isDestroyed", false);
    expect(testReadOnly(weavy, "isDestroyed")).to.throw(TypeError);
    weavy.destroy();
    expect(weavy).to.have.property("isDestroyed", true);
    expect(() => (weavy.url = "destruct-test")).to.throw(DestroyError);
  });
});
