import { expect } from "@open-wc/testing";

import "../utils/version";
import { Weavy } from "../../lib/client/weavy";
import { getAppsUnreadOptions } from "../../lib/data/app";
import { getLeaveConversationMutation, getMarkConversationMutation } from "../../lib/data/conversation";
import { AppTypeGuid, type AppType } from "../../lib/types/app.types";

describe("conversation marking", () => {
  let weavy: Weavy;

  beforeEach(() => {
    weavy = new Weavy();
  });

  afterEach(() => {
    weavy.destroy();
  });

  it("marks a contextual chat without members and updates unscoped unread counts", async () => {
    const app = {
      id: 1350,
      type: AppTypeGuid.Chat,
      is_unread: true,
      last_message: { id: 3175 },
    } as AppType;
    const unreadKey = getAppsUnreadOptions(weavy, [AppTypeGuid.Chat]).queryKey!;
    const scopedUnreadKey = getAppsUnreadOptions(weavy, [AppTypeGuid.Chat], "assistant").queryKey!;
    const allUnreadKey = getAppsUnreadOptions(weavy, null).queryKey!;
    weavy.queryClient.setQueryData(unreadKey, { count: 4 });
    weavy.queryClient.setQueryData(scopedUnreadKey, { count: 2 });
    weavy.queryClient.setQueryData(allUnreadKey, { count: 6 });
    weavy.queryClient.setQueryData(["apps", "list"], { pages: [{ data: [app], count: 1 }], pageParams: [{}] });

    const requests: { url: string; method?: string }[] = [];
    weavy.fetch = (url, options) => {
      requests.push({ url: url.toString(), method: options?.method });
      return Promise.resolve(new Response(null, { status: 204 }));
    };

    const mutation = getMarkConversationMutation(weavy);
    await mutation.mutate({ app, messageId: 3175, userId: 1 });

    expect(requests).to.deep.equal([{ url: "/api/apps/1350/mark?messageId=3175", method: "PUT" }]);
    expect(weavy.queryClient.getQueryData(unreadKey)).to.deep.equal({ count: 3 });
    expect(weavy.queryClient.getQueryData(scopedUnreadKey)).to.deep.equal({ count: 2 });
    expect(weavy.queryClient.getQueryData(allUnreadKey)).to.deep.equal({ count: 5 });

    await mutation.mutate({ app, messageId: null, userId: 1 });
    expect(requests[1]).to.deep.equal({ url: "/api/apps/1350/mark", method: "DELETE" });
    expect(weavy.queryClient.getQueryData(unreadKey)).to.deep.equal({ count: 4 });
  });

  it("keeps the conversation cached when removing another member but drops it when leaving", async () => {
    const app = { id: 58, type: AppTypeGuid.ChatRoom, name: "Room" } as AppType;
    weavy.queryClient.setQueryData(["apps", "list"], { pages: [{ data: [app], count: 1 }], pageParams: [{}] });
    weavy.queryClient.setQueryData(["apps", 58], app);
    weavy.queryClient.setQueryData(["members", 58], { data: [{ id: 1 }, { id: 2 }], count: 2 });

    const requests: { url: string; method?: string }[] = [];
    weavy.fetch = (url, options) => {
      requests.push({ url: url.toString(), method: options?.method });
      return Promise.resolve(new Response(null, { status: 204 }));
    };

    const mutation = getLeaveConversationMutation(weavy);
    await mutation.mutate({ appId: 58, members: [2], userId: 1 });

    expect(requests).to.deep.equal([{ url: "/api/apps/58/members/2", method: "DELETE" }]);
    // Still cached, only invalidated, so hosts holding the conversation get the refreshed title.
    expect(weavy.queryClient.getQueryData(["apps", 58])).to.equal(app);
    expect(weavy.queryClient.getQueryState(["apps", 58])?.isInvalidated).to.equal(true);
    expect(weavy.queryClient.getQueryData<{ pages: { data: AppType[] }[] }>(["apps", "list"])?.pages[0].data).to.have.lengthOf(1);

    await mutation.mutate({ appId: 58, members: [1], userId: 1 });

    expect(requests[1]).to.deep.equal({ url: "/api/apps/58/members/1", method: "DELETE" });
    expect(weavy.queryClient.getQueryData(["apps", 58])).to.equal(undefined);
    expect(weavy.queryClient.getQueryData(["members", 58])).to.equal(undefined);
    expect(weavy.queryClient.getQueryData<{ pages: { data: AppType[] }[] }>(["apps", "list"])?.pages[0].data).to.have.lengthOf(0);
  });
});
