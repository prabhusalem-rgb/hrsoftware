import { calculateEOSB } from '@/lib/calculations/eosb';

describe('EOSB Debug', () => {
  it('check values', () => {
    const result = calculateEOSB({ joinDate: '2020-01-01', terminationDate: '2023-01-01', lastBasicSalary: 1000 });
    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result.totalGratuity).toBeGreaterThan(0);
  });
});
