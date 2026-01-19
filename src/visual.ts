/*
 *  Roadmap Visual for Power BI
 *  Certification-compliant version
 *
 *  Features:
 *  - Rendering Events API (required for certification)
 *  - Context Menu support
 *  - Safe DOM manipulation (no innerHTML)
 *  - Localization ready
 *  - No external service calls
 *  - Dependency line rendering
 *  - Flexible grouping options
 *  - PDF export with PSPF security classification
 */

"use strict";

import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;

import * as d3 from "d3";

import "./../style/visual.less";

// Import extracted modules
import { DateService } from "./services/dateService";
import { CoordinateEngine, RowBounds } from "./services/coordinateEngine";
import {
    VISUAL_VERSION,
    WORK_ITEM_TYPES,
    LAYOUT,
    LOGO_SIZES,
    ROW_HEIGHTS,
    BAR_HEIGHTS,
    DAY_WIDTHS,
    TIME_SCALES,
    ZOOM_LEVELS,
    ROW_DENSITIES,
    MILESTONE_LABEL_POSITIONS,
    TIMELINE_PADDING,
    OCCLUSION,
    DEPENDENCY_LINES,
    DEFAULT_COLORS,
    TimeScale,
    RowDensity,
    MilestoneLabelPosition,
    LogoSize,
} from "./constants";

// Interfaces
interface WorkItem {
    id: string;
    workItemId: number;
    title: string;
    type: string;
    state: string;
    startDate: Date | null;
    targetDate: Date | null;
    parentId: string | null;
    predecessorId: string | null;
    areaPath: string;
    iterationPath: string;
    assignedTo: string;
    priority: number;
    tags: string;
    selectionId: ISelectionId | null;
}

interface VisualSettings {
    title: string;
    subtitle: string;
    rowDensity: "compact" | "normal" | "comfortable";
    enableDragPan: boolean;
    // Logo settings
    logoUrl: string;
    logoSize: "small" | "medium" | "large";
    showLogo: boolean;
    // Organization settings
    groupBy: string;
    showHierarchy: boolean;
    defaultExpanded: boolean;
    // Colors
    epicColor: string;
    milestoneColor: string;
    featureColor: string;
    isHighContrast: boolean;
    // Milestone settings
    milestoneLabelPosition: "left" | "right" | "none";
    milestoneShowDate: boolean;
    // Dependencies
    showDependencies: boolean;
    showParentChild: boolean;
    showPredecessors: boolean;
    dependencyLineColor: string;
    // Level display settings
    showEpics: boolean;
    showFeatures: boolean;
    showMilestones: boolean;
    // Time scale settings
    timeScale: "daily" | "weekly" | "monthly" | "annual" | "multiYear";
    zoomLevel: number;
    // Print-friendly mode (expands all items for browser print-to-PDF)
    pdfMode: boolean;
}

interface RowData {
    type: string;
    data?: WorkItem;
    name?: string;
    y: number;
    height: number;
    collapsed?: boolean;
    isParent?: boolean;
    childCount?: number;
    level?: number;
}

// Local alias for backward compatibility
const TYPES = [...WORK_ITEM_TYPES];

export class RoadmapVisual implements IVisual {
    private host: IVisualHost;
    private container: d3.Selection<HTMLDivElement, unknown, null, undefined>;
    private workItems: WorkItem[] = [];
    private settings: VisualSettings;
    private collapsed: Set<string> = new Set();
    private viewStart: Date = new Date();
    private viewEnd: Date = new Date();
    private selectionManager: ISelectionManager;
    private rowPositions: Map<string, { y: number; height: number }> = new Map();

    // Coordinate engine for timeline calculations
    private coordinateEngine: CoordinateEngine | null = null;

    // Occlusion culling state
    private currentScrollTop: number = 0;
    private currentScrollLeft: number = 0;
    private viewportHeight: number = 0;
    private viewportWidth: number = 0;
    private allRows: RowData[] = [];
    private renderedRowIds: Set<string> = new Set();

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();

        // Register context menu handler
        this.selectionManager.registerOnSelectCallback(() => {
            // Handle selection changes
        });

        this.container = d3.select(options.element)
            .append("div")
            .classed("roadmap-container", true);

        // Set up context menu on container
        this.container.on("contextmenu", (event: MouseEvent) => {
            event.preventDefault();
            this.selectionManager.showContextMenu(
                {},
                { x: event.clientX, y: event.clientY }
            );
        });

