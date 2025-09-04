#!/usr/bin/env tsx
/**
 * Migration runner script
 * Usage: npm run migrate
 */

import { migrationRunner, logMigrationInstructions } from '../src/utils/migrations'

async function main() {
  console.log('🗄️  School Schedule Database Migration Tool\n')

  try {
    // Check current status
    const status = await migrationRunner.getStatus()
    
    console.log('Migration Status:')
    console.log(`- Total migrations: ${status.total}`)
    console.log(`- Applied: ${status.applied.length}`)
    console.log(`- Pending: ${status.pending.length}`)
    console.log(`- Schema version: ${status.schema_version}\n`)

    if (status.pending.length === 0) {
      console.log('✅ All migrations are up to date!')
      return
    }

    console.log('Pending migrations:')
    status.pending.forEach(id => {
      console.log(`- ${id}`)
    })
    console.log()

    // For development, just log instructions
    logMigrationInstructions()
    
    // In a production setup, you might want to actually run migrations
    // const success = await migrationRunner.runPendingMigrations()
    // if (success) {
    //   console.log('✅ All migrations completed successfully!')
    // } else {
    //   console.error('❌ Migration failed!')
    //   process.exit(1)
    // }

  } catch (error) {
    console.error('Error running migrations:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}