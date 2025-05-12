// This file ensures the TypeScript build happens during Vercel deployment
const { execSync } = require("child_process");

try {
  console.log("Building TypeScript project...");
  execSync("npm run vercel-build", { stdio: "inherit" });
  console.log("Build completed successfully");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
