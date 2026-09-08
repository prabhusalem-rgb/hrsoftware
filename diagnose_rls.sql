-- Diagnostic: Check if current user's profile exists
SELECT
  'Current user (auth.uid()):' as check,
  auth.uid() as user_id
UNION ALL
SELECT
  'Profile exists in profiles table:' as check,
  CASE WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
    THEN 'YES'
    ELSE 'NO'
  END
UNION ALL
SELECT
  'Profile details:' as check,
  JSONB_BUILD_OBJECT(
    'id', p.id,
    'email', p.email,
    'role', p.role,
    'company_id', p.company_id
  )::TEXT
FROM profiles p
WHERE p.id = auth.uid()
LIMIT 1;

-- Also check employee
SELECT
  'Employee exists:' as check,
  CASE WHEN EXISTS (SELECT 1 FROM employees WHERE id = '1c808c5c-0ace-46af-8fb5-323a5e1d8061')
    THEN 'YES'
    ELSE 'NO'
  END;
