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
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

import "./../style/visual.less";

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
    rowDensity: 'compact' | 'normal' | 'comfortable';
    enableDragPan: boolean;
    // Logo settings
    logoUrl: string;
    logoSize: 'small' | 'medium' | 'large';
    showLogo: boolean;
    // Organization settings
    groupBy: string;
    showHierarchy: boolean;
    defaultExpanded: boolean;
    // Colors
    epicColor: string;
    milestoneColor: string;
    featureColor: string;
    // Milestone settings
    milestoneLabelPosition: 'left' | 'right' | 'none';
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
    timeScale: 'daily' | 'weekly' | 'monthly' | 'annual' | 'multiYear';
    zoomLevel: number;
    // Export settings
    pdfMode: boolean;
    // PDF Export settings (PSPF security classification)
    securityClassification: string;
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

// Constants
const TYPES = ['Epic', 'Milestone', 'Feature'];

// Row heights for different density levels
const ROW_HEIGHTS: { [density: string]: { [type: string]: number } } = {
    compact: { Epic: 32, Milestone: 28, Feature: 30, GroupHeader: 30 },
    normal: { Epic: 48, Milestone: 40, Feature: 44, GroupHeader: 44 },
    comfortable: { Epic: 56, Milestone: 48, Feature: 52, GroupHeader: 52 }
};

// Bar heights for different density levels
const BAR_HEIGHTS: { [density: string]: { [type: string]: number } } = {
    compact: { Epic: 22, Milestone: 14, Feature: 20 },
    normal: { Epic: 32, Milestone: 18, Feature: 28 },
    comfortable: { Epic: 40, Milestone: 22, Feature: 36 }
};

export class RoadmapVisual implements IVisual {
    private host: IVisualHost;
    private container: d3.Selection<HTMLDivElement, unknown, null, undefined>;
    private workItems: WorkItem[] = [];
    private settings: VisualSettings;
    private collapsed: Set<string> = new Set();
    private viewStart: Date = new Date();
    private selectionManager: ISelectionManager;
    private rowPositions: Map<string, { y: number; height: number }> = new Map();

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
            epicColor: "#4F46E5",
            milestoneColor: "#DC2626",
            featureColor: "#0891B2",
            milestoneLabelPosition: "right",
            milestoneShowDate: false,
            showDependencies: false,
            showParentChild: true,
            showPredecessors: true,
            dependencyLineColor: "#94A3B8",
            showEpics: true,
            showFeatures: true,
            showMilestones: true,
            timeScale: 'monthly',
            zoomLevel: 1,
            pdfMode: false,
            securityClassification: ""
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
                : this.addDays(new Date(), 90);

            this.viewStart = this.addDays(minDate, -14);
            const viewEnd = this.addDays(maxDate, 28);

            // Render visual
            this.render(options.viewport.width, options.viewport.height, viewEnd);

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
                startDate: this.parseDate(startCol?.values[i]),
                targetDate: this.parseDate(targetCol?.values[i]),
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
            const scale = String(objects.display.viewScale || 'monthly');
            if (['daily', 'weekly', 'monthly', 'annual', 'multiYear'].includes(scale)) {
                this.settings.timeScale = scale as 'daily' | 'weekly' | 'monthly' | 'annual' | 'multiYear';
            }
            const density = String(objects.display.rowDensity || 'normal');
            if (['compact', 'normal', 'comfortable'].includes(density)) {
                this.settings.rowDensity = density as 'compact' | 'normal' | 'comfortable';
            }
            const zoom = parseFloat(String(objects.display.zoomLevel || '1'));
            if ([0.5, 1, 2, 4].includes(zoom)) {
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
            const size = String(objects.logo.size || 'medium');
            if (['small', 'medium', 'large'].includes(size)) {
                this.settings.logoSize = size as 'small' | 'medium' | 'large';
            }
            this.settings.showLogo = objects.logo.show !== false;
        }
        // Work Item Colors
        if (objects.workItemColors) {
            const getColor = (obj: any): string | undefined => obj?.solid?.color;
            this.settings.epicColor = getColor(objects.workItemColors.epicColor) || this.settings.epicColor;
            this.settings.milestoneColor = getColor(objects.workItemColors.milestoneColor) || this.settings.milestoneColor;
            this.settings.featureColor = getColor(objects.workItemColors.featureColor) || this.settings.featureColor;
        }
        // Milestone settings
        if (objects.milestones) {
            const labelPos = String(objects.milestones.labelPosition || 'right');
            if (['left', 'right', 'none'].includes(labelPos)) {
                this.settings.milestoneLabelPosition = labelPos as 'left' | 'right' | 'none';
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
            const lineColor = (objects.dependencies.lineColor as any)?.solid?.color;
            if (lineColor) this.settings.dependencyLineColor = lineColor;
        }
        // Export settings
        if (objects.export) {
            this.settings.pdfMode = Boolean(objects.export.pdfMode);
        }
        // PDF Export settings (PSPF security classification)
        if (objects.pdfExport) {
            this.settings.securityClassification = this.sanitizeString(String(objects.pdfExport.securityClassification || ""));
        }
    }

