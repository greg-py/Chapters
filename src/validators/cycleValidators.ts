import { Cycle } from "../services";
import { CyclePhase } from "../constants";
import { capitalizeFirstLetter } from "../utils";

/**
 * Validates that no active cycle exists for the given channel.
 * @param channelId The channel ID to check.
 * @throws Error if an active cycle is found.
 */
export async function validateNoActiveCycleExists(
  channelId: string
): Promise<void> {
  const cycle = await Cycle.getActive(channelId);
  if (cycle) {
    throw new Error(
      "An active cycle already exists in this channel. Use `/chapters-cycle-status` or complete it first."
    );
  }
}

/**
 * Validates that an active cycle exists for the given channel.
 * @param channelId The channel ID to check.
 * @returns The active Cycle instance.
 * @throws Error if no active cycle is found.
 */
export async function validateActiveCycleExists(
  channelId: string
): Promise<Cycle> {
  const cycle = await Cycle.getActive(channelId);
  if (!cycle) {
    throw new Error(
      "No active book club cycle found for this channel. Use `/chapters-start-cycle` to begin."
    );
  }
  return cycle;
}

/**
 * Validates that the given cycle is in one of the expected phases.
 * @param cycle The Cycle instance to check.
 * @param expectedPhase The phase(s) the cycle should be in.
 * @param phaseNoun A descriptive noun for the phase (e.g., "voting", "suggestion"). Used in error messages.
 * @throws Error if the cycle is not in the expected phase.
 */
export function validateCyclePhase(
  cycle: Cycle,
  expectedPhase: CyclePhase | CyclePhase[],
  phaseNoun: string
): void {
  const currentPhase: string = cycle.getCurrentPhase();
  const expectedPhaseStrings = (
    Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase]
  ).map((p) => p.toString());

  if (!expectedPhaseStrings.includes(currentPhase)) {
    const expectedText = expectedPhaseStrings
      .map((p) => `"${capitalizeFirstLetter(p)}"`)
      .join(" or ");
    throw new Error(
      `The current cycle is in the "${capitalizeFirstLetter(
        currentPhase
      )}" phase, but this action requires the ${phaseNoun} phase (${expectedText}).`
    );
  }
}
