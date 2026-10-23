import { aTimeout, expect, fixture, html, waitUntil } from "@open-wc/testing";

import "../utils/version";
import { Weavy } from "../../lib/client/weavy";
import { WyNotificationToasts } from "../../lib/wy-notification-toasts";
import {
  getLastNotification,
  getMarkNotificationsMutationOptions,
  getNotificationsOptions,
  getUnreadOptions,
  notificationMatchesDirectory,
} from "../../lib/data/notifications";
import { getDirectoryOptions } from "../../lib/data/directories";
import type { WyNotifications } from "../../lib/wy-notifications";
import "../../lib/wy-notifications";
import { EntityTypeString } from "../../lib/types/app.types";
import { NotificationTypes, type NotificationType } from "../../lib/types/notifications.types";
import type { RealtimeNotificationEventType } from "../../lib/types/realtime.types";

/** Exposes realtime delivery and queued notifications without rendering unrelated child components. */
class TestNotificationToasts extends WyNotificationToasts {
  permissionChecks = 0;
  permission: () => Promise<boolean> = async () => true;
  renderToasts = false;

  /** Delivers an event through the production realtime handler. */
  send(event: RealtimeNotificationEventType) {
    return this.handleEvent(event);
  }

  /** Current internal notifications. */
  get notifications() {
    return this._notifications;
  }

  /** Current native notifications. */
  get nativeNotifications() {
    return this._nativeNotifications;
  }

  /** Supplies deterministic browser consent. */
  override async hasUserPermission() {
    this.permissionChecks++;
    return this.permission();
  }

  override render() {
    return this.renderToasts ? super.render() : html``;
  }
}
customElements.define("test-notification-toasts", TestNotificationToasts);

/** Browser notification stand-in that records display and closing without OS permissions. */
class TestNativeNotification {
  static displayed: TestNativeNotification[] = [];
  tag: string;
  closed = false;
  onclick?: () => void;
  onclose?: () => void;

  constructor(_title: string, options: NotificationOptions) {
    this.tag = options.tag ?? "";
    TestNativeNotification.displayed.push(this);
  }

  /** Closes the notification and exercises the component's close handler. */
  close() {
    this.closed = true;
    this.onclose?.();
  }
}