    private render(width: number, height: number, viewEnd: Date): void {
        // Calculate day width based on time scale and zoom level
        const dayWidth = this.calculateDayWidth();
        const totalDays = this.daysBetween(this.viewStart, viewEnd);
        const timelineWidth = totalDays * dayWidth;
        const leftPanelWidth = 280;

        // In PDF mode, expand all items
        if (this.settings.pdfMode) {
            this.collapsed.clear();
        }

        const rows = this.buildRows();
        const totalHeight = rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0;

        // Header
        const header = this.container.append("div").classed("header", true);

        // Add logo if URL is provided and show is enabled
        if (this.settings.showLogo && this.settings.logoUrl) {
            const logoSizes = { small: 24, medium: 32, large: 48 };
            const logoSize = logoSizes[this.settings.logoSize] || 32;
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

        // Export button
        header.append("button")
            .classed("export-btn", true)
            .text("Export PDF")
            .on("click", () => this.exportToPdf());

        // Main container - add pdf-mode class for export optimization
        const main = this.container.append("div").classed("main", true).classed("pdf-mode", this.settings.pdfMode);

        // Left panel
        const left = main.append("div").classed("left-panel", true).style("width", `${leftPanelWidth}px`);
        left.append("div").classed("left-header", true).text("WORK ITEMS");
        const leftBody = left.append("div").classed("left-body", true);

        // In PDF mode, show all content without scroll
        if (this.settings.pdfMode) {
            leftBody.style("overflow", "visible").style("height", "auto");
        }

        // Timeline panel
        const timeline = main.append("div").classed("timeline-panel", true);
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

        // Render rows and store positions
        rows.forEach(row => {
            this.renderLeftRow(leftBody, row);
            this.renderTimelineRow(timelineInner, row, dayWidth);
            if (row.data) {
                this.rowPositions.set(row.data.id, { y: row.y, height: row.height });
            }
        });

        // Render dependency lines if enabled
        if (this.settings.showDependencies) {
            this.renderDependencyLines(timelineInner, rows, dayWidth);
        }

        // Sync scroll (disabled in PDF mode)
        if (!this.settings.pdfMode) {
            const leftBodyNode = leftBody.node();
            const timelineBodyNode = timelineBody.node();
            const timelineHeaderWrapperNode = timelineHeaderWrapper.node();
            if (leftBodyNode && timelineBodyNode && timelineHeaderWrapperNode) {
                leftBody.on("scroll", () => { timelineBodyNode.scrollTop = leftBodyNode.scrollTop; });
                timelineBody.on("scroll", () => {
                    leftBodyNode.scrollTop = timelineBodyNode.scrollTop;
                    timelineHeaderWrapperNode.scrollLeft = timelineBodyNode.scrollLeft;
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
                            if (target.closest('.bar, .milestone, .milestone-container')) return;

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
        // Base widths for each time scale (pixels per day)
        const baseWidths: { [key: string]: number } = {
            daily: 24,
            weekly: 6,
            monthly: 2,
            annual: 0.5,
            multiYear: 0.15
        };
        const baseWidth = baseWidths[this.settings.timeScale] || baseWidths.monthly;
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
            if (w.type === 'Epic' && !this.settings.showEpics) return false;
            if (w.type === 'Feature' && !this.settings.showFeatures) return false;
            if (w.type === 'Milestone' && !this.settings.showMilestones) return false;
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
                    items.sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type)).forEach(item => {
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
            areaPath: 'areaPath',
            iterationPath: 'iterationPath',
            assignedTo: 'assignedTo',
            state: 'state',
            priority: 'priority',
            tags: 'tags'
        };
        const field = fieldMap[this.settings.groupBy] || 'areaPath';
        const value = item[field];
        if (!value) return "Unassigned";
        if (field === "areaPath" || field === "iterationPath") {
            const parts = String(value).split("\\");
            return parts[parts.length - 1] || String(value);
        }
        return String(value);
    }

    private renderLeftRow(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, row: RowData): void {
        const indent = (row.level || 0) * 16;
        const rowEl = container.append("div")
            .classed("row", true)
            .classed("row-parent", row.isParent || false)
            .classed("row-group-header", row.type === "GroupHeader")
            .classed("row-child", (row.level || 0) > 0)
            .style("height", `${row.height}px`)
            .style("padding-left", `${10 + indent}px`);

        if (row.type === "GroupHeader") {
            rowEl.append("span").classed("row-chevron", true).text(row.collapsed ? "▶" : "▼");
            rowEl.append("span").classed("row-title", true).text(row.name || "");
            rowEl.append("span").classed("row-count", true).text(String(row.childCount || 0));
            rowEl.on("click", () => this.toggleCollapse(`grp-${row.name}`));
        } else if (row.data) {
            rowEl.append("div").classed("row-indicator", true).style("background", this.getColor(row.type));
            if (row.isParent) {
                rowEl.append("span").classed("row-chevron", true).text(row.collapsed ? "▶" : "▼");
            }
            rowEl.append("span").classed("row-id", true).text(String(row.data.workItemId));
            rowEl.append("span").classed("row-title", true).text(row.data.title);
            if (row.childCount !== undefined && row.childCount > 0) {
                rowEl.append("span").classed("row-count", true).text(String(row.childCount));
            }
            if (row.isParent) rowEl.on("click", () => this.toggleCollapse(row.data!.id));
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
            const x = this.daysBetween(this.viewStart, item.targetDate) * dayWidth;
            const size = this.getBarHeight("Milestone");

            // Create a container for milestone and its label
            const milestoneContainer = rowEl.append("div")
                .classed("milestone-container", true)
                .style("position", "absolute")
                .style("top", `${(row.height - size)/2}px`)
                .style("height", `${size}px`)
                .style("display", "flex")
                .style("align-items", "center");

            // Position container based on label position
            if (this.settings.milestoneLabelPosition === 'left') {
                milestoneContainer.style("right", `calc(100% - ${x + size/2}px)`).style("flex-direction", "row-reverse");
            } else {
                milestoneContainer.style("left", `${x - size/2}px`);
            }

            const el = milestoneContainer.append("div")
                .classed("milestone", true)
                .attr("data-id", item.id)
                .style("width", `${size}px`)
                .style("height", `${size}px`)
                .style("background", color)
                .style("flex-shrink", "0")
                .attr("title", `${item.workItemId}: ${item.title}`);
            this.addBarInteractivity(el, item);

            // Add label if not 'none'
            if (this.settings.milestoneLabelPosition !== 'none') {
                let labelText = `${item.workItemId}: ${item.title}`;
                if (this.settings.milestoneShowDate) {
                    const dateStr = item.targetDate.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
                    labelText = `${dateStr} - ${labelText}`;
                }
                milestoneContainer.append("span")
                    .classed("milestone-label", true)
                    .style("margin-left", this.settings.milestoneLabelPosition === 'right' ? "6px" : "0")
                    .style("margin-right", this.settings.milestoneLabelPosition === 'left' ? "6px" : "0")
                    .text(labelText);
            }
        } else {
            if (!item.startDate || !item.targetDate) return;
            const startX = this.daysBetween(this.viewStart, item.startDate) * dayWidth;
            const endX = this.daysBetween(this.viewStart, item.targetDate) * dayWidth;
            const width = Math.max(endX - startX + dayWidth, 30);
            const barHeight = this.getBarHeight(row.type);
            const bar = rowEl.append("div")
                .classed("bar", true)
                .attr("data-id", item.id)
                .style("left", `${startX}px`)
                .style("width", `${width}px`)
                .style("height", `${barHeight}px`)
                .style("top", `${(row.height - barHeight)/2}px`)
                .style("background", color)
                .attr("title", `${item.workItemId}: ${item.title}`);
            if (width > 50) bar.append("span").classed("bar-label", true).text(`${item.workItemId} · ${item.title}`);
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

        // Draw parent-child dependency lines
        if (this.settings.showParentChild) {
            rows.forEach(row => {
                if (!row.data || row.type === "GroupHeader") return;

                const item = row.data;
                if (!item.parentId) return;

                // Find parent row
                const parentRow = rows.find(r => r.data?.id === item.parentId);
                if (!parentRow || !parentRow.data) return;

                // Calculate line coordinates
                const parentItem = parentRow.data;
                const parentEndX = parentItem.targetDate
                    ? this.daysBetween(this.viewStart, parentItem.targetDate) * dayWidth
                    : 0;
                const childStartX = item.startDate
                    ? this.daysBetween(this.viewStart, item.startDate) * dayWidth
                    : (item.targetDate ? this.daysBetween(this.viewStart, item.targetDate) * dayWidth : 0);

                const parentY = parentRow.y + parentRow.height / 2;
                const childY = row.y + row.height / 2;

                if (parentEndX > 0 && childStartX > 0) {
                    // Draw curved connector line
                    const midX = (parentEndX + childStartX) / 2;
                    svgContainer.append("path")
                        .attr("d", `M ${parentEndX} ${parentY} C ${midX} ${parentY}, ${midX} ${childY}, ${childStartX} ${childY}`)
                        .attr("fill", "none")
                        .attr("stroke", lineColor)
                        .attr("stroke-width", "1.5")
                        .attr("stroke-dasharray", "4,2")
                        .attr("opacity", "0.6");

                    // Arrow at child end
                    svgContainer.append("circle")
                        .attr("cx", childStartX)
                        .attr("cy", childY)
                        .attr("r", "3")
                        .attr("fill", lineColor)
                        .attr("opacity", "0.8");
                }
            });
        }

        // Draw predecessor dependency lines
        if (this.settings.showPredecessors) {
            rows.forEach(row => {
                if (!row.data || row.type === "GroupHeader") return;

                const item = row.data;
                if (!item.predecessorId) return;

                // Find predecessor - could be by workItemId
                const predecessorRow = rows.find(r =>
                    r.data && (
                        r.data.workItemId === Number(item.predecessorId) ||
                        r.data.id === item.predecessorId ||
                        r.data.id === `E-${item.predecessorId}` ||
                        r.data.id === `F-${item.predecessorId}` ||
                        r.data.id === `M-${item.predecessorId}`
                    )
                );

                if (!predecessorRow || !predecessorRow.data) return;

                const predItem = predecessorRow.data;
                const predEndX = predItem.targetDate
                    ? this.daysBetween(this.viewStart, predItem.targetDate) * dayWidth
                    : 0;
                const itemStartX = item.startDate
                    ? this.daysBetween(this.viewStart, item.startDate) * dayWidth
                    : (item.targetDate ? this.daysBetween(this.viewStart, item.targetDate) * dayWidth : 0);

                const predY = predecessorRow.y + predecessorRow.height / 2;
                const itemY = row.y + row.height / 2;

                if (predEndX > 0 && itemStartX > 0) {
                    // Draw solid connector line for explicit dependencies
                    const midX = (predEndX + itemStartX) / 2;
                    svgContainer.append("path")
                        .attr("d", `M ${predEndX} ${predY} C ${midX} ${predY}, ${midX} ${itemY}, ${itemStartX} ${itemY}`)
                        .attr("fill", "none")
                        .attr("stroke", lineColor)
                        .attr("stroke-width", "2")
                        .attr("opacity", "0.8");

                    // Arrow at destination
                    const arrowSize = 6;
                    svgContainer.append("polygon")
                        .attr("points", `${itemStartX},${itemY} ${itemStartX - arrowSize},${itemY - arrowSize/2} ${itemStartX - arrowSize},${itemY + arrowSize/2}`)
                        .attr("fill", lineColor)
                        .attr("opacity", "0.8");
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
            case 'daily':
                this.renderDailyHeaders(container, viewEnd, dayWidth);
                break;
            case 'weekly':
                this.renderWeeklyHeaders(container, viewEnd, dayWidth);
                break;
            case 'monthly':
                this.renderMonthlyHeaders(container, viewEnd, dayWidth);
                break;
            case 'annual':
                this.renderAnnualHeaders(container, viewEnd, dayWidth);
                break;
            case 'multiYear':
                this.renderMultiYearHeaders(container, viewEnd, dayWidth);
                break;
            default:
                this.renderMonthlyHeaders(container, viewEnd, dayWidth);
        }
    }

    private renderDailyHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        let current = new Date(this.viewStart);
        while (current <= viewEnd) {
            if (current.getDate() === 1 || current.getTime() === this.viewStart.getTime()) {
                const x = this.daysBetween(this.viewStart, current) * dayWidth;
                const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
                const width = this.daysBetween(current, monthEnd > viewEnd ? viewEnd : monthEnd) * dayWidth + dayWidth;
                container.append("div").classed("month-cell", true).classed("month-primary", true).style("left", `${x}px`).style("width", `${width}px`).text(current.toLocaleDateString("en-AU", { month: "short", year: "numeric" }));
            }
            current = this.addDays(current, 1);
        }
        if (dayWidth >= 20) {
            current = new Date(this.viewStart);
            let i = 0;
            while (current <= viewEnd) {
                const x = i * dayWidth;
                container.append("div").classed("day-cell", true).style("left", `${x}px`).style("width", `${dayWidth}px`).style("top", "28px").text(current.getDate().toString());
                current = this.addDays(current, 1);
                i++;
            }
        }
    }

    private renderWeeklyHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        let current = new Date(this.viewStart);
        while (current <= viewEnd) {
            if (current.getDate() === 1 || current.getTime() === this.viewStart.getTime()) {
                const x = this.daysBetween(this.viewStart, current) * dayWidth;
                const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
                const width = this.daysBetween(current, monthEnd > viewEnd ? viewEnd : monthEnd) * dayWidth + dayWidth;
                container.append("div").classed("month-cell", true).classed("month-primary", true).style("left", `${x}px`).style("width", `${width}px`).text(current.toLocaleDateString("en-AU", { month: "short", year: "numeric" }));
            }
            current = this.addDays(current, 1);
        }
        current = new Date(this.viewStart);
        const dayOfWeek = current.getDay();
        const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
        current = this.addDays(current, daysToMonday);
        while (current <= viewEnd) {
            const x = this.daysBetween(this.viewStart, current) * dayWidth;
            const weekEnd = this.addDays(current, 6);
            const effectiveEnd = weekEnd > viewEnd ? viewEnd : weekEnd;
            const width = this.daysBetween(current, effectiveEnd) * dayWidth + dayWidth;
            container.append("div").classed("week-cell", true).style("left", `${x}px`).style("width", `${width}px`).style("top", "28px").text(`W${this.getWeekNumber(current)}`);
            current = this.addDays(current, 7);
        }
    }

    private renderMonthlyHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        let current = new Date(this.viewStart);
        while (current <= viewEnd) {
            if (current.getDate() === 1 || current.getTime() === this.viewStart.getTime()) {
                const x = this.daysBetween(this.viewStart, current) * dayWidth;
                const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
                const width = this.daysBetween(current, monthEnd > viewEnd ? viewEnd : monthEnd) * dayWidth + dayWidth;
                container.append("div").classed("month-cell", true).style("left", `${x}px`).style("width", `${width}px`).text(current.toLocaleDateString("en-AU", { month: "short", year: "numeric" }));
            }
            current = this.addDays(current, 1);
        }
    }

    private renderAnnualHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        let current = new Date(this.viewStart);
        let currentYear = current.getFullYear();
        let yearStartX = 0;
        while (current <= viewEnd) {
            if (current.getFullYear() !== currentYear) {
                const width = this.daysBetween(this.viewStart, current) * dayWidth - yearStartX;
                container.append("div").classed("year-cell", true).style("left", `${yearStartX}px`).style("width", `${width}px`).text(String(currentYear));
                yearStartX = this.daysBetween(this.viewStart, current) * dayWidth;
                currentYear = current.getFullYear();
            }
            current = this.addDays(current, 1);
        }
        const totalWidth = this.daysBetween(this.viewStart, viewEnd) * dayWidth + dayWidth;
        container.append("div").classed("year-cell", true).style("left", `${yearStartX}px`).style("width", `${totalWidth - yearStartX}px`).text(String(currentYear));
        current = new Date(this.viewStart);
        while (current <= viewEnd) {
            const quarter = Math.floor(current.getMonth() / 3) + 1;
            if ((current.getMonth() % 3 === 0 && current.getDate() === 1) || current.getTime() === this.viewStart.getTime()) {
                const x = this.daysBetween(this.viewStart, current) * dayWidth;
                const quarterEnd = new Date(current.getFullYear(), quarter * 3, 0);
                const effectiveEnd = quarterEnd > viewEnd ? viewEnd : quarterEnd;
                const width = this.daysBetween(current, effectiveEnd) * dayWidth + dayWidth;
                container.append("div").classed("quarter-cell", true).style("left", `${x}px`).style("width", `${width}px`).style("top", "28px").text(`Q${quarter}`);
            }
            current = this.addDays(current, 1);
        }
    }

    private renderMultiYearHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        // Render year headers only (very compact for multi-year view)
        let current = new Date(this.viewStart);
        let currentYear = current.getFullYear();
        let yearStartX = 0;
        while (current <= viewEnd) {
            if (current.getFullYear() !== currentYear) {
                const width = this.daysBetween(this.viewStart, current) * dayWidth - yearStartX;
                container.append("div").classed("year-cell", true).classed("year-cell-multi", true).style("left", `${yearStartX}px`).style("width", `${width}px`).style("height", "36px").text(String(currentYear));
                yearStartX = this.daysBetween(this.viewStart, current) * dayWidth;
                currentYear = current.getFullYear();
            }
            current = this.addDays(current, 1);
        }
        // Render last year
        const totalWidth = this.daysBetween(this.viewStart, viewEnd) * dayWidth + dayWidth;
        container.append("div").classed("year-cell", true).classed("year-cell-multi", true).style("left", `${yearStartX}px`).style("width", `${totalWidth - yearStartX}px`).style("height", "36px").text(String(currentYear));
    }

    private getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    private renderGrid(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, totalDays: number, dayWidth: number, viewEnd: Date): void {
        switch (this.settings.timeScale) {
            case 'daily':
                for (let i = 0; i < totalDays; i++) {
                    const date = this.addDays(this.viewStart, i);
                    const isMonth = date.getDate() === 1;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    container.append("div").classed("grid-line", true).classed("grid-line-month", isMonth).classed("grid-line-weekend", isWeekend).style("left", `${i * dayWidth}px`);
                }
                break;
            case 'weekly':
                for (let i = 0; i < totalDays; i++) {
                    const date = this.addDays(this.viewStart, i);
                    const isMonth = date.getDate() === 1;
                    const isMonday = date.getDay() === 1;
                    if (isMonth || isMonday) {
                        container.append("div").classed("grid-line", true).classed("grid-line-month", isMonth).classed("grid-line-week", isMonday && !isMonth).style("left", `${i * dayWidth}px`);
                    }
                }
                break;
            case 'monthly':
                for (let i = 0; i < totalDays; i++) {
                    const date = this.addDays(this.viewStart, i);
                    if (date.getDate() === 1) {
                        container.append("div").classed("grid-line", true).classed("grid-line-month", true).style("left", `${i * dayWidth}px`);
                    }
                }
                break;
            case 'annual':
                for (let i = 0; i < totalDays; i++) {
                    const date = this.addDays(this.viewStart, i);
                    const isYear = date.getMonth() === 0 && date.getDate() === 1;
                    const isQuarter = date.getDate() === 1 && date.getMonth() % 3 === 0;
                    if (isYear || isQuarter) {
                        container.append("div").classed("grid-line", true).classed("grid-line-year", isYear).classed("grid-line-quarter", isQuarter && !isYear).style("left", `${i * dayWidth}px`);
                    }
                }
                break;
            case 'multiYear':
                // Grid lines only at year boundaries for multi-year view
                for (let i = 0; i < totalDays; i++) {
                    const date = this.addDays(this.viewStart, i);
                    const isYear = date.getMonth() === 0 && date.getDate() === 1;
                    if (isYear) {
                        container.append("div").classed("grid-line", true).classed("grid-line-year", true).style("left", `${i * dayWidth}px`);
                    }
                }
                break;
        }
    }

    private renderTodayLine(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (today >= this.viewStart && today <= viewEnd) {
            const line = container.append("div").classed("today-line", true).style("left", `${this.daysBetween(this.viewStart, today) * dayWidth}px`);
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
        // Only allow http, https, and data URLs for security
        const trimmed = url.trim();
        if (trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("data:image/")) {
            return trimmed;
        }
        return "";
    }

    private parseDate(value: any): Date | null {
        if (!value) return null;
        const d = new Date(value);
        d.setHours(0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    }

    private addDays(date: Date, days: number): Date {
        const r = new Date(date);
        r.setDate(r.getDate() + days);
        return r;
    }

    private daysBetween(start: Date, end: Date): number {
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    /**
     * Export the roadmap to PDF with security classification markings
     * Per PSPF guidelines: centered at top and bottom, red, bold, capitals
     */
    private async exportToPdf(): Promise<void> {
        const containerNode = this.container.node();
        if (!containerNode) return;

        try {
            // Capture the visual content
            const canvas = await html2canvas(containerNode, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#FFFFFF"
            });

            // Create PDF in landscape A4
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a4"
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            const headerFooterHeight = 12;
            const securityClassification = this.settings.securityClassification.toUpperCase();

            // Calculate content area
            const contentStartY = margin + (securityClassification ? headerFooterHeight : 0) + (this.settings.showLogo && this.settings.logoUrl ? 15 : 0);
            const contentEndY = pageHeight - margin - (securityClassification ? headerFooterHeight : 0);
            const contentHeight = contentEndY - contentStartY;
            const contentWidth = pageWidth - (margin * 2);

            // Draw security classification at TOP (PSPF requirement: center top, red, bold, capitals)
            if (securityClassification) {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(14);
                pdf.setTextColor(220, 38, 38); // Red color (#DC2626)
                pdf.text(securityClassification, pageWidth / 2, margin + 5, { align: "center" });
            }

            // Draw logo if enabled
            if (this.settings.showLogo && this.settings.logoUrl) {
                try {
                    const logoY = margin + (securityClassification ? headerFooterHeight : 0);
                    // Center the logo, assume max height of 12mm
                    pdf.addImage(this.settings.logoUrl, "PNG", (pageWidth - 40) / 2, logoY, 40, 12);
                } catch (logoError) {
                    console.warn("Failed to add logo to PDF:", logoError);
                }
            }

            // Add the captured content
            const imgData = canvas.toDataURL("image/png");
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
            const scaledWidth = imgWidth * ratio;
            const scaledHeight = imgHeight * ratio;
            const imgX = margin + (contentWidth - scaledWidth) / 2;
            const imgY = contentStartY + (contentHeight - scaledHeight) / 2;

            pdf.addImage(imgData, "PNG", imgX, imgY, scaledWidth, scaledHeight);

            // Draw security classification at BOTTOM (PSPF requirement: center bottom, red, bold, capitals)
            if (securityClassification) {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(14);
                pdf.setTextColor(220, 38, 38); // Red color (#DC2626)
                pdf.text(securityClassification, pageWidth / 2, pageHeight - margin, { align: "center" });
            }

            // Add footer with generation date
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            const dateStr = new Date().toLocaleDateString("en-AU", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
            pdf.text(`Generated: ${dateStr}`, margin, pageHeight - margin + 5);
            pdf.text(`Page 1 of 1`, pageWidth - margin, pageHeight - margin + 5, { align: "right" });

            // Save the PDF
            const filename = `${this.settings.title.replace(/[^a-zA-Z0-9]/g, "_")}_Roadmap.pdf`;
            pdf.save(filename);

        } catch (error) {
            console.error("PDF export failed:", error);
        }
    }

    public destroy(): void {
        this.container.selectAll("*").remove();
        this.workItems = [];
        this.collapsed.clear();
        this.rowPositions.clear();
    }
}
