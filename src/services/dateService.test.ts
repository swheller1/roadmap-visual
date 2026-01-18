/**
 * Unit Tests for DateService
 *
 * Tests DST-safe date arithmetic, parsing, formatting, and utility functions.
 * Critical for ensuring timeline accuracy across Australian timezone transitions.
 */

import { DateService } from './dateService';

describe('DateService', () => {
    // =========================================================================
    // addDays() - DST-safe day arithmetic
    // =========================================================================
    describe('addDays', () => {
        it('should add positive days correctly', () => {
            const start = new Date(2025, 0, 15); // Jan 15, 2025
            const result = DateService.addDays(start, 10);

            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(25);
        });

        it('should subtract days with negative value', () => {
            const start = new Date(2025, 0, 15);
            const result = DateService.addDays(start, -10);

            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(5);
        });

        it('should handle month boundary crossing', () => {
            const start = new Date(2025, 0, 28); // Jan 28
            const result = DateService.addDays(start, 7);

            expect(result.getMonth()).toBe(1); // February
            expect(result.getDate()).toBe(4);
        });

        it('should handle year boundary crossing', () => {
            const start = new Date(2024, 11, 28); // Dec 28, 2024
            const result = DateService.addDays(start, 7);

            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(0); // January
            expect(result.getDate()).toBe(4);
        });

        it('should handle leap year February correctly', () => {
            const start = new Date(2024, 1, 28); // Feb 28, 2024 (leap year)
            const result = DateService.addDays(start, 1);

            expect(result.getMonth()).toBe(1); // Still February
            expect(result.getDate()).toBe(29);
        });

        it('should handle non-leap year February correctly', () => {
            const start = new Date(2025, 1, 28); // Feb 28, 2025 (not leap year)
            const result = DateService.addDays(start, 1);

            expect(result.getMonth()).toBe(2); // March
            expect(result.getDate()).toBe(1);
        });

        it('should not mutate the original date', () => {
            const original = new Date(2025, 5, 15);
            const originalTime = original.getTime();

            DateService.addDays(original, 10);

            expect(original.getTime()).toBe(originalTime);
        });

        it('should return same day when adding 0 days', () => {
            const start = new Date(2025, 5, 15);
            const result = DateService.addDays(start, 0);

            expect(result.getDate()).toBe(15);
            expect(result.getMonth()).toBe(5);
        });

        // Australian DST transitions (AEDT/AEST)
        // DST starts: First Sunday of October (clocks forward, 23-hour day)
        // DST ends: First Sunday of April (clocks back, 25-hour day)
        it('should handle Australian DST spring forward (October)', () => {
            // Oct 5, 2025 is first Sunday of October (DST starts in AU)
            const beforeDST = new Date(2025, 9, 4); // Oct 4
            const result = DateService.addDays(beforeDST, 2);

            // Should still correctly advance by 2 calendar days
            expect(result.getDate()).toBe(6);
            expect(result.getMonth()).toBe(9);
        });

        it('should handle Australian DST fall back (April)', () => {
            // Apr 6, 2025 is first Sunday of April (DST ends in AU)
            const beforeDST = new Date(2025, 3, 5); // Apr 5
            const result = DateService.addDays(beforeDST, 2);

            // Should still correctly advance by 2 calendar days
            expect(result.getDate()).toBe(7);
            expect(result.getMonth()).toBe(3);
        });
    });

    // =========================================================================
    // daysBetween() - UTC-normalized day counting
    // =========================================================================
    describe('daysBetween', () => {
        it('should return 0 for same day', () => {
            const date = new Date(2025, 5, 15);
            expect(DateService.daysBetween(date, date)).toBe(0);
        });

        it('should return 1 for adjacent days', () => {
            const start = new Date(2025, 5, 15);
            const end = new Date(2025, 5, 16);
            expect(DateService.daysBetween(start, end)).toBe(1);
        });

        it('should return negative for reversed dates', () => {
            const start = new Date(2025, 5, 16);
            const end = new Date(2025, 5, 15);
            expect(DateService.daysBetween(start, end)).toBe(-1);
        });

        it('should handle month boundaries', () => {
            const start = new Date(2025, 0, 31); // Jan 31
            const end = new Date(2025, 1, 2); // Feb 2
            expect(DateService.daysBetween(start, end)).toBe(2);
        });

        it('should handle year boundaries', () => {
            const start = new Date(2024, 11, 31); // Dec 31, 2024
            const end = new Date(2025, 0, 1); // Jan 1, 2025
            expect(DateService.daysBetween(start, end)).toBe(1);
        });

        it('should handle leap year correctly', () => {
            const start = new Date(2024, 1, 28); // Feb 28, 2024
            const end = new Date(2024, 2, 1); // Mar 1, 2024
            expect(DateService.daysBetween(start, end)).toBe(2); // Feb 29 exists
        });

        it('should handle non-leap year correctly', () => {
            const start = new Date(2025, 1, 28); // Feb 28, 2025
            const end = new Date(2025, 2, 1); // Mar 1, 2025
            expect(DateService.daysBetween(start, end)).toBe(1); // No Feb 29
        });

        it('should handle full year span', () => {
            const start = new Date(2024, 0, 1);
            const end = new Date(2025, 0, 1);
            expect(DateService.daysBetween(start, end)).toBe(366); // 2024 is leap year
        });

        it('should be consistent across DST transition (October AU)', () => {
            // Week spanning DST start in October
            const start = new Date(2025, 9, 1); // Oct 1
            const end = new Date(2025, 9, 8); // Oct 8
            expect(DateService.daysBetween(start, end)).toBe(7);
        });

        it('should ignore time-of-day differences', () => {
            const start = new Date(2025, 5, 15, 8, 30); // 8:30 AM
            const end = new Date(2025, 5, 15, 22, 45); // 10:45 PM same day
            expect(DateService.daysBetween(start, end)).toBe(0);
        });
    });

    // =========================================================================
    // parseDate() - Flexible date parsing
    // =========================================================================
    describe('parseDate', () => {
        it('should return null for null input', () => {
            expect(DateService.parseDate(null)).toBeNull();
        });

        it('should return null for undefined input', () => {
            expect(DateService.parseDate(undefined)).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(DateService.parseDate('')).toBeNull();
        });

        it('should return null for invalid date string', () => {
            expect(DateService.parseDate('not-a-date')).toBeNull();
        });

        it('should parse Date object and clone it', () => {
            const original = new Date(2025, 5, 15, 14, 30);
            const result = DateService.parseDate(original);

            expect(result).not.toBeNull();
            expect(result!.getFullYear()).toBe(2025);
            expect(result!.getMonth()).toBe(5);
            expect(result!.getDate()).toBe(15);
            // Should be normalized to midnight
            expect(result!.getHours()).toBe(0);
            expect(result!.getMinutes()).toBe(0);
        });

        it('should parse ISO string', () => {
            const result = DateService.parseDate('2025-06-15T14:30:00.000Z');

            expect(result).not.toBeNull();
            // Note: exact date depends on local timezone
            expect(result!.getHours()).toBe(0); // Normalized to midnight
        });

        it('should parse timestamp number', () => {
            const timestamp = new Date(2025, 5, 15).getTime();
            const result = DateService.parseDate(timestamp);

            expect(result).not.toBeNull();
            expect(result!.getFullYear()).toBe(2025);
            expect(result!.getMonth()).toBe(5);
            expect(result!.getDate()).toBe(15);
        });

        it('should normalize to midnight', () => {
            const result = DateService.parseDate(new Date(2025, 5, 15, 23, 59, 59, 999));

            expect(result!.getHours()).toBe(0);
            expect(result!.getMinutes()).toBe(0);
            expect(result!.getSeconds()).toBe(0);
            expect(result!.getMilliseconds()).toBe(0);
        });

        it('should parse date-only string', () => {
            const result = DateService.parseDate('2025-06-15');

            expect(result).not.toBeNull();
            expect(result!.getFullYear()).toBe(2025);
        });
    });

    // =========================================================================
    // getWeekNumber() - ISO 8601 week numbers
    // =========================================================================
    describe('getWeekNumber', () => {
        it('should return week 1 for early January', () => {
            // Jan 6, 2025 is a Monday in week 2 (Jan 1 2025 is Wednesday)
            const date = new Date(2025, 0, 2); // Jan 2, 2025
            expect(DateService.getWeekNumber(date)).toBe(1);
        });

        it('should handle mid-year date', () => {
            const date = new Date(2025, 5, 15); // June 15, 2025
            const weekNum = DateService.getWeekNumber(date);
            expect(weekNum).toBeGreaterThan(20);
            expect(weekNum).toBeLessThan(30);
        });

        it('should return correct week for Dec 31 (may be week 1 of next year)', () => {
            // Dec 31, 2024 is a Tuesday
            const date = new Date(2024, 11, 31);
            const weekNum = DateService.getWeekNumber(date);
            // Could be week 1 of 2025 or week 52/53 of 2024 depending on ISO rules
            expect(weekNum).toBeGreaterThan(0);
            expect(weekNum).toBeLessThanOrEqual(53);
        });

        it('should handle week 53 year correctly', () => {
            // 2020 has 53 weeks (Dec 31, 2020 is Thursday)
            const date = new Date(2020, 11, 31);
            expect(DateService.getWeekNumber(date)).toBe(53);
        });

        it('should be consistent for same week', () => {
            // All days in the same week should return same week number
            const monday = new Date(2025, 5, 9); // Monday
            const friday = new Date(2025, 5, 13); // Friday same week
            const sunday = new Date(2025, 5, 15); // Sunday same week

            expect(DateService.getWeekNumber(monday)).toBe(DateService.getWeekNumber(friday));
            expect(DateService.getWeekNumber(friday)).toBe(DateService.getWeekNumber(sunday));
        });
    });

    // =========================================================================
    // getMonthStart() / getMonthEnd()
    // =========================================================================
    describe('getMonthStart', () => {
        it('should return first day of month', () => {
            const result = DateService.getMonthStart(2025, 5); // June 2025
            expect(result.getDate()).toBe(1);
            expect(result.getMonth()).toBe(5);
            expect(result.getFullYear()).toBe(2025);
        });
    });

    describe('getMonthEnd', () => {
        it('should return last day of 31-day month', () => {
            const result = DateService.getMonthEnd(2025, 0); // January
            expect(result.getDate()).toBe(31);
        });

        it('should return last day of 30-day month', () => {
            const result = DateService.getMonthEnd(2025, 3); // April
            expect(result.getDate()).toBe(30);
        });

        it('should return Feb 29 in leap year', () => {
            const result = DateService.getMonthEnd(2024, 1); // Feb 2024
            expect(result.getDate()).toBe(29);
        });

        it('should return Feb 28 in non-leap year', () => {
            const result = DateService.getMonthEnd(2025, 1); // Feb 2025
            expect(result.getDate()).toBe(28);
        });
    });

    // =========================================================================
    // Quarter functions
    // =========================================================================
    describe('getQuarter', () => {
        it('should return Q1 for Jan-Mar', () => {
            expect(DateService.getQuarter(new Date(2025, 0, 15))).toBe(1); // Jan
            expect(DateService.getQuarter(new Date(2025, 1, 15))).toBe(1); // Feb
            expect(DateService.getQuarter(new Date(2025, 2, 15))).toBe(1); // Mar
        });

        it('should return Q2 for Apr-Jun', () => {
            expect(DateService.getQuarter(new Date(2025, 3, 15))).toBe(2); // Apr
            expect(DateService.getQuarter(new Date(2025, 4, 15))).toBe(2); // May
            expect(DateService.getQuarter(new Date(2025, 5, 15))).toBe(2); // Jun
        });

        it('should return Q3 for Jul-Sep', () => {
            expect(DateService.getQuarter(new Date(2025, 6, 15))).toBe(3); // Jul
            expect(DateService.getQuarter(new Date(2025, 7, 15))).toBe(3); // Aug
            expect(DateService.getQuarter(new Date(2025, 8, 15))).toBe(3); // Sep
        });

        it('should return Q4 for Oct-Dec', () => {
            expect(DateService.getQuarter(new Date(2025, 9, 15))).toBe(4); // Oct
            expect(DateService.getQuarter(new Date(2025, 10, 15))).toBe(4); // Nov
            expect(DateService.getQuarter(new Date(2025, 11, 15))).toBe(4); // Dec
        });
    });

    describe('getQuarterStart', () => {
        it('should return Jan 1 for Q1', () => {
            const result = DateService.getQuarterStart(2025, 1);
            expect(result.getMonth()).toBe(0);
            expect(result.getDate()).toBe(1);
        });

        it('should return Apr 1 for Q2', () => {
            const result = DateService.getQuarterStart(2025, 2);
            expect(result.getMonth()).toBe(3);
            expect(result.getDate()).toBe(1);
        });

        it('should return Jul 1 for Q3', () => {
            const result = DateService.getQuarterStart(2025, 3);
            expect(result.getMonth()).toBe(6);
            expect(result.getDate()).toBe(1);
        });

        it('should return Oct 1 for Q4', () => {
            const result = DateService.getQuarterStart(2025, 4);
            expect(result.getMonth()).toBe(9);
            expect(result.getDate()).toBe(1);
        });
    });

    describe('getQuarterEnd', () => {
        it('should return Mar 31 for Q1', () => {
            const result = DateService.getQuarterEnd(2025, 1);
            expect(result.getMonth()).toBe(2);
            expect(result.getDate()).toBe(31);
        });

        it('should return Jun 30 for Q2', () => {
            const result = DateService.getQuarterEnd(2025, 2);
            expect(result.getMonth()).toBe(5);
            expect(result.getDate()).toBe(30);
        });

        it('should return Sep 30 for Q3', () => {
            const result = DateService.getQuarterEnd(2025, 3);
            expect(result.getMonth()).toBe(8);
            expect(result.getDate()).toBe(30);
        });

        it('should return Dec 31 for Q4', () => {
            const result = DateService.getQuarterEnd(2025, 4);
            expect(result.getMonth()).toBe(11);
            expect(result.getDate()).toBe(31);
        });
    });

    // =========================================================================
    // Day-of-week checks
    // =========================================================================
    describe('isWeekend', () => {
        it('should return true for Saturday', () => {
            const saturday = new Date(2025, 5, 14); // June 14, 2025 is Saturday
            expect(DateService.isWeekend(saturday)).toBe(true);
        });

        it('should return true for Sunday', () => {
            const sunday = new Date(2025, 5, 15); // June 15, 2025 is Sunday
            expect(DateService.isWeekend(sunday)).toBe(true);
        });

        it('should return false for weekdays', () => {
            const monday = new Date(2025, 5, 9);
            const wednesday = new Date(2025, 5, 11);
            const friday = new Date(2025, 5, 13);

            expect(DateService.isWeekend(monday)).toBe(false);
            expect(DateService.isWeekend(wednesday)).toBe(false);
            expect(DateService.isWeekend(friday)).toBe(false);
        });
    });

    describe('isMonday', () => {
        it('should return true for Monday', () => {
            const monday = new Date(2025, 5, 9); // June 9, 2025 is Monday
            expect(DateService.isMonday(monday)).toBe(true);
        });

        it('should return false for other days', () => {
            const tuesday = new Date(2025, 5, 10);
            const sunday = new Date(2025, 5, 8);

            expect(DateService.isMonday(tuesday)).toBe(false);
            expect(DateService.isMonday(sunday)).toBe(false);
        });
    });

    describe('isFirstOfMonth', () => {
        it('should return true for first of month', () => {
            expect(DateService.isFirstOfMonth(new Date(2025, 5, 1))).toBe(true);
        });

        it('should return false for other days', () => {
            expect(DateService.isFirstOfMonth(new Date(2025, 5, 2))).toBe(false);
            expect(DateService.isFirstOfMonth(new Date(2025, 5, 15))).toBe(false);
        });
    });

    describe('isFirstOfYear', () => {
        it('should return true for January 1', () => {
            expect(DateService.isFirstOfYear(new Date(2025, 0, 1))).toBe(true);
        });

        it('should return false for other days', () => {
            expect(DateService.isFirstOfYear(new Date(2025, 0, 2))).toBe(false);
            expect(DateService.isFirstOfYear(new Date(2025, 1, 1))).toBe(false);
        });
    });

    describe('isFirstOfQuarter', () => {
        it('should return true for first of Q1 (Jan 1)', () => {
            expect(DateService.isFirstOfQuarter(new Date(2025, 0, 1))).toBe(true);
        });

        it('should return true for first of Q2 (Apr 1)', () => {
            expect(DateService.isFirstOfQuarter(new Date(2025, 3, 1))).toBe(true);
        });

        it('should return true for first of Q3 (Jul 1)', () => {
            expect(DateService.isFirstOfQuarter(new Date(2025, 6, 1))).toBe(true);
        });

        it('should return true for first of Q4 (Oct 1)', () => {
            expect(DateService.isFirstOfQuarter(new Date(2025, 9, 1))).toBe(true);
        });

        it('should return false for non-quarter starts', () => {
            expect(DateService.isFirstOfQuarter(new Date(2025, 1, 1))).toBe(false); // Feb 1
            expect(DateService.isFirstOfQuarter(new Date(2025, 0, 2))).toBe(false); // Jan 2
        });
    });

    // =========================================================================
    // today()
    // =========================================================================
    describe('today', () => {
        it('should return current date', () => {
            const result = DateService.today();
            const now = new Date();

            expect(result.getFullYear()).toBe(now.getFullYear());
            expect(result.getMonth()).toBe(now.getMonth());
            expect(result.getDate()).toBe(now.getDate());
        });

        it('should be normalized to midnight', () => {
            const result = DateService.today();

            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(0);
            expect(result.getSeconds()).toBe(0);
            expect(result.getMilliseconds()).toBe(0);
        });
    });

    // =========================================================================
    // formatAU()
    // =========================================================================
    describe('formatAU', () => {
        it('should format date with short month', () => {
            const date = new Date(2025, 5, 15);
            const result = DateService.formatAU(date, { day: 'numeric', month: 'short', year: 'numeric' });

            // Australian format: "15 Jun 2025" or similar
            expect(result).toContain('15');
            expect(result).toContain('2025');
        });

        it('should format date with long month', () => {
            const date = new Date(2025, 5, 15);
            const result = DateService.formatAU(date, { day: 'numeric', month: 'long', year: 'numeric' });

            expect(result).toContain('June');
        });
    });

    // =========================================================================
    // nextMonday()
    // =========================================================================
    describe('nextMonday', () => {
        it('should return same day if already Monday', () => {
            const monday = new Date(2025, 5, 9); // June 9, 2025 is Monday
            const result = DateService.nextMonday(monday);

            expect(result.getDate()).toBe(9);
        });

        it('should return next Monday from Tuesday', () => {
            const tuesday = new Date(2025, 5, 10); // June 10, 2025 is Tuesday
            const result = DateService.nextMonday(tuesday);

            expect(result.getDate()).toBe(16); // Next Monday
        });

        it('should return next Monday from Sunday', () => {
            const sunday = new Date(2025, 5, 15); // June 15, 2025 is Sunday
            const result = DateService.nextMonday(sunday);

            expect(result.getDate()).toBe(16); // Next day is Monday
        });

        it('should return next Monday from Saturday', () => {
            const saturday = new Date(2025, 5, 14); // June 14, 2025 is Saturday
            const result = DateService.nextMonday(saturday);

            expect(result.getDate()).toBe(16); // Monday after
        });

        it('should not mutate original date', () => {
            const original = new Date(2025, 5, 10);
            const originalTime = original.getTime();

            DateService.nextMonday(original);

            expect(original.getTime()).toBe(originalTime);
        });
    });

    // =========================================================================
    // clamp()
    // =========================================================================
    describe('clamp', () => {
        it('should return date if within range', () => {
            const date = new Date(2025, 5, 15);
            const min = new Date(2025, 5, 1);
            const max = new Date(2025, 5, 30);

            const result = DateService.clamp(date, min, max);
            expect(result.getDate()).toBe(15);
        });

        it('should return min if date is before range', () => {
            const date = new Date(2025, 4, 15); // May 15
            const min = new Date(2025, 5, 1); // June 1
            const max = new Date(2025, 5, 30);

            const result = DateService.clamp(date, min, max);
            expect(result.getMonth()).toBe(5);
            expect(result.getDate()).toBe(1);
        });

        it('should return max if date is after range', () => {
            const date = new Date(2025, 6, 15); // July 15
            const min = new Date(2025, 5, 1);
            const max = new Date(2025, 5, 30); // June 30

            const result = DateService.clamp(date, min, max);
            expect(result.getMonth()).toBe(5);
            expect(result.getDate()).toBe(30);
        });

        it('should return new Date object (not mutate inputs)', () => {
            const date = new Date(2025, 5, 15);
            const min = new Date(2025, 5, 1);
            const max = new Date(2025, 5, 30);

            const result = DateService.clamp(date, min, max);

            expect(result).not.toBe(date);
            expect(result).not.toBe(min);
            expect(result).not.toBe(max);
        });
    });
});
