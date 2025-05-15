# Database Migrations

This directory contains a database migration system for Chapters. It allows for structured and version-controlled database schema changes.

## Migration Structure

The migrations follow this structure:

```
/src
  /migrations
    /scripts
      001-add-phase-timings.ts    # Each migration script is prefixed with a sequential number
      002-remove-duplicate-ids.ts
    index.ts                      # Exports types and utilities
    runner.ts                     # Contains the migration runner logic
    types.ts                      # Contains the Migration interface
    README.md                     # This file
```

## Migration Tracking

Migrations are tracked in a `migrations` collection in MongoDB. Each applied migration is recorded with its unique ID and timestamp.

## Creating a Migration

1. Create a new file in the `scripts` directory with the naming pattern `NNN-descriptive-name.ts`
2. Implement the migration using the template below

```typescript
import { Db } from "mongodb";
import { Migration } from "../types";

// Unique identifier (preferably with date for historical context)
export const id = "your-migration-id-YYYYMMDD";
export const description = "A human-readable description of the migration";

/**
 * Apply the migration
 */
export async function up(db: Db): Promise<void> {
  // Implement the migration logic
}

/**
 * Rollback the migration
 */
export async function down(db: Db): Promise<void> {
  // Implement the rollback logic
}
```

## Running Migrations

To run all pending migrations:

```bash
npm run migrate
```

To rollback the last applied migration:

```bash
npm run migrate:rollback
```

## Migration Best Practices

1. Always make migrations idempotent (can be applied multiple times without side effects)
2. Include both up and down functions for each migration
3. Use transactions when possible for complex migrations
4. Log important information during migrations
5. Test migrations in a staging environment before applying to production

## Handling Errors

If a migration fails, the error will be reported and the migration will be marked as failed.
You should fix the issue and then run the migration again.

## Deployed Migrations

For production environments, you should apply migrations before deploying code that depends on the migrated schema.
The migration runner can be executed directly from the command line on your deployment server or as part of your CI/CD pipeline.
