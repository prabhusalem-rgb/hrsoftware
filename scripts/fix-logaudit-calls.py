import re, os, glob

# Find all files that import logAudit from audit logger
pattern = r"await logAudit\((\{[^}]+\},\s*supabase\)|logAudit\((\{[^}]+\})\s*,\s*supabase\))"

files = glob.glob('src/**/*.ts', recursive=True) + glob.glob('src/**/*.tsx', recursive=True)

for filepath in files:
    if 'audit-logger' in filepath:
        continue
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        original = content
        # Replace "logAudit({...}, supabase)" with "logAudit({...})"
        # Handle various spacing patterns
        content = re.sub(
            r'await logAudit\(\s*(\{[^}]+\})\s*,\s*supabase\s*\)',
            r'await logAudit(\1)',
            content
        )
        # Also handle non-awaited calls
        content = re.sub(
            r'logAudit\(\s*(\{[^}]+\})\s*,\s*supabase\s*\)',
            r'logAudit(\1)',
            content
        )
        if content != original:
            with open(filepath, 'w') as f:
                f.write(content)
            print(f'Updated: {filepath}')
    except Exception as e:
        print(f'Error in {filepath}: {e}')

print('\nDone!')
