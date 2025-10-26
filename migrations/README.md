# Database Migrations

This directory contains versioned database migrations managed by Drizzle Kit.

## Migration Workflow

### Development
For rapid iteration in development, you can use:
```bash
npm run db:push
```
This directly syncs the schema to the database without creating migration files.

### Production & Version Control
For production deployments and version tracking, always generate proper migrations:

```bash
# 1. Modify your schema in shared/schema.ts
# 2. Generate a migration file
npm run db:generate

# 3. Review the generated SQL in migrations/
# 4. Apply the migration to your database
npm run db:migrate

# 5. Commit the migration files to version control
git add migrations/
git commit -m "Add migration for [describe changes]"
```

### Migration Best Practices

1. **Always review generated migrations** - Check the SQL before applying
2. **Test migrations on staging first** - Never run untested migrations on production
3. **Keep migrations small** - One logical change per migration
4. **Never edit existing migrations** - Create new migrations for changes
5. **Commit migrations with code** - Migration + code changes should be in the same PR

### Useful Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Force push schema (development only)
npm run db:push -- --force

# Open Drizzle Studio (visual database browser)
npm run db:studio
```

### Migration Files

Migration files are automatically named with a sequential number and description:
- `0000_plain_gravity.sql` - Initial schema
- `0001_next_change.sql` - Next migration
- etc.

Each migration includes:
- SQL statements to apply changes
- Metadata for tracking

### Rollback Strategy

Drizzle Kit doesn't automatically generate rollback migrations. For critical changes:
1. Backup your database before applying
2. Document manual rollback steps in migration commit message
3. Test rollback procedure on staging

## Current Schema Version

See the latest migration file in this directory for the current schema state.
