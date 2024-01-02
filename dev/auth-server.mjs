import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

/// ENV

const PREFIX = process.env.PREFIX || "uikit-web";

const PORT = process.env.PORT || 3001;

const users = {
  developer: `${PREFIX}-dev`,
  tester: `${PREFIX}-test`,
};

if (!process.env.WEAVY_URL) {
  throw new Error("No WEAVY_URL defined in ENV.");
}

const weavyUrl = new URL(process.env.WEAVY_URL);

if (!process.env.WEAVY_APIKEY) {
  throw new Error("No WEAVY_APIKEY defined in ENV.");
}

const apiKey = process.env.WEAVY_APIKEY;

const currentUser = users[process.env.CURRENT_USER || "developer"];

if (!currentUser) {
  throw new Error("No valid CURRENT_USER provided in ENV.");
}

/// SERVER

const app = express();
let _tokens = [];

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

process.on("uncaughtException", function (err) {
  console.log(err);
  var stack = err.stack;
  //you can also notify the err/stack to support via email or other APIs
});

app.use(express.json());

app.use(cors());

app.post("/webhooks", (req, res) => {
  console.log("Received webhook...", req.body);
  //io.emit("notification", req.body)
  res.end("OK");
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
      user: { uid: currentUser },
    }),
  });

  res.end(await response.text());
});

app.get("/api/token", async (req, res) => {
  let username = currentUser; // get user from session

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
      res.json({ message: "Could not get access token from server!" });
    }
  }
});

app.listen(PORT, (_server) => {
  console.log(`User: ${currentUser}`);
  console.log(`Environment: ${weavyUrl}`);
  console.log(`Auth server: http://localhost:${PORT}/`);
});
