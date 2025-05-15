/**
 * Version utilities
 * Handles retrieving application version information
 */
import fs from "fs";
import path from "path";

// Cache the version to avoid reading the file multiple times
let cachedVersion = "";

/**
 * Gets the application version from package.json
 *
 * @returns The application version string
 */
export function getAppVersion(): string {
  // Return cached version if already determined
  if (cachedVersion) return cachedVersion;

  try {
    // Try environment variable first (available when running through npm)
    if (process.env.npm_package_version) {
      cachedVersion = process.env.npm_package_version;
      return cachedVersion;
    }

    // Try to find and read the package.json file
    const packagePath = findPackageJson();
    if (packagePath) {
      const packageContent = fs.readFileSync(packagePath, "utf8");
      const packageJson = JSON.parse(packageContent);

      if (packageJson.version) {
        cachedVersion = packageJson.version;
        return cachedVersion;
      }
    }

    // Fall back to unknown if version can't be determined
    cachedVersion = "unknown";
    return cachedVersion;
  } catch (error) {
    console.error("Error getting app version:", error);
    cachedVersion = "unknown";
    return cachedVersion;
  }
}

/**
 * Finds the package.json file by traversing up the directory tree
 *
 * @returns The path to package.json or null if not found
 */
function findPackageJson(): string | null {
  try {
    // Start from the directory of the current file
    let currentDir = __dirname;

    // Traverse up the directory tree until we find package.json or hit the root
    while (currentDir !== path.parse(currentDir).root) {
      const packagePath = path.join(currentDir, "package.json");

      if (fs.existsSync(packagePath)) {
        return packagePath;
      }

      // Move up one directory
      currentDir = path.dirname(currentDir);
    }
  } catch (error) {
    console.error("Error finding package.json:", error);
  }

  // If we reach the root without finding package.json or encounter an error
  return null;
}
