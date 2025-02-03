import { TemplateResult, html, nothing } from "lit";
import {
  AppWithSourceMetadataType,
  ComponentType,
  EntityType,
  EntityTypeString,
  MetadataSourceType,
} from "../types/app.types";
import { WyLinkEventType, NotificationType } from "../types/notifications.types";
import { msg, str } from "@lit/localize";
import { type WeavyType } from "../client/weavy";
import { AppTypeGuids, BotAppTypeGuids } from "../classes/weavy-component";
import { NamedEvent } from "../types/generic.types";

export function getEntityChain(entity?: EntityType) {
  const chain = [entity];
  while (entity) {
    if (entity.parent) {
      entity = entity.parent;
      chain.push(entity);
    } else {
      break;
    }
  }
  return chain;
}

export function isEntityMatch(entity: EntityType, type: EntityTypeString, item?: { id: number }) {
  return entity.type === type && (!item || entity.id === item.id);
}

export function isEntityChainMatch(entity: EntityType, type: EntityTypeString, item?: { id: number }) {
  const chain = getEntityChain(entity);
  return chain.some((chainEntity) => chainEntity && isEntityMatch(chainEntity, type, item));
}

export function getEntityChainMatch(entity: EntityType, type: EntityTypeString, item?: { id: number }) {
  const chain = getEntityChain(entity);
  return chain.find((chainEntity) => chainEntity && isEntityMatch(chainEntity, type, item));
}

export function hasEntityChildType(
  entity: EntityType,
  type: EntityTypeString,
  item: { id: number },
  childType: EntityTypeString
) {
  // Looking at child to be able to check parent
  const childMatch = getEntityChainMatch(entity, childType);

  if (childMatch && childMatch.parent) {
    return isEntityChainMatch(childMatch.parent, type, item);
  } else {
    return false;
  }
}

export async function dispatchLinkEvent(
  target: EventTarget,
  weavy: WeavyType | undefined,
  notification: NotificationType
) {
  let metadata: MetadataSourceType | undefined;

  if (weavy && notification.link.app?.id) {
    const response = await weavy.fetch(`/api/apps/${notification.link.app.id}`);
    if (response.ok) {
      metadata = ((await response.json()) as AppWithSourceMetadataType).metadata;
    }
  }

  const event: WyLinkEventType = new (CustomEvent as NamedEvent)("wy-link", {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: {
      link: {
        ...notification.link,
        bot: getBotName(notification),
      },
      app_type: (notification.link.app?.type && AppTypeGuids.get(notification.link.app?.type)) || ComponentType.Unknown,
      source_name: metadata?.source_name,
      source_url: metadata?.source_url,
      source_data: metadata?.source_data,
    },
  });

  return target.dispatchEvent(event);
}

export function getBotName(notification: NotificationType) {
  return notification.link.app?.type && BotAppTypeGuids.has(notification.link.app?.type) && notification.actor.is_bot
    ? notification.actor.uid
    : undefined;
}

