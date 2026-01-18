/**
 * CoordinateEngine - Timeline coordinate calculations
 *
 * Responsible for converting between:
 * - Dates and pixel positions (X-axis)
 * - Row indices and pixel positions (Y-axis)
 *
 * Also handles viewport calculations for occlusion culling.
 *
 * This is a pure calculation class with no DOM or D3 dependencies,
 * making it easily testable.
 */

import { DateService } from "./dateService";
import {
    DAY_WIDTHS,
    TimeScale,
    ZoomLevel,
    LAYOUT,
    OCCLUSION,
} from "../constants";

/**
 * Represents a visible range for occlusion culling.
 */
export interface VisibleRange {
    /** First visible Y pixel (top of viewport) */
    startY: number;
    /** Last visible Y pixel (bottom of viewport) */
    endY: number;
    /** First visible X pixel (left of viewport) */
    startX: number;
    /** Last visible X pixel (right of viewport) */
    endX: number;
}

/**
 * Represents a row's position and visibility.
 */
export interface RowBounds {
    /** Row index in the data array */
    index: number;
    /** Top Y position in pixels */
    y: number;
    /** Height in pixels */
    height: number;
    /** Whether this row is currently visible */
    isVisible: boolean;
}

/**
 * Configuration for the coordinate engine.
 */
export interface CoordinateConfig {
    /** Start date of the visible timeline */
    viewStart: Date;
    /** End date of the visible timeline */
    viewEnd: Date;
    /** Current time scale */
    timeScale: TimeScale;
    /** Current zoom level */
    zoomLevel: ZoomLevel;
    /** Width of the left panel */
    leftPanelWidth: number;
}

export class CoordinateEngine {
    private config: CoordinateConfig;
    private _dayWidth: number;
    private _totalDays: number;
    private _timelineWidth: number;

    constructor(config: CoordinateConfig) {
        this.config = config;
        this._dayWidth = this.calculateDayWidth();
        this._totalDays = DateService.daysBetween(config.viewStart, config.viewEnd);
        this._timelineWidth = this._totalDays * this._dayWidth;
    }

    /**
     * Get the calculated day width in pixels.
     */
    get dayWidth(): number {
        return this._dayWidth;
    }

    /**
     * Get the total number of days in the view.
     */
    get totalDays(): number {
        return this._totalDays;
    }

    /**
     * Get the total timeline width in pixels.
     */
    get timelineWidth(): number {
        return this._timelineWidth;
    }

    /**
     * Get the left panel width.
     */
    get leftPanelWidth(): number {
        return this.config.leftPanelWidth;
    }

    /**
     * Calculate day width based on time scale and zoom level.
     */
    private calculateDayWidth(): number {
        const baseWidth = DAY_WIDTHS[this.config.timeScale] || DAY_WIDTHS.monthly;
        return baseWidth * this.config.zoomLevel;
    }

    /**
     * Convert a date to an X pixel position.
     *
     * @param date - The date to convert
     * @returns X position in pixels from timeline start
     */
    dateToX(date: Date): number {
        return DateService.daysBetween(this.config.viewStart, date) * this._dayWidth;
    }

    /**
     * Convert an X pixel position to a date.
     *
     * @param x - The X position in pixels
     * @returns The corresponding date
     */
    xToDate(x: number): Date {
        const days = Math.floor(x / this._dayWidth);
        return DateService.addDays(this.config.viewStart, days);
    }

    /**
     * Calculate the X position and width for a bar (Epic/Feature).
     *
     * @param startDate - Bar start date
     * @param endDate - Bar end date
     * @returns Object with x position and width in pixels
     */
    getBarBounds(startDate: Date, endDate: Date): { x: number; width: number } {
        const startX = this.dateToX(startDate);
        const endX = this.dateToX(endDate);
        const width = Math.max(endX - startX + this._dayWidth, LAYOUT.MIN_BAR_WIDTH);
        return { x: startX, width };
    }

    /**
     * Calculate the X position for a milestone (point in time).
     *
     * @param date - Milestone date
     * @returns X position in pixels (center of the diamond)
     */
    getMilestoneX(date: Date): number {
        return this.dateToX(date);
    }

    /**
     * Check if a date is within the visible timeline range.
     *
     * @param date - The date to check
     * @returns true if the date is visible
     */
    isDateVisible(date: Date): boolean {
        return date >= this.config.viewStart && date <= this.config.viewEnd;
    }

    /**
     * Check if a date range overlaps with the visible timeline.
     *
     * @param startDate - Range start
     * @param endDate - Range end
     * @returns true if any part of the range is visible
     */
    isRangeVisible(startDate: Date | null, endDate: Date | null): boolean {
        if (!startDate && !endDate) return false;

        const start = startDate || endDate!;
        const end = endDate || startDate!;

        return start <= this.config.viewEnd && end >= this.config.viewStart;
    }

