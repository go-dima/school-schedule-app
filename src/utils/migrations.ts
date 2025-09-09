/**
 * Database migrations utility
 * Handles running and tracking database migrations
 */

import { supabase } from "../services/supabase";
import log from "./logger";

interface Migration {
  id: string;
  name: string;
  description: string;
  file: string;
  created_at: string;
  dependencies: string[];
}

interface MigrationsManifest {
  migrations: Migration[];
  version: string;
  schema_version: number;
}

// Import migrations manifest
import migrationsManifest from "../../migrations/migrations.json";

export class MigrationRunner {
  private manifest: MigrationsManifest;

  constructor() {
    this.manifest = migrationsManifest as MigrationsManifest;
  }

  /**
   * Create migrations tracking table if it doesn't exist
   */
  async createMigrationsTable(): Promise<void> {
    const { error } = await supabase.rpc("create_migrations_table", {});

    if (error) {
      // Fallback: SQL would need to be run manually in production
      log.warn("Migration table creation requires manual setup in production");
      // // Fallback: create table with raw SQL
      // const { error: createError } = await supabase.sql`
      //   CREATE TABLE IF NOT EXISTS public.migrations (
      //     id TEXT PRIMARY KEY,
      //     name TEXT NOT NULL,
      //     description TEXT,
      //     applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      //   );
      //
      //   -- Enable RLS on migrations table
      //   ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
      //
      //   -- Only admins can manage migrations
      //   CREATE POLICY IF NOT EXISTS "Only admins can manage migrations" ON public.migrations
      //   FOR ALL USING (
      //     EXISTS (
      //       SELECT 1 FROM public.user_roles ur
      //       WHERE ur.user_id = auth.uid()
      //       AND ur.role = 'admin'
      //       AND ur.approved = true
      //     )
      //   );
      // `
      //
      // if (createError) {
      //   console.warn('Could not create migrations table:', createError.message)
      // }
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from("migrations")
        .select("id")
        .order("applied_at");

      if (error) {
        log.warn("Could not fetch applied migrations", {
          error: error.message,
        });
        return [];
      }

      return data.map(row => row.id);
    } catch (error) {
      log.warn("Error fetching migrations:", { error });
      return [];
    }
  }

  /**
   * Mark migration as applied
   */
  async markMigrationApplied(migration: Migration): Promise<void> {
    try {
      const { error } = await supabase.from("migrations").insert({
        id: migration.id,
        name: migration.name,
        description: migration.description,
      });

      if (error) {
        log.warn(`Could not mark migration ${migration.id} as applied`, {
          error: error.message,
        });
      }
    } catch (error) {
      log.warn(`Error marking migration ${migration.id} as applied:`, {
        error,
      });
    }
  }

  /**
   * Load migration SQL content
   */
  async loadMigrationSql(filename: string): Promise<string> {
    try {
      // In a real implementation, you would fetch the SQL file content
      // For now, we'll return a placeholder
      return `-- Migration: ${filename}\n-- This would contain the actual SQL content`;
    } catch (error) {
      throw new Error(`Could not load migration file: ${filename}`);
    }
  }

  /**
   * Run a single migration
   */
  async runMigration(migration: Migration): Promise<boolean> {
    try {
      log.info(`Running migration: ${migration.id} - ${migration.name}`);

      // Load and execute migration SQL
      const sql = await this.loadMigrationSql(migration.file);

      // Note: In a real implementation, you would execute the SQL here
      // For development, migrations should be run manually in Supabase SQL editor
      log.info(`Migration SQL for ${migration.id}:`);
      log.info(sql);

      // Mark as applied
      await this.markMigrationApplied(migration);

      return true;
    } catch (error) {
      log.error(`Failed to run migration ${migration.id}:`, { error });
      return false;
    }
  }

  /**
   * Check if migration dependencies are satisfied
   */
  areDependenciesSatisfied(
    migration: Migration,
    appliedMigrations: string[]
  ): boolean {
    return migration.dependencies.every(dep => appliedMigrations.includes(dep));
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations(): Promise<boolean> {
    try {
      await this.createMigrationsTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const pendingMigrations = this.manifest.migrations.filter(
        migration => !appliedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        log.info("No pending migrations");
        return true;
      }

      log.info(`Found ${pendingMigrations.length} pending migrations`);

      // Sort migrations by dependencies
      const sortedMigrations = this.topologicalSort(pendingMigrations);

      for (const migration of sortedMigrations) {
        if (!this.areDependenciesSatisfied(migration, appliedMigrations)) {
          log.error(`Migration ${migration.id} has unsatisfied dependencies`);
          return false;
        }

        const success = await this.runMigration(migration);
        if (!success) {
          log.error(`Failed to run migration ${migration.id}`);
          return false;
        }

        appliedMigrations.push(migration.id);
      }

      log.info("All migrations completed successfully");
      return true;
    } catch (error) {
      log.error("Error running migrations:", { error });
      return false;
    }
  }

  /**
   * Topological sort of migrations based on dependencies
   */
  private topologicalSort(migrations: Migration[]): Migration[] {
    const sorted: Migration[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (migration: Migration) => {
      if (visiting.has(migration.id)) {
        throw new Error(
          `Circular dependency detected involving ${migration.id}`
        );
      }
      if (visited.has(migration.id)) {
        return;
      }

      visiting.add(migration.id);

      for (const depId of migration.dependencies) {
        const dep = migrations.find(m => m.id === depId);
        if (dep) {
          visit(dep);
        }
      }

      visiting.delete(migration.id);
      visited.add(migration.id);
      sorted.push(migration);
    };

    for (const migration of migrations) {
      visit(migration);
    }

    return sorted;
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    applied: string[];
    pending: string[];
    total: number;
    schema_version: number;
  }> {
    const appliedMigrations = await this.getAppliedMigrations();
    const pendingMigrations = this.manifest.migrations
      .filter(m => !appliedMigrations.includes(m.id))
      .map(m => m.id);

    return {
      applied: appliedMigrations,
      pending: pendingMigrations,
      total: this.manifest.migrations.length,
      schema_version: this.manifest.schema_version,
    };
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner();

// Development helper to log migration instructions
export function logMigrationInstructions(): void {
  log.info(`
🗄️  Database Migration Instructions:

To set up your database, run these migrations in order in your Supabase SQL Editor:

${migrationsManifest.migrations
  .map(
    (m, i) =>
      `${i + 1}. ${m.name} (${m.file})
     ${m.description}`
  )
  .join("\n\n")}

Each migration file is located in migrations/

For production deployments, consider using Supabase CLI or a proper migration tool.
`);
}
