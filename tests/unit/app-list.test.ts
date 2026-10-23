import { expect } from "@open-wc/testing";
import { InfiniteQueryObserver, QueryObserver } from "@tanstack/query-core";

import "../utils/version";
import { Weavy } from "../../lib/client/weavy";
import { getAppListOptions, getAppsUnreadOptions } from "../../lib/data/app";
import { AppTypeGuid } from "../../lib/types/app.types";

describe("app list uid filtering", () => {
  let weavy: Weavy;
  let requests: URL[];

  beforeEach(() => {
    weavy = new Weavy();
    requests = [];
    weavy.fetch = (input) => {
      requests.push(new URL(input, "https://weavy.test"));
      return Promise.resolve(Response.json({ data: [], count: 0 }));
    };
  });

  afterEach(() => {
    weavy.destroy();
  });

  for (const types of [
    ...Object.values(AppTypeGuid).filter((type) => type !== AppTypeGuid.AgentChat).map((type) => [type]),
    [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat],
    [AppTypeGuid.AgentChat, AppTypeGuid.Chat],
    [],
    null,
    undefined,
  ]) {
    it(`omits uid for list and unread queries with types ${JSON.stringify(types)}`, async () => {
      const list = new InfiniteQueryObserver(weavy.queryClient, getAppListOptions(weavy, types, "assistant"));
      const unread = new QueryObserver(weavy.queryClient, getAppsUnreadOptions(weavy, types, "assistant"));

      await list.refetch({ throwOnError: true });
      await unread.refetch({ throwOnError: true });

      expect(requests).to.have.lengthOf(2);
      for (const request of requests) {
        expect(request.searchParams.has("uid")).to.equal(false);
        expect(request.searchParams.get("member")).to.equal("assistant");
      }
      expect(requests[1].searchParams.get("count_only")).to.equal("true");
      expect(requests[1].searchParams.get("unread")).to.equal("true");
      list.destroy();
      unread.destroy();
    });
  }

  for (const member of ["assistant", undefined]) {
    it(`sends uid=false for agent-chat-only list and unread queries with member ${member}`, async () => {
      const list = new InfiniteQueryObserver(
        weavy.queryClient,
        getAppListOptions(weavy, [AppTypeGuid.AgentChat], member),
      );
      const unread = new QueryObserver(
        weavy.queryClient,
        getAppsUnreadOptions(weavy, [AppTypeGuid.AgentChat], member),
      );

      await list.refetch({ throwOnError: true });
      await unread.refetch({ throwOnError: true });

      expect(requests).to.have.lengthOf(2);
      for (const request of requests) {
        expect(request.searchParams.get("uid")).to.equal("false");
        expect(request.searchParams.get("member")).to.equal(member ?? null);
        expect(request.searchParams.getAll("type")).to.deep.equal([AppTypeGuid.AgentChat]);
      }
      list.destroy();
      unread.destroy();
    });
  }

  it("keeps filtered and unfiltered unread counts in separate cache entries", async () => {
    const sharedOptions = getAppsUnreadOptions(weavy, [AppTypeGuid.AgentChat, AppTypeGuid.Chat], "assistant");
    const messengerOptions = getAppsUnreadOptions(weavy, [AppTypeGuid.AgentChat], "assistant");

    weavy.queryClient.setQueryData(sharedOptions.queryKey!, { count: 5 });
    weavy.queryClient.setQueryData(messengerOptions.queryKey!, { count: 2 });

    expect(weavy.queryClient.getQueryData(sharedOptions.queryKey!)).to.deep.equal({ count: 5 });
    expect(weavy.queryClient.getQueryData(messengerOptions.queryKey!)).to.deep.equal({ count: 2 });
  });
});
