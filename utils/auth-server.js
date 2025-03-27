import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import session from "express-session";

import https from "node:https";

export function getServerConfig() {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  });

  if (!process.env.WEAVY_URL) {
    throw new Error("No WEAVY_URL defined in ENV.");
  }

  const weavyUrl = new URL(process.env.WEAVY_URL);

  if (!process.env.WEAVY_APIKEY) {
    throw new Error("No WEAVY_APIKEY defined in ENV.");
  }

  const apiKey = process.env.WEAVY_APIKEY;

  return { agent, weavyUrl, apiKey };
}

export function getUsers() {
  /// USERS AND BOTS
  const users = [
    {
      name: "Marvin Acme",
      username: "marvin",
      email: "marvin@acme.corp",
      picture: "https://i.pravatar.cc/150?u=marvin",
    },
    {
      name: "Road Runner",
      username: "meepmeep",
      email: "roadrunner@acme.corp",
      picture: "https://i.pravatar.cc/150?u=meepmeep",
    },
    { name: "Bugs Bunny", username: "bugs", email: "bugs@acme.corp", picture: "https://i.pravatar.cc/150?u=bugs" },
    { name: "Daffy Duck", username: "daffy", email: "daffy@acme.corp", picture: "https://i.pravatar.cc/150?u=daffy" },
    { name: "Porky Pig", username: "porky", email: "porky@acme.corp", picture: "https://i.pravatar.cc/150?u=porky" },
    {
      name: "Tweety Bird",
      username: "tweety",
      email: "tweety@acme.corp",
      picture: "https://i.pravatar.cc/150?u=tweety",
    },
    { name: "Wile E. Coyote", username: "wile", email: "wile@acme.corp", picture: "https://i.pravatar.cc/150?u=wile" },
    { name: "Claude", username: "claude", provider: "anthropic", model: "claude-3-5-haiku-latest" },
    { name: "Gemini", username: "gemini", provider: "gemini", model: "gemini-2.0-flash", picture: "https://i.pravatar.cc/150?u=gemini" },
    { name: "Kapa", username: "kapa", provider: "kapa", model: "0f28991b-6732-4a77-9f77-1104f2d06a45" },
    { name: "OpenAI", username: "openai", provider: "openai", model: "gpt-4o-mini" },
  ];

  return users;
}

export function getAuthServer(serverConfig, users) {
  function getUser(username) {
    // try to get user with specified name, otherwise return the first user
    if (username) {
      const user = users.find((user) => user.username.toUpperCase() === username.toUpperCase());
      if (user !== undefined && !user.provider) {
        return user;
      }
    }
    return users.find((u) => !u.provider);
  }

  /// SERVER
  const app = express();
  let _tokens = [];

  app.use(express.json());

  app.use(cors());

  // session middleware setup
  app.use(
    session({
      secret: "your_secret_here",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false },
    })
  );

  // list users
  app.get("/api/users", async (req, res) => {
    res.json(
      users
        .filter((user) => !user.provider)
        .map((user) => {
          if (user.username === req.session.user) {
            return { ...user, is_selected: true };
          } else {
            return { ...user, is_selected: false };
          }
        })
    );
  });

  // list bots
  app.get("/api/bots", async (req, res) => {
    res.json(
      users
        .filter((user) => user.provider)
        .map((bot) => {
          return { username: bot.username, name: bot.name, avatar: bot.picture };
        })
    );
  });

  // login user
  app.post("/api/user", express.urlencoded({ extended: false }), async (req, res, next) => {
    const username = req.body.username;

    if (username) {
      req.session.regenerate(function (err) {
        if (err) {
          next(err);
        }

        // save username in session
        req.session.user = username;

        req.session.save(function (err) {
          if (err) {
            return next(err);
          }
          res.redirect("/" + req.session.user);
        });
      });
    }
  });

  app.get("/api/token", async (req, res) => {
    let username = getUser(req.session.user).username; // get user from session or default (first) user

    if ((!req.query.refresh || req.query.refresh === "false") && _tokens.find((t) => t.username === username)) {
      res.json({ access_token: _tokens.find((t) => t.username === username).access_token });
    } else {
      try {
        let response = await fetch(new URL(`/api/users/${username}/tokens`, serverConfig.weavyUrl), {
          agent: serverConfig.agent,
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${serverConfig.apiKey}`,
          },
          body: JSON.stringify({ name: username, expires_in: 3600 }),
        });

        if (response.ok) {
          let data = await response.json();
          _tokens = [
            ..._tokens.filter((t) => t.username !== username),
            { username: username, access_token: data.access_token },
          ];
          res.json(data);
        } else {
          res.status(response.status).json({ access_token: "" });
        }
      } catch {
        res.status(400).json({ access_token: "" });
      }
    }
  });

  return app;
}

export async function whenServerOk(serverConfig) {
  try {
    const response = await fetch(new URL("/status", serverConfig.weavyUrl), {
      agent: serverConfig.agent,
    });

    if (!response.ok || (await response.text()) !== "Ok") {
      throw new Error();
    }
  } catch {
    await new Promise((r) =>
      setTimeout(() => {
        whenServerOk(serverConfig).then(r);
      }, 500)
    );
  }
}

export async function syncUsers(serverConfig, users) {
  await whenServerOk(serverConfig);

  // sync users
  const whenUsers = [];
  users.filter((user) => !user.provider).
    forEach((u) => {
    console.info("Upserting", u.username);
    whenUsers.push(
      fetch(new URL("/api/users/" + u.username, serverConfig.weavyUrl), {
        agent: serverConfig.agent,
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${serverConfig.apiKey}`,
        },
        body: JSON.stringify(u),
      })
    );
  });

  // update bots
  users.filter((user) => user.provider).
    forEach((u) => {
    console.info("Updating", u.username);
    whenUsers.push(
      fetch(new URL("/api/bots/" + u.username, serverConfig.weavyUrl), {
        agent: serverConfig.agent,
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${serverConfig.apiKey}`,
        },
        body: JSON.stringify(u),
      })
    );
  });

  await Promise.all(whenUsers);
}

export function start() {
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

  process.on("uncaughtException", function (err) {
    console.error(err);
  });

  /// ENV
  const PORT = process.env.PORT || 3001;

  const serverConfig = getServerConfig();
  const users = getUsers();

  const app = getAuthServer(serverConfig, users);

  return app.listen(PORT, (_server) => {
    console.info(`Environment: ${serverConfig.weavyUrl}`);
    console.info(`Auth server: http://localhost:${PORT}/`);

    syncUsers(serverConfig, users);
  });
}
