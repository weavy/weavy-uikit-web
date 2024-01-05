#!/usr/bin/env node
'use strict';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

const args = process.argv.slice(2);

const scriptIndex = args.findIndex(
  x => x === 'auth-server'
);
const script = scriptIndex === -1 ? args[0] : args[scriptIndex];
//const nodeArgs = scriptIndex > 0 ? args.slice(0, scriptIndex) : [];

if (['auth-server'].includes(script)) {
  const result = import("../dev/auth-server.mjs")
  //process.exit(result.status);
  console.log("Running Weavy development auth server...");
} else {
  console.log('Unknown script "' + script + '".');
}