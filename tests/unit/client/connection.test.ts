import { expect } from "@open-wc/testing";

import "../../utils/version";
import { Weavy, type WeavyType } from "../../../lib";
import { HubConnection } from "@microsoft/signalr";

describe("WeavyConnectionMixin", () => {
  let weavy: WeavyType;

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

    // Wait for other async functions to finish
    await weavy.whenConnectionCreated()
    expect(weavy).to.have.property("rtmConnection").that.is.instanceOf(HubConnection);
  });

  //it('has a promise "whenConnectionStarted" that resolves')

});