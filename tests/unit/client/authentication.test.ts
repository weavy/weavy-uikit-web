import { expect } from "@open-wc/testing";

import "../../utils/version";
import { Weavy, type WeavyType } from "../../../lib";

describe("WeavyAuthenticationMixin", () => {
  let weavy: WeavyType;

  afterEach(() => {
    weavy?.destroy();
  });

  it('has an async "tokenFactory" property that can be invoked', async () => {
    weavy = new Weavy({ tokenFactory: async () => "token-factory-result" });

    expect(weavy).to.respondTo("tokenFactory");
    expect(await weavy.tokenFactory?.(false)).to.equal("token-factory-result");

    expect(() => (weavy.tokenFactory = async () => "next-token-factory-result")).to.change(weavy, "tokenFactory");
    expect(await weavy.tokenFactory?.(false)).to.equal("next-token-factory-result");
  });

  it('has a "tokenFactoryUrl" property that returns an URL that sets a tokenFactory', async () => {
    weavy = new Weavy({ tokenUrl: "https://weavy.test/" });
    expect(weavy)
      .to.have.a.property("tokenUrl")
      .that.is.instanceOf(URL)
      .with.property("href")
      .that.equals("https://weavy.test/");
    expect(weavy).to.respondTo("tokenFactory");
  });

  it('has a "whenUrlAndTokenFactory" promise that resolves', async () => {
    weavy = new Weavy();

    expect(weavy).to.respondTo("whenUrlAndTokenFactory");

    queueMicrotask(() => {
      weavy.url = "https://weavy.test/";
      weavy.tokenFactory = async () => "token-factory-result";
    });

    await weavy.whenUrlAndTokenFactory();
    expect(weavy.url?.toString()).to.equal("https://weavy.test/");
    expect(await weavy.tokenFactory?.(false)).to.equal("token-factory-result");
  });

  it('has a "whenTokenIsValid" promise that resolves', async () => {
    weavy = new Weavy();

    expect(weavy).to.respondTo("whenTokenIsValid");

    weavy.url = "https://weavy.test/";
    weavy.tokenFactory = async () => "";

    queueMicrotask(() => {
      weavy.tokenFactory = async () => "wyu_valid-token";
      weavy.getToken(true);
    });

    await weavy.whenTokenIsValid();
    expect(await weavy.getToken(true)).to.equal("wyu_valid-token");
  });

  it('has an async "getToken" method that returns a token', async () => {
    weavy = new Weavy({
      url: "https://weavy.test",
      tokenFactory: async (refresh) => {
        if (refresh) {
          return "wyu_refresh-token";
        } else {
          return "wyu_normal-token";
        }
      },
    });

    expect(await weavy.getToken()).to.equal("wyu_normal-token");
    expect(await weavy.getToken(true)).to.equal("wyu_refresh-token");

    try {
      weavy.tokenFactory = async () => "wys_invalid_system_token";
      await weavy.getToken(true);
    } catch (e) {
      expect(e).to.be.instanceOf(TypeError).that.has.a.property("message").that.contains("API key");
    }

    try {
      weavy.tokenFactory = async () => "invalid_token";
      await weavy.getToken(true);
    } catch (e) {
      expect(e).to.be.instanceOf(TypeError).that.has.a.property("message").that.contains("invalid string");
    }

    try {
      // @ts-expect-error TypeError
      weavy.tokenFactory = async () => null;
      await weavy.getToken(true);
    } catch (e) {
      expect(e).to.be.instanceOf(TypeError);
    }
  });

});
