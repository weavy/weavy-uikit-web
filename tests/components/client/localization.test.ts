import { expect } from "@open-wc/testing";

import "../../utils/version";
import { Weavy, type WeavyContext } from "../../../lib";
import { LocaleModule } from "@lit/localize";
import { testReadOnly } from "../../utils/properties";

// Note: lit-localize can only be configured once  

describe("WeavyLocalesMixin", () => {
  let weavy: WeavyContext;

  before(() => {
    weavy = new Weavy();
  })

  after(() => {
    weavy?.destroy();
  });

  it('has a static readonly property "sourceLocale"', async () => {
    expect(Weavy).to.have.property("sourceLocale", "en");
    expect(testReadOnly(Weavy, "sourceLocale")).to.throw(TypeError);
  });

  it('has a "locales" property that sets locales', async () => {
    expect(weavy).to.have.property("locales").that.is.an.instanceOf(Array).with.lengthOf(1);
    expect(weavy.locales[0]).to.be.instanceOf(Array).with.lengthOf(2);
    expect(weavy.locales[0][0]).to.equal("sv-SE");

    const enPI: LocaleModule = { templates: {} };
    weavy.locales = [["en-PI", enPI]];
    expect(weavy).to.have.property("locales").that.is.an.instanceOf(Array).with.lengthOf(2);

    expect(() => { weavy.locales = [["en-PI", enPI]]; }).to.throw()
  });

  it('has a "locale" property that sets locale', async () => {
    expect(weavy).to.have.property("locale").that.equals("en");
    expect(() => (weavy.locale = "sv-SE")).to.change(weavy, "locale");
    expect(weavy.locale).to.equal("sv-SE");
    expect(() => (weavy.locale = "xx-pirate")).to.throw();
  });
});
