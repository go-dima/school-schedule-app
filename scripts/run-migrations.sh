#!/bin/bash
set -e

echo "🗄️  Running School Schedule Database Migrations..."

# Function to run SQL file
run_sql_file() {
    local file=$1
    echo "Running migration: $file"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$file"
}

# Run migrations in order
echo "📋 Starting migration process..."

# 1. Initial Schema
if [ -f "/docker-entrypoint-initdb.d/migrations/001_initial_schema.sql" ]; then
    run_sql_file "/docker-entrypoint-initdb.d/migrations/001_initial_schema.sql"
else
    echo "⚠️  Warning: 001_initial_schema.sql not found"
fi

# 2. RLS Policies
if [ -f "/docker-entrypoint-initdb.d/migrations/002_rls_policies.sql" ]; then
    run_sql_file "/docker-entrypoint-initdb.d/migrations/002_rls_policies.sql"
else
    echo "⚠️  Warning: 002_rls_policies.sql not found"
fi

# 3. Triggers and Functions
if [ -f "/docker-entrypoint-initdb.d/migrations/003_triggers_functions.sql" ]; then
    run_sql_file "/docker-entrypoint-initdb.d/migrations/003_triggers_functions.sql"
else
    echo "⚠️  Warning: 003_triggers_functions.sql not found"
fi

# 4. Sample Data
if [ -f "/docker-entrypoint-initdb.d/migrations/004_sample_data.sql" ]; then
    run_sql_file "/docker-entrypoint-initdb.d/migrations/004_sample_data.sql"
else
    echo "⚠️  Warning: 004_sample_data.sql not found"
fi

echo "✅ All migrations completed successfully!"

# Create a simple function to verify the setup
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Verify tables were created
    SELECT 'Tables created:' as status;
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
    
    -- Show row counts
    SELECT 'Data verification:' as status;
    SELECT 
        (SELECT COUNT(*) FROM public.time_slots) as time_slots_count,
        (SELECT COUNT(*) FROM public.classes) as classes_count,
        (SELECT COUNT(*) FROM public.users) as users_count;
EOSQL

echo "🎉 Database initialization complete!"