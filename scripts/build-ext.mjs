import * as esbuild from "esbuild";

const entries = [
  ["extension/src/background.ts", "extension/background.js"],
  ["extension/src/content.ts", "extension/content.js"],
  ["extension/src/page-bridge.ts", "extension/page-bridge.js"],
  ["extension/src/popup.ts", "extension/popup.js"],
  ["extension/src/options.ts", "extension/options.js"],
];

await Promise.all(
  entries.map(([entry, outfile]) =>
    esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: "iife",
      outfile,
      target: "es2022",
      logLevel: "info",
    })
  )
);

console.log("Extension JS updated.");
