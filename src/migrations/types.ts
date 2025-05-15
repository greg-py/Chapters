import type { Db, ObjectId } from "mongodb";

/**
 * Interface for a database migration script
 */
export interface Migration {
  /**
   * Unique identifier for the migration (used for tracking)
   */
  id: string;

  /**
   * Human-readable description of what the migration does
   */
  description: string;

  /**
   * Function to apply the migration
   */
  up: (db: Db) => Promise<void>;

  /**
   * Function to reverse the migration
   */
  down: (db: Db) => Promise<void>;
}
