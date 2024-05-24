import { expect } from "@open-wc/testing";

import "../../utils/version";
import { Weavy, type WeavyContext } from "../../../lib";
import { HubConnection } from "@microsoft/signalr";

describe("WeavyConnectionMixin", () => {
  let weavy: WeavyContext;

  afterEach(() => {
    weavy?.destroy();
  });

  it('has a promise "whenConnectionRequested" that resolves', async () => {
    weavy = new Weavy({url: "https://weavy.test/", tokenFactory: async () => "wyu_test" });

    expect(weavy).to.respondTo("whenConnectionRequested");

    queueMicrotask(() => {
      weavy.subscribe(null, "", () => null);
    });

    await weavy.whenConnectionRequested()
    expect(weavy).to.have.property("rtmConnection").that.is.instanceOf(HubConnection);
  });

  it('has a promise "whenConnectionStarted" that resolves')

});