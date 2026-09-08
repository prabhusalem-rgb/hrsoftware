#!/usr/bin/env node

/**
 * Script to remove demo mode code from all query hooks.
 * Processes files by:
 * 1. Removing useDemo/demo-data imports
 * 2. Removing isDemoMode checks and demo branches
 * 3. Keeping only production Supabase code
 */

const fs = require('fs');
const path = require('path');

const hooksDir = '/Users/prabhu/Documents/Development/7.0/hrsoftware/src/hooks/queries';

const filesToProcess = [
  'useAirTicketMutations.ts',
  'useAirTickets.ts',
  'useAirTicketBalance.ts',
  'useAttendance.ts',
  'useAttendanceMutations.ts',
  'useAuditLogs.ts',
  'useBankStatements.ts',
  'useCompanies.ts',
  'useCompanyMutations.ts',
  'useDashboardStats.ts',
  'useDeleteSalaryRevision.ts',
  'useEmployeeMutations.ts',
  'useEmployees.ts',
  'useExceptions.ts',
  'useLeaveMutations.ts',
  'useLeaveTypes.ts',
  'useLoanMutations.ts',
  'useLoanRepayments.ts',
  'useLoanReports.ts',
  'useLoans.ts',
  'usePayoutMutations.ts',
  'usePayoutReports.ts',
  'usePayoutRuns.ts',
  'usePayoutSchedules.ts',
  'usePayrollItems.ts',
  'usePayrollRuns.ts',
  'useProfiles.ts',
  'useWPSExports.ts',
];

let totalFiles = 0;
let totalChanges = 0;

