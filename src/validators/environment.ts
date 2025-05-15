/**
 * Environment variable validator
 * Ensures that required environment variables are present and valid
 */

/**
 * Definition of an environment variable requirement
 */
export interface EnvVarRequirement {
  name: string;
  description: string;
  validator?: (val: string) => boolean;
}

/**
 * Validates that all required environment variables are set
 * @throws Error if any required variable is missing or invalid
 */
export function validateEnvironment(): void {
  // Check for required environment variables
  const requiredEnvVars: EnvVarRequirement[] = [
    {
      name: "SLACK_APP_BOT_TOKEN",
      description: "Bot User OAuth Token (starts with xoxb-)",
      validator: (val: string) => val.startsWith("xoxb-"),
    },
    ...(process.env.USE_SOCKET_MODE === "true"
      ? [
          {
            name: "SLACK_APP_TOKEN",
            description: "App-Level Token (starts with xapp-)",
            validator: (val: string) => val.startsWith("xapp-"),
          },
        ]
      : []),
    {
      name: "SLACK_APP_SIGNING_SECRET",
      description: "Signing Secret from Basic Information",
      validator: (val: string) => val.length > 0,
    },
    {
      name: "MONGODB_URI",
      description: "MongoDB Connection URI",
      validator: (val: string) => val.startsWith("mongodb"),
    },
  ];

  const errors: string[] = [];

  // Check for missing variables
  const missingVars = requiredEnvVars.filter((v) => !process.env[v.name]);
  if (missingVars.length > 0) {
    errors.push("Missing required environment variables:");
    missingVars.forEach((v) => {
      errors.push(`- ${v.name}: ${v.description}`);
    });
  }

  // Validate format of provided variables
  requiredEnvVars
    .filter((v) => process.env[v.name] && v.validator)
    .forEach((v) => {
      if (!v.validator!(process.env[v.name] as string)) {
        errors.push(`Invalid format for ${v.name}: ${v.description}`);
      }
    });

  if (errors.length > 0) {
    const errorMessage = errors.join("\n") + "\nPlease check your .env file";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}