/** Creates a controllable asynchronous result for membership/permission race tests. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("wy-notification-toasts directory filtering", () => {
  let weavy: Weavy;
  let el: TestNotificationToasts;
  let requests: string[];
  let events: NotificationType[];
  let fetchMembership: (url: string) => Promise<Response>;
  let appDirectory: number | null;
  let originalNotification: PropertyDescriptor | undefined;
  let eventListeners: AbortController;
  const user = { id: 1, name: "Recipient" };
  const notification: NotificationType = {
    id: 100,
    type: NotificationTypes.Mention,
    action: "message_created",
    actor: { id: 2, name: "Sender" },
    template: 'New message from **{0}**: "{1}"',
    args: ["Sender", "Hello"],
    text: "Hello",
    html: "Hello",
    plain: "Hello",
    link: { id: 50, type: EntityTypeString.Message, app: { id: 42 } },
    user,
    metadata: {},
    created_at: "2026-10-19T10:00:00Z",
    is_unread: true,
  };

  /** Builds realtime creation/update/deletion payloads. */
  function event(
    action: RealtimeNotificationEventType["action"] = "notification_created",
    changes: Partial<NotificationType> = {},
  ): RealtimeNotificationEventType {
    return { id: 200, action, actor: notification.actor, notification: { ...notification, ...changes } };
  }

  beforeEach(async () => {
    requests = [];
    events = [];
    eventListeners = new AbortController();
    appDirectory = 7;
    TestNativeNotification.displayed = [];
    originalNotification = Object.getOwnPropertyDescriptor(window, "Notification");
    Object.defineProperty(window, "Notification", { configurable: true, value: TestNativeNotification });
    weavy = new Weavy();
    weavy.queryClient.setDefaultOptions({ queries: { staleTime: 60_000, retry: false } });
    weavy.queryClient.setQueryData(["user"], user);
    weavy.subscribe = async () => undefined;
    weavy.unsubscribe = async () => true;
    fetchMembership = async (url) =>
      Response.json(url.startsWith("/api/directories/")
        ? { id: 7, name: "acme" }
        : { id: 42, directory_id: appDirectory });
    weavy.fetch = async (url) => {
      if (String(url) === "/api/user") {
        return Response.json(user);
      }
      requests.push(String(url));
      return fetchMembership(String(url));
    };
    el = await fixture<TestNotificationToasts>(html`
      <test-notification-toasts .weavy=${weavy} directory="acme"></test-notification-toasts>
    `);
    await waitUntil(() => el.user?.id === 1);
    await aTimeout(0);
    // The base component consumes propagation at the client host in the capture phase.
    weavy.host.addEventListener("wy-notification", (e) => events.push((e as CustomEvent<NotificationType>).detail),
      { capture: true, signal: eventListeners.signal });
  });

  afterEach(() => {
    el.remove();
    eventListeners.abort();
    weavy.destroy();
    if (originalNotification) {
      Object.defineProperty(window, "Notification", originalNotification);
    } else {
      Reflect.deleteProperty(window, "Notification");
    }
  });

  for (const appearance of ["internal", "native", "none"] as const) {
    it(`filters creations and updates before ${appearance} delivery or consent`, async () => {
      el.appearance = appearance;
      await el.updateComplete;
      await aTimeout(0);
      el.permissionChecks = 0;
      appDirectory = 8;
      await el.send(event());
      await el.send(event("notification_updated"));
      expect(events).to.have.length(0);
      expect(el.notifications).to.have.length(0);
      expect(TestNativeNotification.displayed).to.have.length(0);
      expect(el.permissionChecks).to.equal(0);

      weavy.queryClient.removeQueries({ queryKey: ["apps", 42] });
      appDirectory = 7;
      await el.send(event());
      await el.send(event("notification_updated", { text: "Updated" }));
      expect(events).to.have.length(2);
      expect(events[1].text).to.equal("Updated");
      expect(el.notifications).to.have.length(appearance === "none" ? 0 : 1);
      expect(TestNativeNotification.displayed).to.have.length(appearance === "native" ? 2 : 0);
    });
  }

  it("renders only matching internal toasts", async () => {
    el.renderToasts = true;
    await el.send(event());
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("wy-toast")).to.have.length(1);
    weavy.queryClient.removeQueries({ queryKey: ["apps", 42] });
    appDirectory = 8;
    await el.send(event("notification_updated"));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("wy-toast")).to.have.length(0);
  });

  it("preserves event cancellation", async () => {
    weavy.host.addEventListener("wy-notification", (e) => e.preventDefault(),
      { capture: true, signal: eventListeners.signal });
    await el.send(event());
    expect(events).to.have.length(1);
    expect(el.notifications).to.have.length(0);
    expect(TestNativeNotification.displayed).to.have.length(0);
  });

  it("does not look up rejected types or unfiltered notifications", async () => {
    el.typeFilter = NotificationTypes.Reaction;
    await el.send(event());
    expect(requests).to.have.length(0);
    expect(events).to.have.length(0);
    el.typeFilter = NotificationTypes.All;
    el.directory = undefined;
    await el.updateComplete;
    await aTimeout(0);
    await el.send(event());
    expect(events).to.have.length(1);
    expect(requests).to.have.length(0);
  });

  it("resolves numeric and encoded directory identifiers", async () => {
    for (const directory of [7, "7", "ACME & partners"]) {
      expect(await notificationMatchesDirectory(weavy, notification, directory)).to.equal(true);
      expect(requests).to.include(`/api/directories/${encodeURIComponent(directory)}`);
    }
  });

  for (const directory of [7, 0]) {
    it(`delivers toasts configured with numeric directory ${directory}`, async () => {
      el.directory = directory;
      appDirectory = directory;
      fetchMembership = async (url) => Response.json(url.startsWith("/api/directories/")
        ? { id: directory, name: "acme" }
        : { id: 42, directory_id: directory });
      await el.updateComplete;
      await aTimeout(0);
      await el.send(event());
      expect(el.directory).to.equal(directory);
      expect(events).to.have.length(1);
      expect(requests).to.include(`/api/directories/${directory}`);
    });
  }

  it("passes numeric directory properties through the notification list and unread controller", async () => {
    fetchMembership = async () => Response.json({ data: [], count: 2 });
    const list = await fixture<WyNotifications>(html`
      <wy-notifications .weavy=${weavy} .directory=${7}></wy-notifications>
    `);
    try {
      await waitUntil(() => requests.some((url) => url.includes("count_only=true")) && list.unread === 2);
      expect(list.directory).to.equal(7);
      expect(requests.filter((url) => url.startsWith("/api/notifications?"))
        .every((url) => new URL(url, location.href).searchParams.get("directory") === "7")).to.equal(true);
      await waitUntil(() => requests.some((url) => url.startsWith("/api/notifications?") &&
        !url.includes("count_only=true")));
    } finally {
      list.remove();
    }
  });

  it("shares query keys and mark-as-read state for string and numeric directory IDs", async () => {
    weavy.url = location.origin;
    for (const directory of [7, 0]) {
      const stringDirectory = directory.toString();
      const listOptions = getNotificationsOptions(weavy, NotificationTypes.All, undefined, directory);
      expect(listOptions.queryKey).to.deep.equal(
        getNotificationsOptions(weavy, NotificationTypes.All, undefined, stringDirectory).queryKey,
      );
      expect(getUnreadOptions(weavy, NotificationTypes.All, undefined, directory).queryKey).to.deep.equal(
        getUnreadOptions(weavy, NotificationTypes.All, undefined, stringDirectory).queryKey,
      );
      expect(getDirectoryOptions(weavy, directory).queryKey).to.deep.equal(
        getDirectoryOptions(weavy, stringDirectory).queryKey,
      );
      weavy.queryClient.setQueryData(listOptions.queryKey, {
        pages: [{ data: [notification], count: 1 }], pageParams: [0],
      });
      expect(getLastNotification(weavy, NotificationTypes.All, undefined, directory)?.id).to.equal(notification.id);
      const mutation = getMarkNotificationsMutationOptions(weavy, undefined, directory);
      mutation.onMutate({ notificationId: notification.id });
      expect(getLastNotification(weavy, NotificationTypes.All, undefined, stringDirectory)?.is_unread).to.equal(false);
      await mutation.mutationFn({ notificationId: notification.id });
      const url = new URL(requests.at(-1)!, location.href);
      expect(url.pathname).to.equal(`/api/directories/${directory}/notifications/mark`);
    }
  });

  it("resolves direct app and nested entity links", async () => {
    for (const link of [
      { id: 42, type: EntityTypeString.App },
      { id: 51, type: EntityTypeString.Comment, parent: notification.link },
    ]) {
      expect(await notificationMatchesDirectory(weavy, { ...notification, link }, "acme")).to.equal(true);
    }
    expect(requests.filter((url) => url === "/api/apps/42")).to.have.length(1);
  });

  it("excludes notifications without an app or an app directory", async () => {
    for (const link of [undefined, { id: 51, type: EntityTypeString.Comment }]) {
      await el.send(event("notification_created", { link }));
    }
    expect(requests).to.have.length(0);
    appDirectory = null;
    await el.send(event());
    expect(events).to.have.length(0);
  });

  it("shares fresh lookups and deduplicates concurrent requests across notifications", async () => {
    const response = deferred<Response>();
    fetchMembership = async (url) => {
      return String(url).startsWith("/api/apps/") ? response.promise : Response.json({ id: 7 });
    };
    const first = el.send(event());
    const second = el.send(event("notification_created", { id: 101 }));
    await waitUntil(() => requests.length === 2);
    response.resolve(Response.json({ id: 42, directory_id: 7 }));
    await Promise.all([first, second]);
    await el.send(event("notification_updated"));
    expect(events).to.have.length(3);
    expect(requests).to.have.length(2);
  });

  it("refreshes expired membership after an app moves directories", async () => {
    await el.send(event());
    appDirectory = 8;
    // Expire the cache deterministically rather than depending on a wall-clock delay.
    weavy.queryClient.setQueryData(["apps", 42], { id: 42, directory_id: 7 }, { updatedAt: 1 });
    await el.send(event("notification_updated"));
    expect(events).to.have.length(1);
    expect(el.notifications).to.have.length(0);
    expect(requests.filter((url) => url === "/api/apps/42")).to.have.length(2);
  });

  for (const change of ["directory", "client", "user", "disconnect"] as const) {
    it(`discards pending membership results after a ${change} change`, async () => {
      const response = deferred<Response>();
      const started = deferred<void>();
      fetchMembership = async (url) => {
        if (String(url).startsWith("/api/apps/")) {
          started.resolve();
          return response.promise;
        }
        return Response.json({ id: 7 });
      };
      const pending = el.send(event());
      await started.promise;
      if (change === "directory") el.directory = "other";
      if (change === "client") el.weavy = undefined;
      if (change === "user") {
        const nextUser = { id: 3, name: "Another recipient" };
        weavy.queryClient.setQueryData(["user"], nextUser);
        el.user = nextUser;
      }
      if (change === "disconnect") el.remove();
      await el.updateComplete;
      response.resolve(Response.json({ id: 42, directory_id: 7 }));
      await pending;
      expect(events).to.have.length(0);
      expect(el.notifications).to.have.length(0);
    });
  }

  it("discards delivery after the directory changes during a consent prompt", async () => {
    el.requestUserPermission = true;
    await el.updateComplete;
    await aTimeout(0);
    const permission = deferred<boolean>();
    const started = deferred<void>();
    el.permission = () => { started.resolve(); return permission.promise; };
    const pending = el.send(event());
    await started.promise;
    el.directory = "other";
    await el.updateComplete;
    permission.resolve(true);
    await pending;
    expect(events).to.have.length(0);
    expect(el.notifications).to.have.length(0);
  });

  it("keeps pending delivery when the same user's profile is refreshed", async () => {
    const response = deferred<Response>();
    const started = deferred<void>();
    fetchMembership = async (url) => {
      if (url.startsWith("/api/apps/")) {
        started.resolve();
        return response.promise;
      }
      return Response.json({ id: 7 });
    };
    const pending = el.send(event());
    await started.promise;
    const updatedUser = { ...user, name: "Updated name" };
    weavy.queryClient.setQueryData(["user"], updatedUser);
    el.user = updatedUser;
    await el.updateComplete;
    response.resolve(Response.json({ id: 42, directory_id: 7 }));
    await pending;
    expect(events).to.have.length(1);
    expect(el.notifications).to.have.length(1);
  });

  it("resubscribes on reconnect without accepting pending pre-disconnect deliveries", async () => {
    const subscribed: string[] = [];
    weavy.subscribe = async (_group, name) => { subscribed.push(name); };
    const response = deferred<Response>();
    const started = deferred<void>();
    fetchMembership = async (url) => {
      if (url.startsWith("/api/apps/")) {
        started.resolve();
        return response.promise;
      }
      return Response.json({ id: 7 });
    };
    const pending = el.send(event());
    await started.promise;
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    await waitUntil(() => subscribed.length === 2);
    response.resolve(Response.json({ id: 42, directory_id: 7 }));
    await pending;
    expect(events).to.have.length(0);
    expect(subscribed).to.deep.equal(["notification_created", "notification_updated"]);
    await el.send(event());
    expect(events).to.have.length(1);
  });

  it("guards later permission waits after the event has been dispatched", async () => {
    el.requestUserPermission = true;
    await el.updateComplete;
    await aTimeout(0);
    const permission = deferred<boolean>();
    const started = deferred<void>();
    weavy.host.addEventListener("wy-notification", () => {
      el.permission = () => { started.resolve(); return permission.promise; };
    }, { capture: true, signal: eventListeners.signal });
    const pending = el.send(event());
    await started.promise;
    el.directory = "other";
    await el.updateComplete;
    permission.resolve(true);
    await pending;
    expect(events).to.have.length(1);
    expect(el.notifications).to.have.length(0);
  });

  it("preserves creation/update/deletion order while membership is pending", async () => {
    const response = deferred<Response>();
    const started = deferred<void>();
    fetchMembership = async (url) => {
      if (String(url).startsWith("/api/apps/")) {
        started.resolve();
        return response.promise;
      }
      return Response.json({ id: 7 });
    };
    const created = el.send(event());
    await started.promise;
    const updated = el.send(event("notification_updated", { text: "Updated" }));
    const deleted = el.send(event("notification_deleted"));
    response.resolve(Response.json({ id: 42, directory_id: 7 }));
    await Promise.all([created, updated, deleted]);
    expect(events.map((n) => n.text)).to.deep.equal(["Hello", "Updated"]);
    expect(el.notifications).to.have.length(0);
  });

  it("removes notifications without membership lookups and handles native index zero", async () => {
    el.appearance = "native";
    await el.updateComplete;
    await aTimeout(0);
    await el.send(event());
    expect(el.nativeNotifications).to.have.length(1);
    expect(el.closeNativeNotification(999)).to.equal(false);
    expect(el.removeNativeNotification(999)).to.equal(false);
    requests.length = 0;
    await el.send(event("notification_deleted"));
    expect(requests).to.have.length(0);
    expect(el.nativeNotifications).to.have.length(0);
    expect(TestNativeNotification.displayed[0].closed).to.equal(true);
  });

  it("clears both tracked notification collections when the directory changes", async () => {
    el.appearance = "native";
    await el.updateComplete;
    await aTimeout(0);
    await el.send(event());
    await el.send(event("notification_created", { id: 101 }));
    el.directory = "other";
    await el.updateComplete;
    expect(el.notifications).to.have.length(0);
    expect(el.nativeNotifications).to.have.length(0);
    expect(TestNativeNotification.displayed.every((n) => n.closed)).to.equal(true);
  });

  it("suppresses missing directories and apps", async () => {
    for (const missing of ["directory", "app"]) {
      weavy.queryClient.removeQueries({ queryKey: ["apps"] });
      weavy.queryClient.removeQueries({ queryKey: ["directories"] });
      fetchMembership = async (url) => {
        if (String(url).startsWith("/api/directories/")) {
          return Response.json(missing === "directory" ? null : { id: 7 });
        }
        return new Response(null, { status: 404 });
      };
      await el.send(event());
    }
    expect(events).to.have.length(0);
  });

  it("reports failed or malformed lookups without displaying notifications", async () => {
    const originalError = console.error;
    const errors: unknown[][] = [];
    console.error = (...args: unknown[]) => { errors.push(args); };
    try {
      for (const failure of ["http", "transport", "malformed"] as const) {
        weavy.queryClient.removeQueries({ queryKey: ["apps"] });
        weavy.queryClient.removeQueries({ queryKey: ["directories"] });
        fetchMembership = async () => {
          if (failure === "transport") throw new Error("Offline");
          return failure === "http" ? new Response(null, { status: 500 }) : Response.json({ id: "invalid" });
        };
        await el.send(event());
      }
      expect(errors).to.have.length(3);
      expect(events).to.have.length(0);
      expect(el.notifications).to.have.length(0);
    } finally {
      console.error = originalError;
    }
  });
});
