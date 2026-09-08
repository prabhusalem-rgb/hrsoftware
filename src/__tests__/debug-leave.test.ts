import { calculateLeaveEncashmentValue } from '@/lib/calculations/leave';

describe('debug', () => {
  it('check leave encashment values', () => {
    const omaniEmployee = {
      nationality: 'OMANI',
      category: 'OMANI_INDIRECT_STAFF',
      gross_salary: 2000,
      basic_salary: 1500,
    };
    const nonOmaniEmployee = {
      nationality: 'PAKISTANI',
      category: 'INDIRECT_STAFF',
      gross_salary: 2000,
      basic_salary: 1500,
    };
    const directWorker = {
      nationality: 'OMANI',
      category: 'OMANI_DIRECT_STAFF',
      gross_salary: 2000,
      basic_salary: 1500,
    };
    console.log('Omani Indirect:', calculateLeaveEncashmentValue(omaniEmployee, 10));
    console.log('Non-Omani Indirect:', calculateLeaveEncashmentValue(nonOmaniEmployee, 10));
    console.log('Omani Direct:', calculateLeaveEncashmentValue(directWorker, 10));
  });
});
