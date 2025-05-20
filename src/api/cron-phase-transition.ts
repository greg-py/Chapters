import { Request, Response } from "express";
import { PhaseTransitionService } from "../services/PhaseTransition";

/**
 * API handler that runs a single phase transition check
 * This endpoint will be triggered by Vercel CRON
 */
export default async function handler(req: Request, res: Response) {
  // Verify this is coming from Vercel Cron
  const userAgent = req.headers["user-agent"];
  if (!userAgent || !userAgent.includes("vercel-cron")) {
    console.log("👮‍♂️ Request rejected: Not from Vercel Cron");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("🔄 CRON job triggered: Running phase transition check");

  try {
    // Get singleton instance of the service
    const phaseTransitionService = PhaseTransitionService.getInstance(null);

    // Trigger a single check
    await phaseTransitionService.triggerCheck();

    console.log("✅ Phase transition check completed successfully");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error in phase transition check:", error);
    return res
      .status(500)
      .json({ error: "Failed to run phase transition check" });
  }
}
