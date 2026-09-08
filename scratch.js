const { differenceInDays, isBefore, isAfter, startOfDay } = require('date-fns');

// The new law cutoff is July 31, 2023.
// Wait, is it July 31 or July 25? The user said "New Labor Law Rules (July 31, 2023)". Let's use July 31, 2023.
const NEW_EOSB_CUTOFF = new Date('2023-07-31T00:00:00Z');

function calculateEOSB_new(input) {
  const joinDate = startOfDay(new Date(input.joinDate));
  const terminationDate = startOfDay(new Date(input.terminationDate));
  const cutoffDate = startOfDay(NEW_EOSB_CUTOFF);

  const lastBasicSalary = isNaN(Number(input.lastBasicSalary)) ? 0 : Number(input.lastBasicSalary);
  const dailyRate = lastBasicSalary / 30;

  // Case 1: Joined after cutoff
  if (!isBefore(joinDate, cutoffDate)) {
    const totalDays = differenceInDays(terminationDate, joinDate);
    const totalYears = totalDays / 365;
    return {
      oldLawGratuity: 0,
      newLawGratuity: totalYears * lastBasicSalary,
      totalGratuity: totalYears * lastBasicSalary,
      oldLawYears: 0,
      newLawYears: totalYears
    };
  }

  // Case 2: Terminated before cutoff
  if (!isAfter(terminationDate, cutoffDate)) {
    const totalDays = differenceInDays(terminationDate, joinDate);
    const totalYears = totalDays / 365;

    let gratuity = 0;
    if (totalYears <= 3) {
      gratuity = totalYears * 15 * dailyRate;
    } else {
      gratuity = (3 * 15 * dailyRate) + ((totalYears - 3) * 30 * dailyRate);
    }
    return {
      oldLawGratuity: gratuity,
      newLawGratuity: 0,
      totalGratuity: gratuity,
      oldLawYears: totalYears,
      newLawYears: 0
    }
  }

  // Case 3: Spans across cutoff
  // Old law period: join date up to cutoff date
  const oldLawDays = differenceInDays(cutoffDate, joinDate);
  const oldLawYears = oldLawDays / 365;

  let oldLawGratuity = 0;
  if (oldLawYears <= 3) {
    oldLawGratuity = oldLawYears * 15 * dailyRate;
  } else {
    oldLawGratuity = (3 * 15 * dailyRate) + ((oldLawYears - 3) * 30 * dailyRate);
  }

  // New law period: cutoff date to termination date
  const newLawDays = differenceInDays(terminationDate, cutoffDate);
  const newLawYears = newLawDays / 365;
  const newLawGratuity = newLawYears * lastBasicSalary;

  return {
    oldLawDays,
    newLawDays,
    oldLawYears,
    newLawYears,
    oldLawGratuity,
    newLawGratuity,
    totalGratuity: oldLawGratuity + newLawGratuity
  };
}

console.log(calculateEOSB_new({
  joinDate: '2022-09-15',
  terminationDate: '2026-09-13',
  lastBasicSalary: 80
}));
