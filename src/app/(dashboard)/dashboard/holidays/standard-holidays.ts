export interface StandardHolidayTemplate {
  name: string;
  date: string;
  holiday_type: 'public' | 'company' | 'restricted';
  is_paid: boolean;
  description?: string;
}

export const STANDARD_HOLIDAYS_BY_YEAR: Record<number, StandardHolidayTemplate[]> = {
  2025: [
    { name: "New Year's Day", date: '2025-01-01', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 1)', date: '2025-03-30', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 2)', date: '2025-03-31', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 3)', date: '2025-04-01', holiday_type: 'public', is_paid: true },
    { name: 'Arafat Day', date: '2025-06-05', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 1)', date: '2025-06-06', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 2)', date: '2025-06-07', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 3)', date: '2025-06-08', holiday_type: 'public', is_paid: true },
    { name: 'Islamic New Year (Hijri)', date: '2025-06-26', holiday_type: 'public', is_paid: true },
    { name: "Prophet Muhammad's Birthday (Mawlid)", date: '2025-09-04', holiday_type: 'public', is_paid: true },
    { name: 'Commemoration Day (Martyrs)', date: '2025-12-01', holiday_type: 'public', is_paid: true },
    { name: 'UAE National Day (Day 1)', date: '2025-12-02', holiday_type: 'public', is_paid: true },
    { name: 'UAE National Day (Day 2)', date: '2025-12-03', holiday_type: 'public', is_paid: true },
  ],
  2026: [
    { name: "New Year's Day", date: '2026-01-01', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 1)', date: '2026-03-20', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 2)', date: '2026-03-21', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 3)', date: '2026-03-22', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 4)', date: '2026-03-23', holiday_type: 'public', is_paid: true },
    { name: 'Arafat Day', date: '2026-05-26', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 1)', date: '2026-05-27', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 2)', date: '2026-05-28', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 3)', date: '2026-05-29', holiday_type: 'public', is_paid: true },
    { name: 'Islamic New Year (Hijri)', date: '2026-06-16', holiday_type: 'public', is_paid: true },
    { name: "Prophet Muhammad's Birthday", date: '2026-08-25', holiday_type: 'public', is_paid: true },
    { name: 'Commemoration Day (Martyrs)', date: '2026-12-01', holiday_type: 'public', is_paid: true },
    { name: 'UAE National Day (Day 1)', date: '2026-12-02', holiday_type: 'public', is_paid: true },
    { name: 'UAE National Day (Day 2)', date: '2026-12-03', holiday_type: 'public', is_paid: true },
  ],
  2027: [
    { name: "New Year's Day", date: '2027-01-01', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 1)', date: '2027-03-10', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 2)', date: '2027-03-11', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 3)', date: '2027-03-12', holiday_type: 'public', is_paid: true },
    { name: 'Arafat Day', date: '2027-05-16', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 1)', date: '2027-05-17', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 2)', date: '2027-05-18', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 3)', date: '2027-05-19', holiday_type: 'public', is_paid: true },
    { name: 'Islamic New Year (Hijri)', date: '2027-06-06', holiday_type: 'public', is_paid: true },
    { name: "Prophet Muhammad's Birthday", date: '2027-08-15', holiday_type: 'public', is_paid: true },
    { name: 'Commemoration Day', date: '2027-12-01', holiday_type: 'public', is_paid: true },
    { name: 'UAE National Day (Day 1)', date: '2027-12-02', holiday_type: 'public', is_paid: true },
    { name: 'UAE National Day (Day 2)', date: '2027-12-03', holiday_type: 'public', is_paid: true },
  ],
  2028: [
    { name: "New Year's Day", date: '2028-01-01', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 1)', date: '2028-02-27', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 2)', date: '2028-02-28', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Fitr (Day 3)', date: '2028-02-29', holiday_type: 'public', is_paid: true },
    { name: 'Arafat Day', date: '2028-05-04', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 1)', date: '2028-05-05', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 2)', date: '2028-05-06', holiday_type: 'public', is_paid: true },
    { name: 'Eid Al Adha (Day 3)', date: '2028-05-07', holiday_type: 'public', is_paid: true },
    { name: 'Islamic New Year (Hijri)', date: '2028-05-25', holiday_type: 'public', is_paid: true },
    { name: "Prophet Muhammad's Birthday", date: '2028-08-03', holiday_type: 'public', is_paid: true },
    { name: 'Commemoration Day', date: '2028-12-01', holiday_type: 'public', is_paid: true },
    { name: 'UAE National Day (Day 1)', date: '2028-12-02', holiday_type: 'public', is_paid: true },
    { name: 'UAE National Day (Day 2)', date: '2028-12-03', holiday_type: 'public', is_paid: true },
  ],
};

