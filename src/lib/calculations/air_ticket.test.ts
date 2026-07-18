import { describe, it, expect } from 'vitest';
import { calculateAirTicketBalance } from './air_ticket';

describe('Air Ticket Calculations with 18-month cycle', () => {
  it('should accrue tickets correctly on an 18-month cycle', () => {
    // 18 months worked, 18-month cycle, 0 opening tickets
    // Accrued = (18 / 18) * 2 = 2.0 tickets
    const balance = calculateAirTicketBalance(
      '2024-01-01',
      '2025-07-01', // Exactly 18 months later (1.5 years)
      0,
      [],
      18
    );

    expect(balance.accrued).toBeCloseTo(2.0, 2);
    expect(balance.available).toBeCloseTo(2.0, 2);
  });

  it('should accrue tickets correctly for partial 18-month cycle', () => {
    // 9 months worked, 18-month cycle, 0 opening tickets
    // Accrued = (9 / 18) * 2 = 1.0 tickets
    const balance = calculateAirTicketBalance(
      '2024-01-01',
      '2024-10-01', // Exactly 9 months later
      0,
      [],
      18
    );

    expect(balance.accrued).toBeCloseTo(1.0, 2);
    expect(balance.available).toBeCloseTo(1.0, 2);
  });
});