filesToProcess.forEach(file => {
  const filePath = path.join(hooksDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Remove useDemo and demo-data imports
  content = content.replace(
    /import\s+[\{]\s*useDemo[\s\S]*?\}\s+from\s+['"]@\/contexts\/DemoContext['"];\s*\n?/g,
    ''
  );
  content = content.replace(
    /import\s+[\{][^}]*demo[^}]*\s*\}\s+from\s+['"]@\/lib\/demo-data['"];\s*\n?/g,
    ''
  );
  content = content.replace(
    /import\s+[\{]\s*demoEmployees[\s\S]*?\}\s+from\s+['"]@\/lib\/demo-data['"];\s*\n?/g,
    ''
  );
  content = content.replace(
    /import\s+[\{]\s*demo[^}]*\s*\}\s+from\s+['"]@\/lib\/demo-data['"];\s*\n?/g,
    ''
  );

  // Remove isDemoProp parameter (with default value)
  content = content.replace(/\s*,\s*isDemoProp\s*=\s*false\s*/g, '');
  content = content.replace(/\(\s*companyId:\s*string\s*,\s*isDemoProp\s*:\s*boolean\s*=\s*false\s*\)/g, '(companyId: string)');
  content = content.replace(/\(\s*companyId\s*:\s*string\s*,\s*isDemoProp\s*\)/g, '(companyId: string)');

  // Remove isDemoMode destructuring
  content = content.replace(
    /const\s+\{\s*isDemo:\s*contextDemo\s*,\s*demoData\s*\}\s*=\s*useDemo\(\);\s*\n?/g,
    ''
  );
  content = content.replace(
    /const\s+\{\s*isDemo:\s*isDemoMode[\s\S]*?\}\s*=\s*useDemo\(\);\s*\n?/g,
    ''
  );
  content = content.replace(
    /const\s+\{\s*isDemo[\s\S]*?\}\s*=\s*useDemo\(\);\s*\n?/g,
    ''
  );

  // Remove isDemoMode variable declarations (const/let)
  content = content.replace(/const\s+isDemoMode\s*=\s*contextDemo\s*\|\|\s*isDemoProp;\s*\n?/g, '');
  content = content.replace(/const\s+isDemoMode\s*=\s*contextDemo\s*;\s*\n?/g, '');
  content = content.replace(/const\s+isDemoMode\s*=\s*isDemoProp\s*;\s*\n?/g, '');

  // Remove if (isDemoMode) { ... } blocks - keep only the else/production part
  // Pattern: if (isDemoMode || !supabase ...) - keep only the condition without isDemoMode
  content = content.replace(/if\s*\(isDemoMode\s*\|\|\s*!/g, 'if (!');
  content = content.replace(/if\s*\(isDemoMode\s*\|\|\s*companyId\s*\)/g, 'if (!companyId)');
  content = content.replace(/if\s*\(isDemoMode\s*\|\|\s*!supabase\s*\|\|\s*!companyId\s*\)/g, 'if (!supabase || !companyId)');
  content = content.replace(/if\s*\(isDemoMode\s*\|\|\s*!supabase\s*\)/g, 'if (!supabase)');

  // Remove demo mode returns that come before Supabase checks
  // These are the blocks that start with "return { ... }" after isDemoMode check
  // We need to be more careful here - look for patterns like:
  // if (isDemoMode || !supabase || !companyId) {
  //   return demoData.xxx ...
  // }
  // and replace with just: if (!supabase || !companyId) { return []; }

  // Remove any remaining demoData. references - replace with [] for arrays or appropriate defaults
  content = content.replace(/demoData\.employees/g, '[]');
  content = content.replace(/demoData\.leaves/g, '[]');
  content = content.replace(/demoData\.loans/g, '[]');
  content = content.replace(/demoData\.settlements/g, '[]');
  content = content.replace(/demoData\.wpsExports/g, '[]');
  content = content.replace(/demoData\.payoutSchedules/g, '[]');
  content = content.replace(/demoData\.payoutRuns/g, '[]');
  content = content.replace(/demoData\.bankStatements/g, '[]');
  content = content.replace(/demoData\.salaryRevisions/g, '[]');
  content = content.replace(/demoData\.leaveBalances/g, '[]');

  // Remove demoEmployees, demoLeaveTypes, demoLoans, demoPayrollRuns array references
  content = content.replace(/demoEmployees/g, '[]');
  content = content.replace(/demoLeaveTypes/g, '[]');
  content = content.replace(/demoLoans/g, '[]');
  content = content.replace(/demoPayrollRuns/g, '[]');
  content = content.replace(/demoPayoutRuns/g, '[]');
  content = content.replace(/demoPayoutSchedules/g, '[]');

  // Remove the demo branches that return mock data
  // This is tricky - we need to remove entire if blocks while keeping the else/production part
  // Let me use a different approach: find patterns like "if (isDemoMode) { return mock }" and remove them

  // For simple patterns where demo block comes first and is followed by production block
  const lines = content.split('\n');
  let cleanedLines = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts a demo mode block we want to remove
    if (/^\s*if\s*\(isDemoMode\)\s*\{/.test(line) ||
        /^\s*if\s*\(isDemoMode\s*\|\|/.test(line)) {
      // Find matching closing brace
      let depth = 0;
      let j = i;
      let blockContent = '';
      for (; j < lines.length; j++) {
        blockContent += lines[j] + '\n';
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        if (depth === 0) break;
      }
      // Check what comes after - if there's an else block, keep it
      let after = '';
      let nextIdx = j + 1;
      if (nextIdx < lines.length && /^\s*else\s*\{/.test(lines[nextIdx])) {
        // Keep the else block
        let elseDepth = 0;
        for (; nextIdx < lines.length; nextIdx++) {
          after += lines[nextIdx] + '\n';
          elseDepth += (lines[nextIdx].match(/\{/g) || []).length;
          elseDepth -= (lines[nextIdx].match(/\}/g) || []).length;
          if (elseDepth === 0) break;
        }
        cleanedLines.push(after.trim());
      }
      i = nextIdx + 1;
      continue;
    }

    // Remove lines that reference demoData in conditions like "if (isDemoMode)"
    if (line.includes('isDemoMode') && !line.includes('isDemoMode?')) {
      // Skip this line and find matching }
      let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      i++;
      while (i < lines.length && depth > 0) {
        depth += (lines[i].match(/\{/g) || []).length;
        depth -= (lines[i].match(/\}/g) || []).length;
        i++;
      }
      continue;
    }

    cleanedLines.push(line);
    i++;
  }

  content = cleanedLines.join('\n');

  // Clean up any leftover isDemoMode variable declarations
  content = content.replace(/\n\s*const\s+isDemoMode\s*=\s*[^;]+;\s*\n/g, '\n');
  content = content.replace(/\n\s*const\s+contextDemo\s*=\s*[^;]+;\s*\n/g, '\n');

  // Clean up remaining demo data fallbacks in early returns
  content = content.replace(/return\s+demoData\.\w+\s*[\],}]\s*\n/g, 'return [];\n');

  // Remove any remaining demo-related comments
  content = content.replace(/\/\/\s*Demo mode[^\n]*\n/g, '');
  content = content.replace(/\/\/\s*In demo mode[^\n]*\n/g, '');

  // Remove empty lines at file start from removed imports
  content = content.replace(/^\s*\n+/, '');

  if (content !== original) {
    console.log(`✓ Updated: ${file}`);
    totalFiles++;
    totalChanges++;
    fs.writeFileSync(filePath, content);
  } else {
    // Still check if file needs manual review
    if (original.includes('useDemo') || original.includes('demoData') || original.includes('demoEmployees')) {
      console.log(`⚠️  Still has demo refs: ${file}`);
    } else {
      console.log(`✓ Clean: ${file}`);
    }
  }
});

console.log(`\nTotal files updated: ${totalFiles}`);
