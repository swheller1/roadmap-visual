/**
 * Centralized constants for the Roadmap Visual
 *
 * This file contains all "magic numbers" and configuration values
 * to ensure consistency and ease of maintenance.
 */

// Visual version for watermark
export const VISUAL_VERSION = "1.0.0.0";

// Work item types in hierarchy order
export const WORK_ITEM_TYPES = ["Epic", "Milestone", "Feature"] as const;
export type WorkItemType = typeof WORK_ITEM_TYPES[number];

// Layout constants
export const LAYOUT = {
    /** Width of the left panel containing work item names */
    LEFT_PANEL_WIDTH: 280,

    /** Pixels of indentation per hierarchy level */
    INDENT_PER_LEVEL: 16,

    /** Minimum width for a rendered bar (prevents invisible bars) */
    MIN_BAR_WIDTH: 30,

    /** Minimum width before showing bar label text */
    MIN_BAR_WIDTH_FOR_LABEL: 50,

    /** Base padding for rows */
    ROW_PADDING: 10,

    /** Margin around milestone labels */
    MILESTONE_LABEL_MARGIN: 6,
} as const;

// Logo size presets (in pixels)
export const LOGO_SIZES = {
    small: 24,
    medium: 32,
    large: 48,
} as const;
export type LogoSize = keyof typeof LOGO_SIZES;

// Row heights by density and type (in pixels)
export const ROW_HEIGHTS: Record<string, Record<string, number>> = {
    compact: {
        Epic: 32,
        Milestone: 28,
        Feature: 30,
        GroupHeader: 30
    },
    normal: {
        Epic: 48,
        Milestone: 40,
        Feature: 44,
        GroupHeader: 44
    },
    comfortable: {
        Epic: 56,
        Milestone: 48,
        Feature: 52,
        GroupHeader: 52
    },
};

// Bar heights by density and type (in pixels)
export const BAR_HEIGHTS: Record<string, Record<string, number>> = {
    compact: {
        Epic: 22,
        Milestone: 14,
        Feature: 20
    },
    normal: {
        Epic: 32,
        Milestone: 18,
        Feature: 28
    },
    comfortable: {
        Epic: 40,
        Milestone: 22,
        Feature: 36
    },
};

// Time scale configurations
export const TIME_SCALES = ["daily", "weekly", "monthly", "annual", "multiYear"] as const;
export type TimeScale = typeof TIME_SCALES[number];

// Base day widths for each time scale (pixels per day at zoom 1x)
export const DAY_WIDTHS: Record<TimeScale, number> = {
    daily: 24,
    weekly: 6,
    monthly: 2,
    annual: 0.5,
    multiYear: 0.15,
};

// Valid zoom levels
export const ZOOM_LEVELS = [0.5, 1, 2, 4] as const;
export type ZoomLevel = typeof ZOOM_LEVELS[number];

// Row density options
export const ROW_DENSITIES = ["compact", "normal", "comfortable"] as const;
export type RowDensity = typeof ROW_DENSITIES[number];

// Milestone label position options
export const MILESTONE_LABEL_POSITIONS = ["left", "right", "none"] as const;
export type MilestoneLabelPosition = typeof MILESTONE_LABEL_POSITIONS[number];

// Timeline padding (days before/after data range)
export const TIMELINE_PADDING = {
    /** Days of padding before the first work item */
    BEFORE: 14,
    /** Days of padding after the last work item */
    AFTER: 28,
    /** Default timeline span when no data (days) */
    DEFAULT_SPAN: 90,
} as const;

// Occlusion culling configuration
export const OCCLUSION = {
    /**
     * Buffer zone (in pixels) outside viewport to render.
     * Larger values = smoother scrolling but more DOM nodes.
     * For Power BI, we balance performance with UX.
     */
    BUFFER_PX: 200,

    /**
     * Minimum items to always render regardless of viewport.
     * Ensures small datasets render completely.
     */
    MIN_VISIBLE_ITEMS: 20,

    /**
     * Threshold for enabling occlusion culling.
     * Below this count, render all items.
     */
    ENABLE_THRESHOLD: 100,
} as const;

// Dependency line rendering
export const DEPENDENCY_LINES = {
    /** Stroke width for parent-child lines */
    PARENT_CHILD_WIDTH: 1.5,
    /** Stroke width for predecessor lines */
    PREDECESSOR_WIDTH: 2,
    /** Dash pattern for parent-child lines */
    PARENT_CHILD_DASH: "4,2",
    /** Opacity for parent-child lines */
    PARENT_CHILD_OPACITY: 0.6,
    /** Opacity for predecessor lines */
    PREDECESSOR_OPACITY: 0.8,
    /** Circle radius for connector dots */
    CONNECTOR_RADIUS: 3,
    /** Arrow size for predecessor arrows */
    ARROW_SIZE: 6,
} as const;

// Default colors
export const DEFAULT_COLORS = {
    epic: "#4F46E5",
    milestone: "#DC2626",
    feature: "#0891B2",
    dependencyLine: "#94A3B8",
} as const;

// Milliseconds per day (for date calculations - prefer DateService methods)
export const MS_PER_DAY = 86400000;