    /**
     * Calculate which rows are visible given the current scroll position.
     *
     * This is the core of occlusion culling - only render rows that are
     * in or near the viewport.
     *
     * @param rows - Array of row heights
     * @param scrollTop - Current vertical scroll position
     * @param viewportHeight - Height of the visible viewport
     * @param totalItems - Total number of items (for threshold check)
     * @returns Array of RowBounds with visibility flags
     */
    calculateVisibleRows(
        rows: Array<{ y: number; height: number }>,
        scrollTop: number,
        viewportHeight: number,
        totalItems: number
    ): RowBounds[] {
        // Skip culling for small datasets
        if (totalItems < OCCLUSION.ENABLE_THRESHOLD) {
            return rows.map((row, index) => ({
                index,
                y: row.y,
                height: row.height,
                isVisible: true,
            }));
        }

        const bufferPx = OCCLUSION.BUFFER_PX;
        const visibleStart = scrollTop - bufferPx;
        const visibleEnd = scrollTop + viewportHeight + bufferPx;

        let visibleCount = 0;
        const result = rows.map((row, index) => {
            const rowTop = row.y;
            const rowBottom = row.y + row.height;

            // Row is visible if it overlaps with the buffered viewport
            const isVisible = rowBottom >= visibleStart && rowTop <= visibleEnd;

            if (isVisible) visibleCount++;

            return {
                index,
                y: row.y,
                height: row.height,
                isVisible,
            };
        });

        // Ensure minimum visible items
        if (visibleCount < OCCLUSION.MIN_VISIBLE_ITEMS && rows.length >= OCCLUSION.MIN_VISIBLE_ITEMS) {
            // Find the closest rows to the viewport center and mark them visible
            const viewportCenter = scrollTop + viewportHeight / 2;
            const sortedByDistance = [...result]
                .sort((a, b) => {
                    const distA = Math.abs((a.y + a.height / 2) - viewportCenter);
                    const distB = Math.abs((b.y + b.height / 2) - viewportCenter);
                    return distA - distB;
                });

            for (let i = 0; i < OCCLUSION.MIN_VISIBLE_ITEMS && i < sortedByDistance.length; i++) {
                sortedByDistance[i].isVisible = true;
            }
        }

        return result;
    }

    /**
     * Calculate which horizontal range is visible (for timeline headers).
     *
     * @param scrollLeft - Current horizontal scroll position
     * @param viewportWidth - Width of the visible viewport
     * @returns VisibleRange with X bounds
     */
    calculateVisibleXRange(scrollLeft: number, viewportWidth: number): VisibleRange {
        const bufferPx = OCCLUSION.BUFFER_PX;

        return {
            startX: Math.max(0, scrollLeft - bufferPx),
            endX: Math.min(this._timelineWidth, scrollLeft + viewportWidth + bufferPx),
            startY: 0,
            endY: 0, // Y not used for horizontal culling
        };
    }

    /**
     * Check if an X range is visible in the viewport.
     *
     * @param startX - Start X position
     * @param endX - End X position
     * @param scrollLeft - Current scroll position
     * @param viewportWidth - Viewport width
     * @returns true if any part of the range is visible
     */
    isXRangeVisible(
        startX: number,
        endX: number,
        scrollLeft: number,
        viewportWidth: number
    ): boolean {
        const bufferPx = OCCLUSION.BUFFER_PX;
        const visibleStart = scrollLeft - bufferPx;
        const visibleEnd = scrollLeft + viewportWidth + bufferPx;

        return endX >= visibleStart && startX <= visibleEnd;
    }

    /**
     * Get the date at a specific day offset from viewStart.
     *
     * @param dayOffset - Number of days from viewStart
     * @returns The date at that offset
     */
    getDateAtOffset(dayOffset: number): Date {
        return DateService.addDays(this.config.viewStart, dayOffset);
    }

    /**
     * Iterate through each day in the timeline.
     * Yields day index and date for each day.
     *
     * @yields [dayIndex, date] tuples
     */
    *iterateDays(): Generator<[number, Date]> {
        for (let i = 0; i < this._totalDays; i++) {
            yield [i, this.getDateAtOffset(i)];
        }
    }

    /**
     * Update the configuration (e.g., when zoom changes).
     *
     * @param updates - Partial configuration updates
     */
    updateConfig(updates: Partial<CoordinateConfig>): void {
        this.config = { ...this.config, ...updates };
        this._dayWidth = this.calculateDayWidth();
        this._totalDays = DateService.daysBetween(this.config.viewStart, this.config.viewEnd);
        this._timelineWidth = this._totalDays * this._dayWidth;
    }

    /**
     * Create a snapshot of current configuration for debugging.
     */
    getDebugInfo(): Record<string, unknown> {
        return {
            viewStart: this.config.viewStart.toISOString(),
            viewEnd: this.config.viewEnd.toISOString(),
            timeScale: this.config.timeScale,
            zoomLevel: this.config.zoomLevel,
            dayWidth: this._dayWidth,
            totalDays: this._totalDays,
            timelineWidth: this._timelineWidth,
        };
    }
}
