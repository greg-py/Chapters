import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const DEFAULT_PHASE_DURATIONS = {
  suggestion: 7,
  voting: 7,
  reading: 30,
  discussion: 7,
};

// Fast test mode with 1-minute durations for testing phase transitions
// Enable by setting PHASE_TEST_MODE=true in your .env file
export const getPhaseConfig = () => {
  const isTestMode = process.env.PHASE_TEST_MODE === "true";

  if (isTestMode) {
    console.log("🧪 TEST MODE ENABLED: All phase durations set to 1 minute");
    return {
      suggestion: 1 / 1440, // 1 minute in days (1/24/60)
      voting: 1 / 1440,
      reading: 1 / 1440,
      discussion: 1 / 1440,
    };
  }

  return DEFAULT_PHASE_DURATIONS;
};