        this.settings = {
            title: "Roadmap",
            subtitle: "Work Items",
            rowDensity: "normal",
            enableDragPan: true,
            logoUrl: "",
            logoSize: "medium",
            showLogo: true,
            groupBy: "epic",
            showHierarchy: true,
            defaultExpanded: true,
            epicColor: DEFAULT_COLORS.epic,
            milestoneColor: DEFAULT_COLORS.milestone,
            featureColor: DEFAULT_COLORS.feature,
            isHighContrast: false,
            milestoneLabelPosition: "right",
            milestoneShowDate: false,
            showDependencies: false,
            showParentChild: true,
            showPredecessors: true,
            dependencyLineColor: DEFAULT_COLORS.dependencyLine,
            showEpics: true,
            showFeatures: true,
            showMilestones: true,
            timeScale: "monthly",
            zoomLevel: 1,
            pdfMode: false
        };
    }

    public update(options: VisualUpdateOptions): void {
        // Signal render started - REQUIRED FOR CERTIFICATION
        this.host.eventService.renderingStarted(options);

        try {
            // Clear previous content
            this.container.selectAll("*").remove();
            this.rowPositions.clear();

            // Validate data
            if (!options.dataViews || !options.dataViews[0]) {
                this.renderEmptyState("No data available");
                this.host.eventService.renderingFinished(options);
                return;
            }

            const dataView = options.dataViews[0];

            // Parse data and settings
            this.parseData(dataView);
            this.parseSettings(dataView);

            // Apply high contrast mode class
            this.container.classed("high-contrast", this.settings.isHighContrast);

            if (this.workItems.length === 0) {
                this.renderEmptyState("Add data fields to display the roadmap");
                this.host.eventService.renderingFinished(options);
                return;
            }

            // Calculate timeline bounds
            const dates = this.workItems.flatMap(w =>
                [w.startDate, w.targetDate].filter((d): d is Date => d !== null)
            );

            const minDate = dates.length > 0
                ? new Date(Math.min(...dates.map(d => d.getTime())))
                : new Date();
            const maxDate = dates.length > 0
                ? new Date(Math.max(...dates.map(d => d.getTime())))
                : DateService.addDays(new Date(), TIMELINE_PADDING.DEFAULT_SPAN);

            this.viewStart = DateService.addDays(minDate, -TIMELINE_PADDING.BEFORE);
            this.viewEnd = DateService.addDays(maxDate, TIMELINE_PADDING.AFTER);

            // Initialize coordinate engine
            this.coordinateEngine = new CoordinateEngine({
                viewStart: this.viewStart,
                viewEnd: this.viewEnd,
                timeScale: this.settings.timeScale as TimeScale,
                zoomLevel: this.settings.zoomLevel as 0.5 | 1 | 2 | 4,
                leftPanelWidth: LAYOUT.LEFT_PANEL_WIDTH,
            });

            // Store viewport dimensions for occlusion culling
            this.viewportHeight = options.viewport.height;
            this.viewportWidth = options.viewport.width;

            // Render visual
            this.render(options.viewport.width, options.viewport.height, this.viewEnd);

            // Signal render finished - REQUIRED FOR CERTIFICATION
            this.host.eventService.renderingFinished(options);

        } catch (error) {
            // Signal render failed - REQUIRED FOR CERTIFICATION
            this.host.eventService.renderingFailed(options, error instanceof Error ? error.message : String(error));
        }
    }

    private parseData(dataView: DataView): void {
        this.workItems = [];

        const categorical = dataView.categorical;
        if (!categorical || !categorical.categories || categorical.categories.length === 0) {
            return;
        }

        const categories = categorical.categories;
        const getColumn = (name: string) =>
            categories.find(c => c.source.roles && c.source.roles[name]);

        const idCol = getColumn("workItemId");
        const titleCol = getColumn("title");
        const typeCol = getColumn("workItemType");
        const stateCol = getColumn("state");
        const startCol = getColumn("startDate");
        const targetCol = getColumn("targetDate");
        const parentCol = getColumn("parentId");
        const predecessorCol = getColumn("predecessorId");
        const areaCol = getColumn("areaPath");
        const iterCol = getColumn("iterationPath");
        const assignCol = getColumn("assignedTo");
        const prioCol = getColumn("priority");
        const tagsCol = getColumn("tags");

        if (!idCol || !titleCol || !typeCol) {
            return;
        }

        const rowCount = idCol.values.length;

        for (let i = 0; i < rowCount; i++) {
            const workItemId = Number(idCol.values[i]) || 0;
            const type = this.sanitizeString(String(typeCol.values[i] || "Feature"));
            const parentVal = parentCol?.values[i];
            const predecessorVal = predecessorCol?.values[i];

            // Create selection ID for interactivity
            const selectionId = this.host.createSelectionIdBuilder()
                .withCategory(idCol, i)
                .createSelectionId();

            this.workItems.push({
                id: `${type.charAt(0)}-${workItemId}`,
                workItemId,
                title: this.sanitizeString(String(titleCol.values[i] || "")),
                type,
                state: this.sanitizeString(String(stateCol?.values[i] || "New")),
                startDate: DateService.parseDate(startCol?.values[i] as string | number | Date | null | undefined),
                targetDate: DateService.parseDate(targetCol?.values[i] as string | number | Date | null | undefined),
                parentId: parentVal ? `E-${parentVal}` : null,
                predecessorId: predecessorVal ? String(predecessorVal) : null,
                areaPath: this.sanitizeString(String(areaCol?.values[i] || "")),
                iterationPath: this.sanitizeString(String(iterCol?.values[i] || "")),
                assignedTo: this.sanitizeString(String(assignCol?.values[i] || "")),
                priority: Number(prioCol?.values[i]) || 0,
                tags: this.sanitizeString(String(tagsCol?.values[i] || "")),
                selectionId
            });
        }
    }

    private parseSettings(dataView: DataView): void {
        const objects = dataView.metadata?.objects;
        if (!objects) return;

        // Display settings (View Scale, Row Density, Zoom, Drag Pan)
        if (objects.display) {
            const scale = String(objects.display.viewScale || "monthly");
            if ((TIME_SCALES as readonly string[]).includes(scale)) {
                this.settings.timeScale = scale as TimeScale;
            }
            const density = String(objects.display.rowDensity || "normal");
            if ((ROW_DENSITIES as readonly string[]).includes(density)) {
                this.settings.rowDensity = density as RowDensity;
            }
            const zoom = parseFloat(String(objects.display.zoomLevel || "1"));
            if ((ZOOM_LEVELS as readonly number[]).includes(zoom)) {
                this.settings.zoomLevel = zoom;
            }
            this.settings.enableDragPan = objects.display.enableDragPan !== false;
        }
        // Title & Subtitle
        if (objects.general) {
            this.settings.title = this.sanitizeString(String(objects.general.title || this.settings.title));
            this.settings.subtitle = this.sanitizeString(String(objects.general.subtitle || this.settings.subtitle));
        }
        // Logo settings
        if (objects.logo) {
            this.settings.logoUrl = this.sanitizeUrl(String(objects.logo.imageUrl || ""));
            const size = String(objects.logo.size || "medium");
            if (size in LOGO_SIZES) {
                this.settings.logoSize = size as LogoSize;
            }
            this.settings.showLogo = objects.logo.show !== false;
        }
        // Work Item Colors
        if (objects.workItemColors) {
            const getColor = (obj: unknown): string | undefined => {
                const colorObj = obj as { solid?: { color?: string } };
                return colorObj?.solid?.color;
            };
            this.settings.epicColor = getColor(objects.workItemColors.epicColor) || this.settings.epicColor;
            this.settings.milestoneColor = getColor(objects.workItemColors.milestoneColor) || this.settings.milestoneColor;
            this.settings.featureColor = getColor(objects.workItemColors.featureColor) || this.settings.featureColor;
            this.settings.isHighContrast = Boolean(objects.workItemColors.isHighContrast);
        }
        // Milestone settings
        if (objects.milestones) {
            const labelPos = String(objects.milestones.labelPosition || "right");
            if ((MILESTONE_LABEL_POSITIONS as readonly string[]).includes(labelPos)) {
                this.settings.milestoneLabelPosition = labelPos as MilestoneLabelPosition;
            }
            this.settings.milestoneShowDate = Boolean(objects.milestones.showDate);
        }
        // Organization settings
        if (objects.organization) {
            this.settings.groupBy = this.sanitizeString(String(objects.organization.groupBy || "epic"));
            this.settings.showHierarchy = objects.organization.showHierarchy !== false;
            this.settings.defaultExpanded = objects.organization.defaultExpanded !== false;
        }
        // Visible Levels
        if (objects.levels) {
            this.settings.showEpics = objects.levels.showEpics !== false;
            this.settings.showFeatures = objects.levels.showFeatures !== false;
            this.settings.showMilestones = objects.levels.showMilestones !== false;
        }
        // Dependencies
        if (objects.dependencies) {
            this.settings.showDependencies = Boolean(objects.dependencies.show);
            this.settings.showParentChild = objects.dependencies.showParentChild !== false;
            this.settings.showPredecessors = objects.dependencies.showPredecessors !== false;
            const lineColor = (objects.dependencies.lineColor as { solid?: { color?: string } })?.solid?.color;
            if (lineColor) this.settings.dependencyLineColor = lineColor;
        }
        // Export settings (print-friendly mode)
        if (objects.export) {
            this.settings.pdfMode = Boolean(objects.export.pdfMode);
        }
    }

    private render(width: number, height: number, viewEnd: Date): void {
        // Use coordinate engine for calculations
        if (!this.coordinateEngine) {
            this.coordinateEngine = new CoordinateEngine({
                viewStart: this.viewStart,
                viewEnd,
                timeScale: this.settings.timeScale as TimeScale,
                zoomLevel: this.settings.zoomLevel as 0.5 | 1 | 2 | 4,
                leftPanelWidth: LAYOUT.LEFT_PANEL_WIDTH,
            });
        }

        const dayWidth = this.coordinateEngine.dayWidth;
        const totalDays = this.coordinateEngine.totalDays;
        const timelineWidth = this.coordinateEngine.timelineWidth;
        const leftPanelWidth = LAYOUT.LEFT_PANEL_WIDTH;

        // In PDF mode, expand all items
        if (this.settings.pdfMode) {
            this.collapsed.clear();
        }

        const rows = this.buildRows();
        const totalHeight = rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0;

        // Header with ARIA landmark
        const header = this.container.append("div")
            .classed("header", true)
            .attr("role", "banner");

        // Add logo if URL is provided and show is enabled
        if (this.settings.showLogo && this.settings.logoUrl) {
            const logoSize = LOGO_SIZES[this.settings.logoSize] || LOGO_SIZES.medium;
            header.append("img")
                .classed("header-logo", true)
                .attr("src", this.settings.logoUrl)
                .attr("alt", "Logo")
                .style("width", `${logoSize}px`)
                .style("height", `${logoSize}px`)
                .on("error", function() {
                    // Hide the image if it fails to load
                    d3.select(this).style("display", "none");
                });
        }

        const headerText = header.append("div").classed("header-text", true);
        headerText.append("div").classed("title", true).text(this.settings.title);
        headerText.append("div").classed("subtitle", true).text(this.settings.subtitle);

        // Main container with ARIA landmark - add pdf-mode class for print optimization
        const main = this.container.append("div")
            .classed("main", true)
            .classed("pdf-mode", this.settings.pdfMode)
            .attr("role", "main")
            .attr("aria-label", "Roadmap timeline visualization");

        // Left panel with ARIA navigation landmark
        const left = main.append("div")
            .classed("left-panel", true)
            .style("width", `${leftPanelWidth}px`)
            .attr("role", "navigation")
            .attr("aria-label", "Work items list");
        left.append("div").classed("left-header", true).attr("id", "work-items-heading").text("WORK ITEMS");
        const leftBody = left.append("div")
            .classed("left-body", true)
            .attr("aria-labelledby", "work-items-heading");

        // In PDF mode, show all content without scroll
        if (this.settings.pdfMode) {
            leftBody.style("overflow", "visible").style("height", "auto");
        }

        // Timeline panel with ARIA region
        const timeline = main.append("div")
            .classed("timeline-panel", true)
            .attr("role", "region")
            .attr("aria-label", "Timeline with work item bars and milestones");
        const timelineHeaderWrapper = timeline.append("div").classed("timeline-header-wrapper", true);
        const timelineHeader = timelineHeaderWrapper.append("div").classed("timeline-header", true).style("width", `${timelineWidth}px`);
        const timelineBody = timeline.append("div").classed("timeline-body", true);

        // In PDF mode, show all content without scroll
        if (this.settings.pdfMode) {
            timelineBody.style("overflow", "visible").style("height", "auto");
            timelineHeaderWrapper.style("overflow", "visible");
        }

        const timelineInner = timelineBody.append("div").classed("timeline-inner", true)
            .style("width", `${timelineWidth}px`)
            .style("height", `${totalHeight}px`);

        // Render headers based on time scale
        this.renderTimeHeaders(timelineHeader, viewEnd, dayWidth);
        this.renderGrid(timelineInner, totalDays, dayWidth, viewEnd);
        this.renderTodayLine(timelineInner, viewEnd, dayWidth);

        // Store all rows for occlusion culling
        this.allRows = rows;
        this.renderedRowIds.clear();

        // Calculate which rows are visible (occlusion culling)
        const shouldCull = rows.length >= OCCLUSION.ENABLE_THRESHOLD && !this.settings.pdfMode;
        const visibleRowBounds = shouldCull
            ? this.coordinateEngine!.calculateVisibleRows(
                rows.map(r => ({ y: r.y, height: r.height })),
                this.currentScrollTop,
                height - 100, // Approximate viewport height (minus header)
                rows.length
            )
            : rows.map((_, i) => ({ index: i, y: rows[i].y, height: rows[i].height, isVisible: true }));

        // Render only visible rows (or all if below threshold)
        visibleRowBounds.forEach(bounds => {
            if (bounds.isVisible) {
                const row = rows[bounds.index];
                this.renderLeftRow(leftBody, row);
                this.renderTimelineRow(timelineInner, row, dayWidth);
                if (row.data) {
                    this.rowPositions.set(row.data.id, { y: row.y, height: row.height });
                    this.renderedRowIds.add(row.data.id);
                }
            }
        });

        // Log culling stats in debug mode (commented out for production)
        // console.log(`Occlusion culling: ${visibleRowBounds.filter(b => b.isVisible).length}/${rows.length} rows rendered`);

        // Render dependency lines if enabled
        if (this.settings.showDependencies) {
            this.renderDependencyLines(timelineInner, rows, dayWidth);
        }

        // Add version watermark (bottom right corner)
        this.container.append("div")
            .classed("version-watermark", true)
            .text(`Roadmap Visual v${VISUAL_VERSION}`);

        // Sync scroll (disabled in PDF mode)
        if (!this.settings.pdfMode) {
            const leftBodyNode = leftBody.node();
            const timelineBodyNode = timelineBody.node();
            const timelineHeaderWrapperNode = timelineHeaderWrapper.node();
            if (leftBodyNode && timelineBodyNode && timelineHeaderWrapperNode) {
                // Track scroll position for occlusion culling
                const updateScrollPosition = () => {
                    this.currentScrollTop = timelineBodyNode.scrollTop;
                    this.currentScrollLeft = timelineBodyNode.scrollLeft;
                };

                leftBody.on("scroll", () => {
                    timelineBodyNode.scrollTop = leftBodyNode.scrollTop;
                    updateScrollPosition();
                });
                timelineBody.on("scroll", () => {
                    leftBodyNode.scrollTop = timelineBodyNode.scrollTop;
                    timelineHeaderWrapperNode.scrollLeft = timelineBodyNode.scrollLeft;
                    updateScrollPosition();
                });

                // Drag-to-pan functionality
                if (this.settings.enableDragPan) {
                    let isDragging = false;
                    let startX = 0;
                    let startY = 0;
                    let scrollLeft = 0;
                    let scrollTop = 0;

                    timelineBody
                        .style("cursor", "grab")
                        .on("mousedown", (event: MouseEvent) => {
                            // Only start drag on left mouse button and not on interactive elements
                            if (event.button !== 0) return;
                            const target = event.target as HTMLElement;
                            if (target.closest(".bar, .milestone, .milestone-container")) return;

                            isDragging = true;
                            startX = event.pageX;
                            startY = event.pageY;
                            scrollLeft = timelineBodyNode.scrollLeft;
                            scrollTop = timelineBodyNode.scrollTop;
                            timelineBody.style("cursor", "grabbing");
                            event.preventDefault();
                        });

                    // Use d3.select on window for move/up to capture events outside the element
                    d3.select(window)
                        .on("mousemove.dragpan", (event: MouseEvent) => {
                            if (!isDragging) return;
                            const dx = event.pageX - startX;
                            const dy = event.pageY - startY;
                            timelineBodyNode.scrollLeft = scrollLeft - dx;
                            timelineBodyNode.scrollTop = scrollTop - dy;
                        })
                        .on("mouseup.dragpan", () => {
                            if (isDragging) {
                                isDragging = false;
                                timelineBody.style("cursor", "grab");
                            }
                        });
                }
            }
        }
    }

    private calculateDayWidth(): number {
        // Use constants from imported DAY_WIDTHS
        const baseWidth = DAY_WIDTHS[this.settings.timeScale as TimeScale] || DAY_WIDTHS.monthly;
        return baseWidth * this.settings.zoomLevel;
    }

    private getRowHeight(type: string): number {
        const heights = ROW_HEIGHTS[this.settings.rowDensity] || ROW_HEIGHTS.normal;
        return heights[type] || heights.Feature;
    }

    private getBarHeight(type: string): number {
        const heights = BAR_HEIGHTS[this.settings.rowDensity] || BAR_HEIGHTS.normal;
        return heights[type] || heights.Feature;
    }

    private buildRows(): RowData[] {
        const rows: RowData[] = [];
        let y = 0;

        // Filter work items by level visibility
        const visibleItems = this.workItems.filter(w => {
            if (w.type === "Epic" && !this.settings.showEpics) return false;
            if (w.type === "Feature" && !this.settings.showFeatures) return false;
            if (w.type === "Milestone" && !this.settings.showMilestones) return false;
            return true;
        });

        if (this.settings.groupBy === "epic") {
            // Group by Epic (parent hierarchy)
            const epics = visibleItems.filter(w => w.type === "Epic");
            const nonEpicItems = visibleItems.filter(w => w.type !== "Epic");

            // Show epics with children
            epics.forEach(epic => {
                const isCollapsed = this.collapsed.has(epic.id) && !this.settings.pdfMode;
                const children = nonEpicItems.filter(w => w.parentId === epic.id);
                const h = this.getRowHeight("Epic");
                rows.push({ type: "Epic", data: epic, y, height: h, collapsed: isCollapsed, isParent: true, childCount: children.length, level: 0 });
                y += h;
                if (!isCollapsed && this.settings.showHierarchy) {
                    // First show milestones (they're key dates)
                    children.filter(c => c.type === "Milestone").forEach(m => {
                        const mh = this.getRowHeight("Milestone");
                        rows.push({ type: "Milestone", data: m, y, height: mh, level: 1 });
                        y += mh;
                    });
                    // Then show features
                    children.filter(c => c.type === "Feature").forEach(f => {
                        const fh = this.getRowHeight("Feature");
                        rows.push({ type: "Feature", data: f, y, height: fh, level: 1 });
                        y += fh;
                    });
                }
            });

            // Show orphan items (no parent) if epics are hidden
            if (!this.settings.showEpics) {
                nonEpicItems.forEach(item => {
                    const h = this.getRowHeight(item.type);
                    rows.push({ type: item.type, data: item, y, height: h, level: 0 });
                    y += h;
                });
            }
        } else {
            // Group by another field (Area Path, Iteration, Assigned To, etc.)
            const groups = new Map<string, WorkItem[]>();
            visibleItems.forEach(item => {
                const key = this.getGroupKey(item);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(item);
            });

            [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, items]) => {
                const isCollapsed = this.collapsed.has(`grp-${name}`) && !this.settings.pdfMode;
                const gh = this.getRowHeight("GroupHeader");
                rows.push({ type: "GroupHeader", name, y, height: gh, collapsed: isCollapsed, isParent: true, childCount: items.length, level: 0 });
                y += gh;

                if (!isCollapsed && this.settings.showHierarchy) {
                    // Sort by type: Epic first, then Milestone, then Feature
                    items.sort((a, b) => TYPES.indexOf(a.type as typeof TYPES[number]) - TYPES.indexOf(b.type as typeof TYPES[number])).forEach(item => {
                        const h = this.getRowHeight(item.type);
                        rows.push({ type: item.type, data: item, y, height: h, level: 1 });
                        y += h;
                    });
                }
            });
        }
        return rows;
    }

    private getGroupKey(item: WorkItem): string {
        const fieldMap: { [key: string]: keyof WorkItem } = {
            areaPath: "areaPath",
            iterationPath: "iterationPath",
            assignedTo: "assignedTo",
            state: "state",
            priority: "priority",
            tags: "tags"
        };
        const field = fieldMap[this.settings.groupBy] || "areaPath";
        const value = item[field];
        if (!value) return "Unassigned";
        if (field === "areaPath" || field === "iterationPath") {
            const parts = String(value).split("\\");
            return parts[parts.length - 1] || String(value);
        }
        return String(value);
    }

    private renderLeftRow(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, row: RowData): void {
        const indent = (row.level || 0) * LAYOUT.INDENT_PER_LEVEL;
        const rowEl = container.append("div")
            .classed("row", true)
            .classed("row-parent", row.isParent || false)
            .classed("row-group-header", row.type === "GroupHeader")
            .classed("row-child", (row.level || 0) > 0)
            .style("height", `${row.height}px`)
            .style("padding-left", `${LAYOUT.ROW_PADDING + indent}px`);

        if (row.type === "GroupHeader") {
            rowEl
                .attr("role", "button")
                .attr("aria-expanded", row.collapsed ? "false" : "true")
                .attr("tabindex", "0");
            rowEl.append("span").classed("row-chevron", true).attr("aria-hidden", "true").text(row.collapsed ? "▶" : "▼");
            rowEl.append("span").classed("row-title", true).text(row.name || "");
            rowEl.append("span").classed("row-count", true).attr("aria-label", `${row.childCount || 0} items`).text(String(row.childCount || 0));
            rowEl.on("click", () => this.toggleCollapse(`grp-${row.name}`));
            rowEl.on("keydown", (event: KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    this.toggleCollapse(`grp-${row.name}`);
                }
            });
        } else if (row.data) {
            rowEl.append("div").classed("row-indicator", true).attr("aria-hidden", "true").style("background", this.getColor(row.type));
            if (row.isParent) {
                rowEl
                    .attr("role", "button")
                    .attr("aria-expanded", row.collapsed ? "false" : "true")
                    .attr("tabindex", "0");
                rowEl.append("span").classed("row-chevron", true).attr("aria-hidden", "true").text(row.collapsed ? "▶" : "▼");
            }
            rowEl.append("span").classed("row-id", true).text(String(row.data.workItemId));
            rowEl.append("span").classed("row-title", true).text(row.data.title);
            if (row.childCount !== undefined && row.childCount > 0) {
                rowEl.append("span").classed("row-count", true).attr("aria-label", `${row.childCount} child items`).text(String(row.childCount));
            }
            if (row.isParent) {
                rowEl.on("click", () => this.toggleCollapse(row.data!.id));
                rowEl.on("keydown", (event: KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        this.toggleCollapse(row.data!.id);
                    }
                });
            }
            rowEl.on("contextmenu", (event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                if (row.data?.selectionId) this.selectionManager.showContextMenu(row.data.selectionId, { x: event.clientX, y: event.clientY });
            });
            if (!row.isParent) rowEl.on("click", (event: MouseEvent) => {
                if (row.data?.selectionId) this.selectionManager.select(row.data.selectionId, event.ctrlKey || event.metaKey);
            });
        }
    }

    private renderTimelineRow(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, row: RowData, dayWidth: number): void {
        const rowEl = container.append("div")
            .classed("tl-row", true)
            .classed("tl-row-parent", row.isParent || false)
            .classed("tl-row-group-header", row.type === "GroupHeader")
            .style("top", `${row.y}px`)
            .style("height", `${row.height}px`);

        if (row.type === "GroupHeader" || !row.data) return;

        const item = row.data, color = this.getColor(row.type);

        if (row.type === "Milestone") {
            if (!item.targetDate) return;
            const x = DateService.daysBetween(this.viewStart, item.targetDate) * dayWidth;
            const size = this.getBarHeight("Milestone");

            // Create a container for milestone and its label
            const milestoneContainer = rowEl.append("div")
                .classed("milestone-container", true)
                .style("position", "absolute")
                .style("top", `${(row.height - size) / 2}px`)
                .style("height", `${size}px`)
                .style("display", "flex")
                .style("align-items", "center");

            // Position container based on label position
            if (this.settings.milestoneLabelPosition === "left") {
                milestoneContainer.style("right", `calc(100% - ${x + size / 2}px)`).style("flex-direction", "row-reverse");
            } else {
                milestoneContainer.style("left", `${x - size / 2}px`);
            }

            // Format date for accessibility
            const targetDateStr = DateService.formatAU(item.targetDate, { day: "numeric", month: "long", year: "numeric" });
            const ariaLabel = `Milestone ${item.workItemId}: ${item.title}, Target date ${targetDateStr}`;

            const el = milestoneContainer.append("div")
                .classed("milestone", true)
                .attr("data-id", item.id)
                .attr("role", "img")
                .attr("aria-label", ariaLabel)
                .attr("tabindex", "0")
                .style("width", `${size}px`)
                .style("height", `${size}px`)
                .style("background", color)
                .style("flex-shrink", "0")
                .attr("title", `${item.workItemId}: ${item.title}`);
            this.addBarInteractivity(el, item);

            // Add label if not 'none'
            if (this.settings.milestoneLabelPosition !== "none") {
                let labelText = `${item.workItemId}: ${item.title}`;
                if (this.settings.milestoneShowDate) {
                    const dateStr = DateService.formatAU(item.targetDate, { day: "numeric", month: "short" });
                    labelText = `${dateStr} - ${labelText}`;
                }
                milestoneContainer.append("span")
                    .classed("milestone-label", true)
                    .style("margin-left", this.settings.milestoneLabelPosition === "right" ? `${LAYOUT.MILESTONE_LABEL_MARGIN}px` : "0")
                    .style("margin-right", this.settings.milestoneLabelPosition === "left" ? `${LAYOUT.MILESTONE_LABEL_MARGIN}px` : "0")
                    .text(labelText);
            }
        } else {
            if (!item.startDate || !item.targetDate) return;
            const startX = DateService.daysBetween(this.viewStart, item.startDate) * dayWidth;
            const endX = DateService.daysBetween(this.viewStart, item.targetDate) * dayWidth;
            const width = Math.max(endX - startX + dayWidth, LAYOUT.MIN_BAR_WIDTH);
            const barHeight = this.getBarHeight(row.type);

            // Format dates for accessibility
            const startDateStr = DateService.formatAU(item.startDate, { day: "numeric", month: "long", year: "numeric" });
            const endDateStr = DateService.formatAU(item.targetDate, { day: "numeric", month: "long", year: "numeric" });
            const barAriaLabel = `${row.type} ${item.workItemId}: ${item.title}, ${startDateStr} to ${endDateStr}`;

            const bar = rowEl.append("div")
                .classed("bar", true)
                .attr("data-id", item.id)
                .attr("role", "img")
                .attr("aria-label", barAriaLabel)
                .attr("tabindex", "0")
                .style("left", `${startX}px`)
                .style("width", `${width}px`)
                .style("height", `${barHeight}px`)
                .style("top", `${(row.height - barHeight) / 2}px`)
                .style("background", color)
                .attr("title", `${item.workItemId}: ${item.title}`);
            if (width > LAYOUT.MIN_BAR_WIDTH_FOR_LABEL) bar.append("span").classed("bar-label", true).text(`${item.workItemId} · ${item.title}`);
            this.addBarInteractivity(bar, item);
        }
    }

    private renderDependencyLines(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, rows: RowData[], dayWidth: number): void {
        // Create SVG layer for dependency lines
        const svgContainer = container.append("svg")
            .classed("dependency-layer", true)
            .attr("width", "100%")
            .attr("height", "100%")
            .style("position", "absolute")
            .style("top", "0")
            .style("left", "0")
            .style("pointer-events", "none")
            .style("z-index", "20");

        const lineColor = this.settings.dependencyLineColor;

        // Build index for O(1) lookups (optimization for large datasets)
        const rowIndex = new Map<string, RowData>();
        const workItemIdIndex = new Map<number, RowData>();
        rows.forEach(row => {
            if (row.data) {
                rowIndex.set(row.data.id, row);
                workItemIdIndex.set(row.data.workItemId, row);
            }
        });

        // Draw parent-child dependency lines
        if (this.settings.showParentChild) {
            rows.forEach(row => {
                if (!row.data || row.type === "GroupHeader") return;

                const item = row.data;
                if (!item.parentId) return;

                // Find parent row using index (O(1) instead of O(n))
                const parentRow = rowIndex.get(item.parentId);
                if (!parentRow || !parentRow.data) return;

                // Calculate line coordinates
                const parentItem = parentRow.data;
                const parentEndX = parentItem.targetDate
                    ? DateService.daysBetween(this.viewStart, parentItem.targetDate) * dayWidth
                    : 0;
                const childStartX = item.startDate
                    ? DateService.daysBetween(this.viewStart, item.startDate) * dayWidth
                    : (item.targetDate ? DateService.daysBetween(this.viewStart, item.targetDate) * dayWidth : 0);

                const parentY = parentRow.y + parentRow.height / 2;
                const childY = row.y + row.height / 2;

                if (parentEndX > 0 && childStartX > 0) {
                    // Draw curved connector line
                    const midX = (parentEndX + childStartX) / 2;
                    svgContainer.append("path")
                        .attr("d", `M ${parentEndX} ${parentY} C ${midX} ${parentY}, ${midX} ${childY}, ${childStartX} ${childY}`)
                        .attr("fill", "none")
                        .attr("stroke", lineColor)
                        .attr("stroke-width", String(DEPENDENCY_LINES.PARENT_CHILD_WIDTH))
                        .attr("stroke-dasharray", DEPENDENCY_LINES.PARENT_CHILD_DASH)
                        .attr("opacity", String(DEPENDENCY_LINES.PARENT_CHILD_OPACITY));

                    // Arrow at child end
                    svgContainer.append("circle")
                        .attr("cx", childStartX)
                        .attr("cy", childY)
                        .attr("r", String(DEPENDENCY_LINES.CONNECTOR_RADIUS))
                        .attr("fill", lineColor)
                        .attr("opacity", String(DEPENDENCY_LINES.PREDECESSOR_OPACITY));
                }
            });
        }

        // Draw predecessor dependency lines
        if (this.settings.showPredecessors) {
            rows.forEach(row => {
                if (!row.data || row.type === "GroupHeader") return;

                const item = row.data;
                if (!item.predecessorId) return;

                // Find predecessor using indexes (O(1) instead of O(n))
                const predId = Number(item.predecessorId);
                let predecessorRow = workItemIdIndex.get(predId) ||
                    rowIndex.get(item.predecessorId) ||
                    rowIndex.get(`E-${item.predecessorId}`) ||
                    rowIndex.get(`F-${item.predecessorId}`) ||
                    rowIndex.get(`M-${item.predecessorId}`);

                if (!predecessorRow || !predecessorRow.data) return;

                const predItem = predecessorRow.data;
                const predEndX = predItem.targetDate
                    ? DateService.daysBetween(this.viewStart, predItem.targetDate) * dayWidth
                    : 0;
                const itemStartX = item.startDate
                    ? DateService.daysBetween(this.viewStart, item.startDate) * dayWidth
                    : (item.targetDate ? DateService.daysBetween(this.viewStart, item.targetDate) * dayWidth : 0);

                const predY = predecessorRow.y + predecessorRow.height / 2;
                const itemY = row.y + row.height / 2;

                if (predEndX > 0 && itemStartX > 0) {
                    // Draw solid connector line for explicit dependencies
                    const midX = (predEndX + itemStartX) / 2;
                    svgContainer.append("path")
                        .attr("d", `M ${predEndX} ${predY} C ${midX} ${predY}, ${midX} ${itemY}, ${itemStartX} ${itemY}`)
                        .attr("fill", "none")
                        .attr("stroke", lineColor)
                        .attr("stroke-width", String(DEPENDENCY_LINES.PREDECESSOR_WIDTH))
                        .attr("opacity", String(DEPENDENCY_LINES.PREDECESSOR_OPACITY));

                    // Arrow at destination
                    const arrowSize = DEPENDENCY_LINES.ARROW_SIZE;
                    svgContainer.append("polygon")
                        .attr("points", `${itemStartX},${itemY} ${itemStartX - arrowSize},${itemY - arrowSize / 2} ${itemStartX - arrowSize},${itemY + arrowSize / 2}`)
                        .attr("fill", lineColor)
                        .attr("opacity", String(DEPENDENCY_LINES.PREDECESSOR_OPACITY));
                }
            });
        }
    }

    private addBarInteractivity(element: d3.Selection<HTMLDivElement, unknown, null, undefined>, item: WorkItem): void {
        element.on("click", (event: MouseEvent) => { event.stopPropagation(); if (item.selectionId) this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey); })
            .on("contextmenu", (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); if (item.selectionId) this.selectionManager.showContextMenu(item.selectionId, { x: event.clientX, y: event.clientY }); });
    }

    private renderTimeHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        switch (this.settings.timeScale) {
        case "daily":
            this.renderDailyHeaders(container, viewEnd, dayWidth);
            break;
        case "weekly":
            this.renderWeeklyHeaders(container, viewEnd, dayWidth);
            break;
        case "monthly":
            this.renderMonthlyHeaders(container, viewEnd, dayWidth);
            break;
        case "annual":
            this.renderAnnualHeaders(container, viewEnd, dayWidth);
            break;
        case "multiYear":
            this.renderMultiYearHeaders(container, viewEnd, dayWidth);
            break;
        default:
            this.renderMonthlyHeaders(container, viewEnd, dayWidth);
        }
    }

    private renderDailyHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        let current = new Date(this.viewStart);
        while (current <= viewEnd) {
            if (DateService.isFirstOfMonth(current) || current.getTime() === this.viewStart.getTime()) {
                const x = DateService.daysBetween(this.viewStart, current) * dayWidth;
                const monthEnd = DateService.getMonthEnd(current.getFullYear(), current.getMonth());
                const width = DateService.daysBetween(current, monthEnd > viewEnd ? viewEnd : monthEnd) * dayWidth + dayWidth;
                container.append("div").classed("month-cell", true).classed("month-primary", true).style("left", `${x}px`).style("width", `${width}px`).text(DateService.formatAU(current, { month: "short", year: "numeric" }));
            }
            current = DateService.addDays(current, 1);
        }
        if (dayWidth >= 20) {
            current = new Date(this.viewStart);
            let i = 0;
            while (current <= viewEnd) {
                const x = i * dayWidth;
                container.append("div").classed("day-cell", true).style("left", `${x}px`).style("width", `${dayWidth}px`).style("top", "28px").text(current.getDate().toString());
                current = DateService.addDays(current, 1);
                i++;
            }
        }
    }

    private renderWeeklyHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        let current = new Date(this.viewStart);
        while (current <= viewEnd) {
            if (DateService.isFirstOfMonth(current) || current.getTime() === this.viewStart.getTime()) {
                const x = DateService.daysBetween(this.viewStart, current) * dayWidth;
                const monthEnd = DateService.getMonthEnd(current.getFullYear(), current.getMonth());
                const width = DateService.daysBetween(current, monthEnd > viewEnd ? viewEnd : monthEnd) * dayWidth + dayWidth;
                container.append("div").classed("month-cell", true).classed("month-primary", true).style("left", `${x}px`).style("width", `${width}px`).text(DateService.formatAU(current, { month: "short", year: "numeric" }));
            }
            current = DateService.addDays(current, 1);
        }
        current = DateService.nextMonday(new Date(this.viewStart));
        while (current <= viewEnd) {
            const x = DateService.daysBetween(this.viewStart, current) * dayWidth;
            const weekEnd = DateService.addDays(current, 6);
            const effectiveEnd = weekEnd > viewEnd ? viewEnd : weekEnd;
            const width = DateService.daysBetween(current, effectiveEnd) * dayWidth + dayWidth;
            container.append("div").classed("week-cell", true).style("left", `${x}px`).style("width", `${width}px`).style("top", "28px").text(`W${DateService.getWeekNumber(current)}`);
            current = DateService.addDays(current, 7);
        }
    }

    private renderMonthlyHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        let current = new Date(this.viewStart);
        while (current <= viewEnd) {
            if (DateService.isFirstOfMonth(current) || current.getTime() === this.viewStart.getTime()) {
                const x = DateService.daysBetween(this.viewStart, current) * dayWidth;
                const monthEnd = DateService.getMonthEnd(current.getFullYear(), current.getMonth());
                const width = DateService.daysBetween(current, monthEnd > viewEnd ? viewEnd : monthEnd) * dayWidth + dayWidth;
                container.append("div").classed("month-cell", true).style("left", `${x}px`).style("width", `${width}px`).text(DateService.formatAU(current, { month: "short", year: "numeric" }));
            }
            current = DateService.addDays(current, 1);
        }
    }

    private renderAnnualHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        let current = new Date(this.viewStart);
        let currentYear = current.getFullYear();
        let yearStartX = 0;
        while (current <= viewEnd) {
            if (current.getFullYear() !== currentYear) {
                const width = DateService.daysBetween(this.viewStart, current) * dayWidth - yearStartX;
                container.append("div").classed("year-cell", true).style("left", `${yearStartX}px`).style("width", `${width}px`).text(String(currentYear));
                yearStartX = DateService.daysBetween(this.viewStart, current) * dayWidth;
                currentYear = current.getFullYear();
            }
            current = DateService.addDays(current, 1);
        }
        const totalWidth = DateService.daysBetween(this.viewStart, viewEnd) * dayWidth + dayWidth;
        container.append("div").classed("year-cell", true).style("left", `${yearStartX}px`).style("width", `${totalWidth - yearStartX}px`).text(String(currentYear));
        current = new Date(this.viewStart);
        while (current <= viewEnd) {
            const quarter = DateService.getQuarter(current);
            if (DateService.isFirstOfQuarter(current) || current.getTime() === this.viewStart.getTime()) {
                const x = DateService.daysBetween(this.viewStart, current) * dayWidth;
                const quarterEnd = DateService.getQuarterEnd(current.getFullYear(), quarter);
                const effectiveEnd = quarterEnd > viewEnd ? viewEnd : quarterEnd;
                const width = DateService.daysBetween(current, effectiveEnd) * dayWidth + dayWidth;
                container.append("div").classed("quarter-cell", true).style("left", `${x}px`).style("width", `${width}px`).style("top", "28px").text(`Q${quarter}`);
            }
            current = DateService.addDays(current, 1);
        }
    }

    private renderMultiYearHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        // Render year headers only (very compact for multi-year view)
        let current = new Date(this.viewStart);
        let currentYear = current.getFullYear();
        let yearStartX = 0;
        while (current <= viewEnd) {
            if (current.getFullYear() !== currentYear) {
                const width = DateService.daysBetween(this.viewStart, current) * dayWidth - yearStartX;
                container.append("div").classed("year-cell", true).classed("year-cell-multi", true).style("left", `${yearStartX}px`).style("width", `${width}px`).style("height", "36px").text(String(currentYear));
                yearStartX = DateService.daysBetween(this.viewStart, current) * dayWidth;
                currentYear = current.getFullYear();
            }
            current = DateService.addDays(current, 1);
        }
        // Render last year
        const totalWidth = DateService.daysBetween(this.viewStart, viewEnd) * dayWidth + dayWidth;
        container.append("div").classed("year-cell", true).classed("year-cell-multi", true).style("left", `${yearStartX}px`).style("width", `${totalWidth - yearStartX}px`).style("height", "36px").text(String(currentYear));
    }

    private renderGrid(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, totalDays: number, dayWidth: number, _viewEnd: Date): void {
        switch (this.settings.timeScale) {
        case "daily":
            for (let i = 0; i < totalDays; i++) {
                const date = DateService.addDays(this.viewStart, i);
                const isMonth = DateService.isFirstOfMonth(date);
                const isWeekend = DateService.isWeekend(date);
                container.append("div").classed("grid-line", true).classed("grid-line-month", isMonth).classed("grid-line-weekend", isWeekend).style("left", `${i * dayWidth}px`);
            }
            break;
        case "weekly":
            for (let i = 0; i < totalDays; i++) {
                const date = DateService.addDays(this.viewStart, i);
                const isMonth = DateService.isFirstOfMonth(date);
                const isMonday = DateService.isMonday(date);
                if (isMonth || isMonday) {
                    container.append("div").classed("grid-line", true).classed("grid-line-month", isMonth).classed("grid-line-week", isMonday && !isMonth).style("left", `${i * dayWidth}px`);
                }
            }
            break;
        case "monthly":
            for (let i = 0; i < totalDays; i++) {
                const date = DateService.addDays(this.viewStart, i);
                if (DateService.isFirstOfMonth(date)) {
                    container.append("div").classed("grid-line", true).classed("grid-line-month", true).style("left", `${i * dayWidth}px`);
                }
            }
            break;
        case "annual":
            for (let i = 0; i < totalDays; i++) {
                const date = DateService.addDays(this.viewStart, i);
                const isYear = DateService.isFirstOfYear(date);
                const isQuarter = DateService.isFirstOfQuarter(date);
                if (isYear || isQuarter) {
                    container.append("div").classed("grid-line", true).classed("grid-line-year", isYear).classed("grid-line-quarter", isQuarter && !isYear).style("left", `${i * dayWidth}px`);
                }
            }
            break;
        case "multiYear":
            // Grid lines only at year boundaries for multi-year view
            for (let i = 0; i < totalDays; i++) {
                const date = DateService.addDays(this.viewStart, i);
                const isYear = DateService.isFirstOfYear(date);
                if (isYear) {
                    container.append("div").classed("grid-line", true).classed("grid-line-year", true).style("left", `${i * dayWidth}px`);
                }
            }
            break;
        }
    }

    private renderTodayLine(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        const today = DateService.today();
        if (today >= this.viewStart && today <= viewEnd) {
            const line = container.append("div").classed("today-line", true).style("left", `${DateService.daysBetween(this.viewStart, today) * dayWidth}px`);
            line.append("span").classed("today-label", true).text("TODAY");
        }
    }

    private renderEmptyState(message: string): void {
        const empty = this.container.append("div").classed("empty-state", true);
        empty.append("div").classed("empty-icon", true).text("📊");
        empty.append("div").classed("empty-title", true).text("No Data");
        empty.append("div").classed("empty-text", true).text(message);
        const help = empty.append("div").classed("empty-help", true);
        help.append("span").text("Required: ");
        help.append("strong").text("Work Item ID, Title, Type");
    }

    private toggleCollapse(key: string): void {
        if (this.collapsed.has(key)) this.collapsed.delete(key);
        else this.collapsed.add(key);
        this.host.refreshHostData();
    }

    private getColor(type: string): string {
        return type === "Epic" ? this.settings.epicColor : type === "Milestone" ? this.settings.milestoneColor : this.settings.featureColor;
    }

    private sanitizeString(str: string): string {
        return str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";
    }

    private sanitizeUrl(url: string): string {
        if (!url) return "";
        // Only allow HTTPS and data:image URLs for security (no http:// or file://)
        // This prevents mixed content warnings and protocol-based attacks
        const trimmed = url.trim().toLowerCase();
        const originalTrimmed = url.trim();
        if (trimmed.startsWith("https://")) {
            return originalTrimmed;
        }
        if (trimmed.startsWith("data:image/")) {
            // Validate data URL format more strictly
            if (/^data:image\/(png|jpeg|jpg|gif|svg\+xml|webp);base64,/i.test(originalTrimmed)) {
                return originalTrimmed;
            }
        }
        return "";
    }

    // Note: Date utilities (parseDate, addDays, daysBetween) have been
    // extracted to DateService for better testability and DST handling.

    public destroy(): void {
        // Remove window event listeners to prevent memory leak
        d3.select(window)
            .on("mousemove.dragpan", null)
            .on("mouseup.dragpan", null);

        // Remove all event listeners from container and children
        this.container.on("contextmenu", null);

        // Remove all child elements first
        this.container.selectAll("*").remove();

        // Remove the main container element itself for full cleanup
        this.container.remove();

        // Clear all data references for garbage collection
        this.workItems = [];
        this.collapsed.clear();
        this.rowPositions.clear();
        this.allRows = [];
        this.renderedRowIds.clear();
        this.coordinateEngine = null;
    }
}
