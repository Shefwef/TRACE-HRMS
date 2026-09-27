-- Drop the ADMIN role entirely. Existing ADMIN users are collapsed into HR
-- so the reviewer/edit privileges they held stay with the same people.
--
-- Postgres enums don't support DROP VALUE, so we rebuild the enum type:
--   1. Migrate all data referencing ADMIN over to HR (users.role, users.roles,
--      role_permissions.role).
--   2. Rename the old enum, create the new one, cast every column, drop old.

-- 1a. Any user whose primary role is ADMIN becomes HR.
UPDATE "users" SET "role" = 'HR' WHERE "role" = 'ADMIN';

-- 1b. Any user whose secondary-role list contains ADMIN: replace ADMIN with HR
--     and de-duplicate.
UPDATE "users"
   SET "roles" = ARRAY(
     SELECT DISTINCT unnest(
       ARRAY_REPLACE("roles"::text[], 'ADMIN', 'HR')
     )
   )::"Role"[]
 WHERE 'ADMIN' = ANY("roles"::text[]);

-- 1c. Fold any RolePermission rows keyed to ADMIN into HR (skip conflicts).
INSERT INTO "role_permissions" ("id", "role", "permission", "enabled", "updatedAt", "updatedById")
SELECT gen_random_uuid()::text, 'HR'::"Role", "permission", "enabled", now(), NULL
  FROM "role_permissions"
 WHERE "role" = 'ADMIN'
   AND NOT EXISTS (
     SELECT 1 FROM "role_permissions" hr
      WHERE hr."role" = 'HR' AND hr."permission" = "role_permissions"."permission"
   );
DELETE FROM "role_permissions" WHERE "role" = 'ADMIN';

-- 2. Rebuild the enum without ADMIN.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'HR', 'LINE_MANAGER', 'EMPLOYEE');

ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role"),
  ALTER COLUMN "roles" DROP DEFAULT,
  ALTER COLUMN "roles" TYPE "Role"[] USING ("roles"::text[]::"Role"[]),
  ALTER COLUMN "roles" SET DEFAULT ARRAY[]::"Role"[];

ALTER TABLE "role_permissions"
  ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");

DROP TYPE "Role_old";
