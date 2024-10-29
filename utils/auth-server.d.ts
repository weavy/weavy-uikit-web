import { Express } from "express";
import http from "node:http";
import { Agent } from "node:https";

export type ServerConfig = {
  agent: Agent;
  weavyUrl: URL;
  apiKey: string;
};

export type WeavyUser = { name: string; username: string; email: string; picture: string };
export type WeavyBot = {
  name: string;
  username: string;
  metadata: { family: string; model?: string; api_key: string };
  is_bot: true;
};

export type UserList = Array<WeavyUser | WeavyBot>;

export function getServerConfig(): ServerConfig;
export function getUsers(): UserList;

export function getAuthServer(serverConfig: ServerConfig, users: UserList): Express
export function syncUsers(serverConfig: ServerConfig, users: UserList): Promise<void>;

export function start(): http.Server;
