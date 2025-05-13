const fs = require("fs");
const path = require("path");

// Read package.json
const packageJson = require("../package.json");
const version = packageJson.version;

// Read vercel.json
const vercelConfigPath = path.join(__dirname, "../vercel.json");
const vercelConfig = require(vercelConfigPath);

// Update the version in the build config
vercelConfig.builds[0].config.env.APP_VERSION = version;

// Write back to vercel.json
fs.writeFileSync(
  vercelConfigPath,
  JSON.stringify(vercelConfig, null, 2) + "\n"
);

console.log(`Updated Vercel config with version: ${version}`);
