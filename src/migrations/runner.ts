import { MongoClient, Db } from "mongodb";
import * as fs from "fs";
import * as path from "path";
import { connectToDatabase } from "../db";
import type { Migration } from "./types";

interface MigrationRecord {
  _id: string;
  appliedAt: Date;
}

/**
 * Run all pending migrations in the correct order
 *
 * @param mongoUrl - MongoDB connection string (optional, uses db connection from app if not provided)
 */
export async function runMigrations(mongoUrl?: string): Promise<void> {
  console.log("Starting database migrations...");

  let client: MongoClient | null = null;
  let db: Db;

  try {
    // Either connect using provided URL or use the app's DB connection
    if (mongoUrl) {
      client = new MongoClient(mongoUrl);
      await client.connect();
      db = client.db();
      console.log("Connected to database using provided URL");
    } else {
      db = await connectToDatabase();
      console.log("Connected to database using application connection");
    }

    // Ensure migrations collection exists
    const migrationsCollection = db.collection<MigrationRecord>("migrations");

    // Get applied migrations
    const appliedMigrations = await migrationsCollection.find().toArray();
    const appliedMigrationIds = new Set(appliedMigrations.map((m) => m._id));

    console.log(
      `Found ${appliedMigrations.length} previously applied migrations`
    );

    // Load migration scripts
    const scriptsDir = path.join(__dirname, "scripts");
    const migrationFiles = fs
      .readdirSync(scriptsDir)
      .filter(
        (file) =>
          (file.endsWith(".js") || file.endsWith(".ts")) &&
          !file.endsWith(".d.ts")
      )
      .sort(); // Ensure order by filename

    console.log(
      `Found ${migrationFiles.length} migration files: ${migrationFiles.join(
        ", "
      )}`
    );

    // Import and execute each migration
    for (const file of migrationFiles) {
      const migration: Migration = require(path.join(scriptsDir, file));

      if (!appliedMigrationIds.has(migration.id)) {
        console.log(
          `Applying migration: ${migration.id} - ${migration.description}`
        );

        try {
          await migration.up(db);

          // Record migration
          await migrationsCollection.insertOne({
            _id: migration.id,
            appliedAt: new Date(),
          });

          console.log(`Migration ${migration.id} applied successfully`);
        } catch (error) {
          console.error(`Error applying migration ${migration.id}:`, error);
          throw error;
        }
      } else {
        console.log(`Migration ${migration.id} already applied, skipping`);
      }
    }

    console.log("All migrations completed");
  } catch (error) {
    console.error("Migration process failed:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log("Database connection closed");
    }
  }
}

/**
 * Roll back the most recent migration
 *
 * @param mongoUrl - MongoDB connection string (optional, uses db connection from app if not provided)
 */
export async function rollbackLatestMigration(
  mongoUrl?: string
): Promise<void> {
  console.log("Starting migration rollback...");

  let client: MongoClient | null = null;
  let db: Db;

  try {
    // Either connect using provided URL or use the app's DB connection
    if (mongoUrl) {
      client = new MongoClient(mongoUrl);
      await client.connect();
      db = client.db();
    } else {
      db = await connectToDatabase();
    }

    // Get migrations collection
    const migrationsCollection = db.collection<MigrationRecord>("migrations");

    // Find the most recently applied migration
    const latestMigration = await migrationsCollection
      .find()
      .sort({ appliedAt: -1 })
      .limit(1)
      .toArray();

    if (latestMigration.length === 0) {
      console.log("No migrations to roll back");
      return;
    }

    const migrationId = latestMigration[0]._id;
    console.log(`Rolling back migration: ${migrationId}`);

    // Find and execute the down function for this migration
    const scriptsDir = path.join(__dirname, "scripts");
    const migrationFiles = fs
      .readdirSync(scriptsDir)
      .filter(
        (file) =>
          (file.endsWith(".js") || file.endsWith(".ts")) &&
          !file.endsWith(".d.ts")
      );

    let migrationFound = false;

    for (const file of migrationFiles) {
      const migration: Migration = require(path.join(scriptsDir, file));

      if (migration.id === migrationId) {
        migrationFound = true;

        try {
          await migration.down(db);

          // Remove migration record
          await migrationsCollection.deleteOne({ _id: migrationId });

          console.log(`Migration ${migrationId} rolled back successfully`);
        } catch (error) {
          console.error(`Error rolling back migration ${migrationId}:`, error);
          throw error;
        }

        break;
      }
    }

    if (!migrationFound) {
      throw new Error(`Could not find migration script for ID: ${migrationId}`);
    }
  } catch (error) {
    console.error("Rollback process failed:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Allow running from command line
if (require.main === module) {
  const rollback = process.argv.includes("--rollback");
  const mongoUrl = process.env.MONGODB_URI;

  if (rollback) {
    rollbackLatestMigration(mongoUrl)
      .then(() => {
        console.log("Rollback completed");
        process.exit(0);
      })
      .catch((err) => {
        console.error("Rollback failed:", err);
        process.exit(1);
      });
  } else {
    runMigrations(mongoUrl)
      .then(() => {
        console.log("Migration process completed");
        process.exit(0);
      })
      .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
      });
  }
}
