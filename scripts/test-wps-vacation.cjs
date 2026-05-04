const { generateWPSSIF } = require('./src/lib/calculations/wps');
const typeImports = require('./src/types');

// Minimal test data matching WPS page pattern
const company = {
  id: 'c1',
  name_en: 'Test Co',
  cr_number: '123456',
  bank_account: 'OM12BMCT000000001234567890',
  iban: 'OM12BMCT000000001234567890',
  name_ar: '',
  address: '',
  contact_email: '',
  contact_phone: '',
  bank_name: '',
  wps_mol_id: '',
  timezone: '',
  fiscal_year_start: 1,
  created_at: '',
  updated_at: '',
};

// Regular employee - HAS payroll item
const regularEmp = {
  id: 'emp-reg',
  emp_code: 'REG01',
  name_en: 'Regular Employee',
  email: '',
  id_type: 'civil_id',
  civil_id: '12345678',
  passport_no: '',
  nationality: 'OMANI',
  gender: 'male',
  religion: 'muslim',
  category: 'OMANI_INDIRECT_STAFF',
  department: 'Dept',
  designation: 'Staff',
  join_date: '2024-01-01',
  basic_salary: 1000,
  housing_allowance: 200,
  transport_allowance: 150,
  food_allowance: 0,
  special_allowance: 0,
  site_allowance: 0,
  other_allowance: 0,
  gross_salary: 1350,
  bank_name: 'Bank Muscat',
  bank_bic: 'BMCTOMRX',
  bank_iban: 'OM12BMCT000000001234567890',
  status: 'active',
  passport_expiry: null,
  passport_issue_date: null,
  visa_no: null,
  visa_type: null,
  visa_issue_date: null,
  visa_expiry: null,
  termination_date: null,
  leave_settlement_date: null,
  rejoin_date: null,
  opening_leave_balance: 0,
  opening_air_tickets: 0,
  emergency_contact_name: '',
  emergency_contact_phone: '',
  home_country_address: '',
  reporting_to: '',
  family_status: 'single',
  onboarding_status: 'joined',
  avatar_url: null,
  last_offer_sent_at: null,
  offer_accepted_at: null,
  is_salary_held: false,
  salary_hold_reason: null,
  salary_hold_at: null,
  air_ticket_cycle: 24,
  created_at: '',
  updated_at: '',
};

// Vacation employee - NO payroll item, on_leave status
const vacationEmp = {
  ...regularEmp,
  id: 'emp-vac',
  emp_code: 'VAC01',
  name_en: 'Vacation Employee',
  status: 'on_leave',
  leave_settlement_date: null,
  rejoin_date: null,
  civil_id: '87654321',
};

// Payroll item only for regular employee
const payrollItem = {
  id: 'pi-1',
  payroll_run_id: 'pr-1',
  employee_id: regularEmp.id,
  basic_salary: 1000,
  housing_allowance: 200,
  transport_allowance: 150,
  food_allowance: 0,
  special_allowance: 0,
  site_allowance: 0,
  other_allowance: 0,
  overtime_hours: 0,
  overtime_pay: 0,
  gross_salary: 1350,
  absent_days: 0,
  absence_deduction: 0,
  loan_deduction: 0,
  other_deduction: 0,
  total_deductions: 0,
  social_security_deduction: 0,
  pasi_company_share: 0,
  leave_deduction: 0,
  net_salary: 1350,
  eosb_amount: 0,
  leave_encashment: 0,
  air_ticket_balance: 0,
  final_total: 0,
  payout_status: 'pending',
  paid_amount: null,
  payout_date: null,
  payout_method: null,
  payout_reference: null,
  hold_reason: null,
  hold_authorized_by: null,
  hold_placed_at: null,
  hold_released_by: null,
  hold_released_at: null,
  hold_expiration_date: null,
  hold_notification_sent: false,
  hold_notification_date: null,
  hold_extended_count: 0,
  hold_extended_by: null,
  hold_extension_reason: null,
  wps_export_override: null,
  allowance_note: null,
  deduction_note: null,
  created_at: '',
  updated_at: '',
};

const employees = [regularEmp, vacationEmp];
const payrollItems = [payrollItem];

console.log('Generating WPS SIF...');
console.log('Employees:', employees.map(e => `${e.name_en} (${e.status})`).join(', '));
console.log('Payroll Items:', payrollItems.map(i => `${i.id} -> ${i.employee_id}`).join(', '));

const result = generateWPSSIF(company, employees, payrollItems, 2025, 5, 'monthly');

console.log('\n--- SIF Content ---');
console.log(result.sifContent);
console.log('\n--- Exported Amounts ---');
console.log(JSON.stringify(result.exportedAmounts, null, 2));

// Verify
const lines = result.sifContent.split('\n');
const employeeRows = lines.slice(3); // skip 3 header lines
console.log(`\nTotal data rows: ${employeeRows.length}`);
const vacRow = employeeRows.find(l => l.includes('VAC01'));
console.log('Vacation employee row found:', vacRow ? 'YES' : 'NO');
if (vacRow) {
  const fields = vacRow.split(',');
  console.log('Vacation row fields:');
  fields.forEach((f, i) => console.log(`  [${i}] ${f}`));
  console.log('Vacation row net salary (field 8):', fields[8]);
  console.log('Vacation row notes (field 14):', fields[14]);
} else {
  console.log('ERROR: Vacation employee row NOT found in SIF!');
  console.log('All data rows:');
  employeeRows.forEach((r, i) => console.log(`  [${i}] ${r}`));
  process.exit(1);
}

if (vacRow && parseFloat(vacRow.split(',')[8]) === 0.100) {
  console.log('\n✅ SUCCESS: Vacation employee gets 0.100 OMR in WPS SIF');
} else {
  console.log('\n❌ FAIL: Vacation employee net salary is not 0.100');
  process.exit(1);
}