export function getNotificationText(notification: NotificationType): {
  title: string;
  titleHtml: TemplateResult | typeof nothing;
  detail?: string;
} {
  const args = notification.args;

  switch (notification.template) {
    case "**{0}** added *{1}* to **{2}**": {
      const [name, fileName, appName] = args;
      return {
        title: msg(str`${name} added ${fileName} to ${appName}`),
        titleHtml: msg(html`<strong>${name}</strong> added <em>${fileName}</em> to <strong>${appName}</strong>`),
      };
    }
    case "**{0}** edited *{1}*": {
      const [name, fileName] = args;
      return {
        title: msg(str`${name} edited ${fileName}`),
        titleHtml: msg(html`<strong>${name}</strong> edited <em>${fileName}</em>`),
      };
    }
    case '**{0}** commented on *{1}*: "{2}"': {
      const [name, fileName, comment] = args;
      return {
        title: msg(str`${name} commented on ${fileName}`),
        titleHtml: msg(html`<strong>${name}</strong> commented on <em>${fileName}</em>`),
        detail: comment,
      };
    }
    case '**{0}** commented on **{1}**: "{2}"': {
      const [name, appName, comment] = args;
      return {
        title: msg(str`${name} commented on ${appName}`),
        titleHtml: msg(html`<strong>${name}</strong> commented on <strong>${appName}</strong>`),
        detail: comment,
      };
    }
    case '**{0}** replied to your post: "{1}"': {
      const [name, comment] = args;
      return {
        title: msg(str`${name} replied to your post`),
        titleHtml: msg(html`<strong>${name}</strong> replied to your post`),
        detail: comment,
      };
    }
    case '**{0}** replied to a post: "{1}"': {
      const [name, comment] = args;
      return {
        title: msg(str`${name} replied to a post`),
        titleHtml: msg(html`<strong>${name}</strong> replied to a post`),
        detail: comment,
      };
    }
    case '**{0}** mentioned you in a comment: "{1}"': {
      const [name, comment] = args;
      return {
        title: msg(str`${name} mentioned you in a comment`),
        titleHtml: msg(html`<strong>${name}</strong> mentioned you in a comment`),
        detail: comment,
      };
    }
    case '**{0}** posted in **{1}**: "{2}"': {
      const [name, appName, post] = args;
      return {
        title: msg(str`${name} posted in ${appName}`),
        titleHtml: msg(html`<strong>${name}</strong> posted in <strong>${appName}</strong>`),
        detail: post,
      };
    }
    case '**{0}** mentioned you in a post: "{1}"': {
      const [name, post] = args;
      return {
        title: msg(str`${name} mentioned you in a post`),
        titleHtml: msg(html`<strong>${name}</strong> mentioned you in a post`),
        detail: post,
      };
    }
    case 'New message from **{0}**: "{1}"': {
      const [name, message] = args;
      return {
        title: msg(str`New message from ${name}`),
        titleHtml: msg(html`New message from <strong>${name}</strong>`),
        detail: message,
      };
    }
    case '**{0}** sent a message in **{1}**: "{2}"': {
      const [name, appName, message] = args;
      return {
        title: msg(str`${name} sent a message in ${appName}`),
        titleHtml: msg(html`<strong>${name}</strong> sent a message in <strong>${appName}</strong>`),
        detail: message,
      };
    }
    case '**{0}** mentioned you in a message: "{1}"': {
      const [name, message] = args;
      return {
        title: msg(str`${name} mentioned you in a message`),
        titleHtml: msg(html`<strong>${name}</strong> mentioned you in a message`),
        detail: message,
      };
    }
    case '**{0}** edited a post: "{1}"': {
      const [name, post] = args;
      return {
        title: msg(str`${name} edited a post`),
        titleHtml: msg(html`<strong>${name}</strong> edited a post`),
        detail: post,
      };
    }
    case "**{0}** liked *{1}*": {
      const [name, fileName] = args;
      return {
        title: msg(str`${name} liked ${fileName}`),
        titleHtml: msg(html`<strong>${name}</strong> liked <em>${fileName}</em>`),
      };
    }
    case "**{0}** reacted {2} to *{1}*": {
      const [name, reaction, fileName] = args;
      return {
        title: msg(str`${name} reacted ${reaction} to ${fileName}`),
        titleHtml: msg(html`<strong>${name}</strong> reacted ${reaction} to <em>${fileName}</em>`),
      };
    }
    case '**{0}** liked your comment: "{1}"': {
      const [name, comment] = args;
      return {
        title: msg(str`${name} liked your comment`),
        titleHtml: msg(html`<strong>${name}</strong> liked your comment`),
        detail: comment,
      };
    }
    case '**{0}** reacted {1} to your comment: "{2}"': {
      const [name, reaction, comment] = args;
      return {
        title: msg(str`${name} reacted ${reaction} to your comment`),
        titleHtml: msg(html`<strong>${name}</strong> reacted ${reaction} to your comment`),
        detail: comment,
      };
    }
    case '**{0}** liked your message: "{1}"': {
      const [name, message] = args;
      return {
        title: msg(str`${name} liked your message`),
        titleHtml: msg(html`<strong>${name}</strong> liked your message`),
        detail: message,
      };
    }
    case '**{0}** reacted {1} to your message: "{2}"': {
      const [name, reaction, message] = args;
      return {
        title: msg(str`${name} reacted ${reaction} to your message`),
        titleHtml: msg(html`<strong>${name}</strong> reacted ${reaction} to your message`),
        detail: message,
      };
    }
    case '**{0}** liked your post: "{1}"': {
      const [name, post] = args;
      return {
        title: msg(str`${name} liked your post`),
        titleHtml: msg(html`<strong>${name}</strong> liked your post`),
        detail: post,
      };
    }
    case '**{0}** reacted {1} to your post: "{2}"': {
      const [name, reaction, post] = args;
      return {
        title: msg(str`${name} reacted ${reaction} to your post`),
        titleHtml: msg(html`<strong>${name}</strong> reacted ${reaction} to your post`),
        detail: post,
      };
    }
    case "**{0}** voted on your poll": {
      const [name] = args;
      return {
        title: msg(str`${name} voted on your poll`),
        titleHtml: msg(html`<strong>${name}</strong> voted on your poll`),
      };
    }
    case "**{0}** and **{1}** voted on your poll": {
      const [name1, name2] = args;
      return {
        title: msg(str`${name1} and ${name2} voted on your poll`),
        titleHtml: msg(html`<strong>${name1}</strong> and <strong>${name2}</strong> voted on your poll`),
      };
    }
    case "**{0}**, **{1}** and **{2}** voted on your poll": {
      const [name1, name2, name3] = args;
      return {
        title: msg(str`${name1}, ${name2} and ${name3} voted on your poll`),
        titleHtml: msg(
          html`<strong>${name1}</strong>, <strong>${name2}</strong> and <strong>${name3}</strong> voted on your poll`
        ),
      };
    }
    case "**{0}** and {1} others voted on your poll": {
      const [name, count] = args;
      return {
        title: msg(str`${name} and ${count} others voted on your poll`),
        titleHtml: msg(html`<strong>${name}</strong> and ${count} others voted on your poll`),
      };
    }
    default: {
      console.error(`Notification template not found! '${notification.template}'`);
      return { title: "", titleHtml: nothing };
    }
  }
}
