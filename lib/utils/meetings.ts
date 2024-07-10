import { msg } from "@lit/localize";
import { svgIconNamesType } from "./icons";
import { MeetingProviderType } from "../types/meetings.types";
import { TemplateResult } from "lit";

export function getMeetingIconName(provider: MeetingProviderType): svgIconNamesType {
  switch (provider) {
    case "zoom":
      return "zoom-meetings";
    case "microsoft":
      return "microsoft-teams";
    case "google":
      return "google-meet";
  }
}

export function getMeetingTitle(provider: MeetingProviderType): string | TemplateResult {
  switch (provider) {
    case "zoom":
      return msg("Zoom meeting");
    case "microsoft":
      return msg("Teams meeting");
    case "google":
      return msg("Google Meet");
  }
}