/**
 * DateService - DST-safe date utilities for Australian timezone handling
 *
 * This service provides date arithmetic that correctly handles:
 * - Daylight Savings Time transitions (AEDT/AEST in NSW/VIC/ACT)
 * - Leap years
 * - Month boundary calculations
 *
 * All methods are pure functions with no side effects.
 *
 * IMPORTANT: Never use millisecond math directly (date + 86400000).
 * The setDate() approach handles DST transitions correctly.
 */

import { MS_PER_DAY } from "../constants";

export class DateService {
    /**
     * Add days to a date, handling DST transitions correctly.
     *
     * Uses Date.setDate() which correctly handles:
     * - DST spring forward (23-hour days in October)
     * - DST fall back (25-hour days in April)
     * - Month/year rollovers
     *
     * @param date - The starting date
     * @param days - Number of days to add (can be negative)
     * @returns A new Date object (original is not mutated)
     */
    static addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Calculate the number of days between two dates, DST-safe.
     *
     * Uses UTC normalization to avoid DST edge cases:
     * - Converts both dates to UTC midnight
     * - Calculates difference in that timezone-neutral space
     *
     * This ensures consistent day counts regardless of DST transitions.
     *
     * @param start - The start date
     * @param end - The end date
     * @returns Number of days (positive if end > start)
     */
    static daysBetween(start: Date, end: Date): number {
        const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
        const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
        return Math.ceil((endUtc - startUtc) / MS_PER_DAY);
    }

    /**
     * Parse a value into a Date, normalizing to midnight.
     *
     * Handles:
     * - Date objects (cloned)
     * - ISO strings
     * - Timestamps
     * - Power BI date values
     *
     * @param value - The value to parse
     * @returns Date normalized to midnight, or null if invalid
     */
    static parseDate(value: string | number | Date | null | undefined): Date | null {
        if (!value) return null;

        const date = new Date(value);

        // Normalize to midnight to avoid time-of-day issues
        date.setHours(0, 0, 0, 0);

        return isNaN(date.getTime()) ? null : date;
    }

    /**
     * Get ISO week number for a date.
     *
     * Uses the ISO 8601 definition:
     * - Week starts on Monday
     * - Week 1 contains the first Thursday of the year
     *
     * @param date - The date to get week number for
     * @returns Week number (1-53)
     */
    static getWeekNumber(date: Date): number {
        // Create UTC date to avoid timezone issues
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

        // Set to nearest Thursday: current date + 4 - current day number
        // (Sunday = 0, so we treat it as 7)
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);

        // Get first day of the year
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

        // Calculate week number
        return Math.ceil((((d.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7);
    }

    /**
     * Get the last day of a month.
     *
     * @param year - The year
     * @param month - The month (0-indexed, like JS Date)
     * @returns Date object for the last day of the month
     */
    static getMonthEnd(year: number, month: number): Date {
        // Day 0 of next month = last day of current month
        return new Date(year, month + 1, 0);
    }

    /**
     * Get the first day of a month.
     *
     * @param year - The year
     * @param month - The month (0-indexed)
     * @returns Date object for the first day of the month
     */
    static getMonthStart(year: number, month: number): Date {
        return new Date(year, month, 1);
    }

    /**
     * Get the quarter (1-4) for a date.
     *
     * @param date - The date
     * @returns Quarter number (1-4)
     */
    static getQuarter(date: Date): number {
        return Math.floor(date.getMonth() / 3) + 1;
    }

    /**
     * Get the start date of a quarter.
     *
     * @param year - The year
     * @param quarter - The quarter (1-4)
     * @returns Date object for the first day of the quarter
     */
    static getQuarterStart(year: number, quarter: number): Date {
        const month = (quarter - 1) * 3;
        return new Date(year, month, 1);
    }

    /**
     * Get the end date of a quarter.
     *
     * @param year - The year
     * @param quarter - The quarter (1-4)
     * @returns Date object for the last day of the quarter
     */
    static getQuarterEnd(year: number, quarter: number): Date {
        const month = quarter * 3;
        return new Date(year, month, 0);
    }

    /**
     * Check if a date is a weekend (Saturday or Sunday).
     *
     * @param date - The date to check
     * @returns true if Saturday or Sunday
     */
    static isWeekend(date: Date): boolean {
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    /**
     * Check if a date is Monday.
     *
     * @param date - The date to check
     * @returns true if Monday
     */
    static isMonday(date: Date): boolean {
        return date.getDay() === 1;
    }

    /**
     * Check if a date is the first day of its month.
     *
     * @param date - The date to check
     * @returns true if first of month
     */
    static isFirstOfMonth(date: Date): boolean {
        return date.getDate() === 1;
    }

    /**
     * Check if a date is the first day of its year.
     *
     * @param date - The date to check
     * @returns true if January 1st
     */
    static isFirstOfYear(date: Date): boolean {
        return date.getMonth() === 0 && date.getDate() === 1;
    }

    /**
     * Check if a date is the first day of a quarter.
     *
     * @param date - The date to check
     * @returns true if first day of Q1, Q2, Q3, or Q4
     */
    static isFirstOfQuarter(date: Date): boolean {
        return date.getDate() === 1 && date.getMonth() % 3 === 0;
    }

    /**
     * Get today's date normalized to midnight.
     *
     * @returns Today's date at 00:00:00.000
     */
    static today(): Date {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
    }

    /**
     * Format a date for Australian locale display.
     *
     * @param date - The date to format
     * @param options - Intl.DateTimeFormat options
     * @returns Formatted date string
     */
    static formatAU(date: Date, options: Intl.DateTimeFormatOptions): string {
        return date.toLocaleDateString("en-AU", options);
    }

    /**
     * Find the next Monday on or after a given date.
     *
     * @param date - The starting date
     * @returns The next Monday (or same date if already Monday)
     */
    static nextMonday(date: Date): Date {
        const result = new Date(date);
        const dayOfWeek = result.getDay();
        const daysToAdd = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
        result.setDate(result.getDate() + daysToAdd);
        return result;
    }

    /**
     * Clamp a date to be within a range.
     *
     * @param date - The date to clamp
     * @param min - Minimum date
     * @param max - Maximum date
     * @returns The clamped date
     */
    static clamp(date: Date, min: Date, max: Date): Date {
        if (date < min) return new Date(min);
        if (date > max) return new Date(max);
        return new Date(date);
    }
}
