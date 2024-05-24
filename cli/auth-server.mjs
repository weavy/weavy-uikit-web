import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import session from "express-session";

/// ENV
const PORT = process.env.PORT || 3001;

if (!process.env.WEAVY_URL) {
  throw new Error("No WEAVY_URL defined in ENV.");
}

const weavyUrl = new URL(process.env.WEAVY_URL);

if (!process.env.WEAVY_APIKEY) {
  throw new Error("No WEAVY_APIKEY defined in ENV.");
}

const apiKey = process.env.WEAVY_APIKEY;

/// USERS AND BOTS
const users = [
  { name: "Marvin Acme", username: "marvin", email: "marvin@acme.corp", avatar: "https://i.pravatar.cc/150?u=marvin" },
  { name: "Road Runner", username: "meepmeep", email: "roadrunner@acme.corp", avatar: "https://i.pravatar.cc/150?u=meepmeep" },
  { name: "Bugs Bunny", username: "bugs", email: "bugs@acme.corp", avatar: "https://i.pravatar.cc/150?u=bugs" },
  { name: "Daffy Duck", username: "daffy", email: "daffy@acme.corp", avatar: "https://i.pravatar.cc/150?u=daffy" },
  { name: "Porky Pig", username: "porky", email: "porky@acme.corp", avatar: "https://i.pravatar.cc/150?u=porky" },
  { name: "Tweety Bird", username: "tweety", email: "tweety@acme.corp", avatar: "https://i.pravatar.cc/150?u=tweety" },
  { name: "Wile E. Coyote", username: "wile", email: "wile@acme.corp", avatar: "https://i.pravatar.cc/150?u=wile" },
  { name: "Claude", username: "claude", metadata: { family: "claude", api_key: process.env.CLAUDE_APIKEY }, is_bot: true },
  { name: "Gemini", username: "gemini", metadata: { family: "gemini", api_key: process.env.GEMINI_APIKEY }, is_bot: true },
  { name: "Kapa", username: "kapa", metadata: { family: "kapa", api_key: process.env.KAPA_APIKEY }, is_bot: true },
  { name: "OpenAI", username: "openai", metadata: { family: "openai", model: "gpt-4o", api_key: process.env.OPENAI_APIKEY }, is_bot: true },
];


function getUser(username) {
  // try to get user with specified name, otherwise return the first user
  if (username) {
    const user = users.find((user) => user.username.toUpperCase() === username.toUpperCase());
    if (user !== undefined && !user.is_bot) {
      return user;
    }
  }
  return users.find((u) => !u.is_bot);
}

/// SERVER
const app = express();
let _tokens = [];

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

process.on("uncaughtException", function (err) {
  console.log(err);
});

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

// syncusers to weavy
[users].forEach((u) => {
  console.log("Syncing", u.username);
  fetch(new URL("/api/users/" + u.username, weavyUrl), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(u)
  });
});

// list users
app.get("/api/users", async (req, res) => {
  res.json(
    users.filter((user)=>!user.is_bot).map((user) => {
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
    users.filter((user)=>user.is_bot).map((bot) => {
        return { username: bot.username, name: bot.name };
    })
  );
});

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

app.get("/api/contextual/:id", async (req, res) => {
  // setup contextual app
  let response = await fetch(new URL("/api/apps/init", weavyUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      app: { uid: req.params.id, name: req.params.id, type: req.query.type },
      user: { uid: getUser(req.session.user).username },
    }),
  });

  res.end(await response.text());
});

app.get("/api/token", async (req, res) => {
  let username = getUser(req.session.user).username; // get user from session or default (first) user

  if ((!req.query.refresh || req.query.refresh === "false") && _tokens.find((t) => t.username === username)) {
    res.json({ access_token: _tokens.find((t) => t.username === username).access_token });
  } else {
    let response = await fetch(new URL(`/api/users/${username}/tokens`, weavyUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
  }
});

app.listen(PORT, (_server) => {
  console.log(`Environment: ${weavyUrl}`);
  console.log(`Auth server: http://localhost:${PORT}/`);
});
