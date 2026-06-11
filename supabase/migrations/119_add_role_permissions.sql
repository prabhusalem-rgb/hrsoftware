-- Add role_permissions column to system_settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS role_permissions JSONB NOT NULL DEFAULT '{
  "company_admin": {
    "employees": ["read", "create", "update", "delete"],
    "attendance": ["read", "create", "update", "delete"],
    "leaves": ["read", "create", "update", "delete"],
    "loans": ["read", "create", "update", "delete"],
    "payroll": ["read", "create", "update", "delete"],
    "reports": ["read", "create", "update", "delete"],
    "users": ["read", "create", "update", "delete"],
    "settings": ["read", "create", "update", "delete"]
  },
  "hr": {
    "employees": ["read", "create", "update"],
    "attendance": ["read", "create", "update"],
    "leaves": ["read", "create", "update"],
    "loans": ["read", "create"],
    "payroll": ["read"],
    "reports": ["read"],
    "users": ["read"],
    "settings": ["read"]
  },
  "finance": {
    "employees": ["read"],
    "attendance": ["read"],
    "leaves": ["read"],
    "loans": ["read", "create", "update"],
    "payroll": ["read", "create", "update", "delete"],
    "reports": ["read"],
    "users": ["read"],
    "settings": ["read"]
  },
  "viewer": {
    "employees": ["read"],
    "attendance": ["read"],
    "leaves": ["read"],
    "loans": ["read"],
    "payroll": ["read"],
    "reports": ["read"],
    "users": ["read"],
    "settings": ["read"]
  }
}'::jsonb;
