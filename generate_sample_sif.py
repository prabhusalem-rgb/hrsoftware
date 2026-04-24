/**
 *演示: 如何使用现有 WPS 生成器创建符合格式的 SIF 文件
 * 基于样本文件 SIF_1046750_BMCT_20260312_001.xls 的结构
 *
 * 此脚本展示如何使用 generateWPSSIF() 函数生成正确的 SIF 文件
 */

// 这是你在 Next.js 项目中的用法示例
import { generateWPSSIF, generateWPSFileName } from '@/lib/calculations/wps';

// 1. 准备公司数据 (Company 类型)
const company = {
  cr_number: '1046750',
  bank_account: '0468065008020018', // 19 digits, preserves leading zero
  iban: '0468065008020018', // 或 bank_account
  name_en: 'Your Company Name',
  wps_mol_id: '1046750' // 可选，用于 filename
};

// 2. 准备员工数据 (Employee[] 类型)
const employees = [
  {
    id: 'emp-001',
    id_type: 'civil_id', // 'civil_id' or 'passport'
    civil_id: '75620501', // 8 digits
    passport_no: '',
    emp_code: '1',
    name_en: 'PINTU KUBER',
    bank_bic: 'BMUSOMRX',
    bank_iban: '0222012606280037', // Preserves leading zero
    status: 'active'
  },
  {
    id: 'emp-002',
    id_type: 'civil_id',
    civil_id: '09624797', // 8 digits (fixed from sample's 7-digit error)
    passport_no: '',
    emp_code: '2',
    name_en: 'MUNA',
    bank_bic: 'BMUSOMRX',
    bank_iban: '0371008156760017',
    status: 'active'
  }
];

// 3. 准备 payroll items (PayrollItem[] 类型)
const payrollItems = [
  {
    employee_id: 'emp-001',
    basic_salary: 49.000,
    housing_allowance: 0,
    transport_allowance: 0,
    food_allowance: 0,
    special_allowance: 0,
    site_allowance: 0,
    other_allowance: 0,
    overtime_hours: 0,
    overtime_pay: 0, // Extra Hours amount
    gross_salary: 49.000,
    absent_days: 0,
    absence_deduction: 0,
    leave_deduction: 0,
    loan_deduction: 0,
    other_deduction: 0,
    total_deductions: 0,
    social_security_deduction: 0,
    pasi_company_share: 0,
    net_salary: 49.000
  },
  {
    employee_id: 'emp-002',
    basic_salary: 0.100,
    housing_allowance: 0,
    transport_allowance: 0,
    food_allowance: 0,
    special_allowance: 0,
    site_allowance: 0,
    other_allowance: 0,
    overtime_hours: 0,
    overtime_pay: 0,
    gross_salary: 0.100,
    absent_days: 0,
    absence_deduction: 0,
    leave_deduction: 0,
    loan_deduction: 0,
    other_deduction: 0,
    total_deductions: 0,
    social_security_deduction: 0,
    pasi_company_share: 0,
    net_salary: 0.100
  }
];

// 4. 生成 SIF 内容
const year = 2026;
const month = 2; // February
const type = 'monthly' as const; // or 'leave_settlement', 'final_settlement'

const sifContent = generateWPSSIF(company, employees, payrollItems, year, month, type);

// 5. 生成 WPS 标准文件名 (已更新为 SIF_CR_BMCT_YYYYMMDD_XXX.csv 格式)
const fileName = generateWPSFileName(company.cr_number, 'BMCT', new Date(), 1);
// 示例: SIF_1046750_BMCT_20250404_001.csv

console.log('Generated filename:', fileName);
console.log('SIF Content:\n', sifContent);

// 在前端或后端下载:
// const blob = new Blob([sifContent], { type: 'text/csv' });
// const url = URL.createObjectURL(blob);
// const a = document.createElement('a');
// a.href = url;
// a.download = fileName;
// a.click();

/**
 * 重要说明:
 *
 * 1. 小数位数处理:
 *    - 货币字段 (Net, Basic, Extra Income, Deductions, SS): 自动格式化为 3 位小数
 *    - Extra Hours: 自动格式化为 2 位小数
 *    - 通过 formatOMR() 和 formatExtraHours() 实现
 *
 * 2. 账号格式:
 *    - 以 0 开头的账号会自动加引号保护,如 "0222012606280037"
 *    - 通过 `"${iban}"` 包裹实现
 *
 * 3. 员工姓名:
 *    - 自动转为大写: name_en.toUpperCase()
 *
 * 4. CR 匹配:
 *    - Payer_CR_No 自动等于 Employer_CR_No
 *
 * 5. 文件名格式:
 *    - SIF_CRNUMBER_BMCT_YYYYMMDD_XXX.csv
 *    - 例如: SIF_1046750_BMCT_20250404_001.csv
 *
 * 你的 generateWPSSIF() 函数已经完全符合 Bank Muscat 的格式要求!
 */
