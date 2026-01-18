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
    showSwimlanes: boolean;
    swimlaneGroupBy: string;
    epicColor: string;
    milestoneColor: string;
    featureColor: string;
    showDependencies: boolean;
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
}

// Constants
const TYPES = ['Epic', 'Milestone', 'Feature'];
const ROW_HEIGHT: { [key: string]: number } = { Epic: 48, Milestone: 40, Feature: 44, SwimlaneHeader: 44 };
const BAR_HEIGHT: { [key: string]: number } = { Epic: 32, Milestone: 18, Feature: 28 };

export class RoadmapVisual implements IVisual {
    private host: IVisualHost;
    private container: d3.Selection<HTMLDivElement, unknown, null, undefined>;
    private workItems: WorkItem[] = [];
    private settings: VisualSettings;
    private collapsed: Set<string> = new Set();
    private viewStart: Date = new Date();
    private zoomLevel: number = 1;
    private selectionManager: ISelectionManager;

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
            showSwimlanes: false,
            swimlaneGroupBy: "none",
            epicColor: "#4F46E5",
            milestoneColor: "#DC2626",
            featureColor: "#0891B2",
            showDependencies: true
        };
    }

    public update(options: VisualUpdateOptions): void {
        // Signal render started - REQUIRED FOR CERTIFICATION
        this.host.eventService.renderingStarted(options);

        try {
            // Clear previous content
            this.container.selectAll("*").remove();

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

        if (objects.general) {
            this.settings.title = this.sanitizeString(String(objects.general.title || this.settings.title));
            this.settings.subtitle = this.sanitizeString(String(objects.general.subtitle || this.settings.subtitle));
        }
        if (objects.swimlanes) {
            this.settings.showSwimlanes = Boolean(objects.swimlanes.show);
            this.settings.swimlaneGroupBy = this.sanitizeString(String(objects.swimlanes.groupBy || "none"));
        }
        if (objects.colors) {
            const getColor = (obj: any): string | undefined => obj?.solid?.color;
            this.settings.epicColor = getColor(objects.colors.epicColor) || this.settings.epicColor;
            this.settings.milestoneColor = getColor(objects.colors.milestoneColor) || this.settings.milestoneColor;
            this.settings.featureColor = getColor(objects.colors.featureColor) || this.settings.featureColor;
        }
        if (objects.dependencies) {
            this.settings.showDependencies = Boolean(objects.dependencies.show);
        }
    }

    private render(width: number, height: number, viewEnd: Date): void {
        const dayWidth = this.zoomLevel === 0.5 ? 5 : this.zoomLevel === 1 ? 16 : this.zoomLevel === 2 ? 28 : 40;
        const totalDays = this.daysBetween(this.viewStart, viewEnd);
        const timelineWidth = totalDays * dayWidth;
        const leftPanelWidth = 280;

        const rows = this.buildRows();
        const totalHeight = rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0;

        // Header
        const header = this.container.append("div").classed("header", true);
        header.append("div").classed("title", true).text(this.settings.title);
        header.append("div").classed("subtitle", true).text(this.settings.subtitle);

        // Main container
        const main = this.container.append("div").classed("main", true);

        // Left panel
        const left = main.append("div").classed("left-panel", true).style("width", `${leftPanelWidth}px`);
        left.append("div").classed("left-header", true).text("Work Items");
        const leftBody = left.append("div").classed("left-body", true);

        // Timeline panel
        const timeline = main.append("div").classed("timeline-panel", true);
        const timelineHeader = timeline.append("div").classed("timeline-header", true).style("width", `${timelineWidth}px`);
        const timelineBody = timeline.append("div").classed("timeline-body", true);
        const timelineInner = timelineBody.append("div").classed("timeline-inner", true)
            .style("width", `${timelineWidth}px`)
            .style("height", `${totalHeight}px`);

        this.renderMonthHeaders(timelineHeader, viewEnd, dayWidth);
        this.renderGrid(timelineInner, totalDays, dayWidth);
        this.renderTodayLine(timelineInner, viewEnd, dayWidth);

        rows.forEach(row => {
            this.renderLeftRow(leftBody, row);
            this.renderTimelineRow(timelineInner, row, dayWidth);
        });

        // Sync scroll
        const leftBodyNode = leftBody.node();
        const timelineBodyNode = timelineBody.node();
        if (leftBodyNode && timelineBodyNode) {
            leftBody.on("scroll", () => { timelineBodyNode.scrollTop = leftBodyNode.scrollTop; });
            timelineBody.on("scroll", () => { leftBodyNode.scrollTop = timelineBodyNode.scrollTop; });
        }
    }

    private buildRows(): RowData[] {
        const rows: RowData[] = [];
        let y = 0;

        if (!this.settings.showSwimlanes || this.settings.swimlaneGroupBy === "none") {
            const epics = this.workItems.filter(w => w.type === "Epic");
            epics.forEach(epic => {
                const isCollapsed = this.collapsed.has(epic.id);
                const children = this.workItems.filter(w => w.parentId === epic.id);
                rows.push({ type: "Epic", data: epic, y, height: ROW_HEIGHT.Epic, collapsed: isCollapsed, isParent: true, childCount: children.length });
                y += ROW_HEIGHT.Epic;
                if (!isCollapsed) {
                    children.filter(c => c.type === "Milestone").forEach(m => { rows.push({ type: "Milestone", data: m, y, height: ROW_HEIGHT.Milestone }); y += ROW_HEIGHT.Milestone; });
                    children.filter(c => c.type === "Feature").forEach(f => { rows.push({ type: "Feature", data: f, y, height: ROW_HEIGHT.Feature }); y += ROW_HEIGHT.Feature; });
                }
            });
        } else {
            const groups = new Map<string, WorkItem[]>();
            this.workItems.forEach(item => { const key = this.getSwimlaneKey(item); if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(item); });
            [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, items]) => {
                const isCollapsed = this.collapsed.has(`sw-${name}`);
                rows.push({ type: "Swimlane", name, y, height: ROW_HEIGHT.SwimlaneHeader, collapsed: isCollapsed, childCount: items.length });
                y += ROW_HEIGHT.SwimlaneHeader;
                if (!isCollapsed) {
                    items.sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type)).forEach(item => {
                        const h = ROW_HEIGHT[item.type] || ROW_HEIGHT.Feature;
                        rows.push({ type: item.type, data: item, y, height: h });
                        y += h;
                    });
                }
            });
        }
        return rows;
    }

    private getSwimlaneKey(item: WorkItem): string {
        const field = this.settings.swimlaneGroupBy as keyof WorkItem;
        const value = item[field];
        if (!value) return "Unassigned";
        if (field === "areaPath" || field === "iterationPath") { const parts = String(value).split("\\"); return parts[parts.length - 1] || String(value); }
        return String(value);
    }

    private renderLeftRow(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, row: RowData): void {
        const rowEl = container.append("div").classed("row", true).classed("row-parent", row.isParent || false).classed("row-swimlane", row.type === "Swimlane").style("height", `${row.height}px`);
        if (row.type === "Swimlane") {
            rowEl.append("span").classed("row-chevron", true).text(row.collapsed ? "▶" : "▼");
            rowEl.append("span").classed("row-title", true).text(row.name || "");
            rowEl.append("span").classed("row-count", true).text(String(row.childCount || 0));
            rowEl.on("click", () => this.toggleCollapse(`sw-${row.name}`));
        } else if (row.data) {
            rowEl.append("div").classed("row-indicator", true).style("background", this.getColor(row.type));
            if (row.isParent) rowEl.append("span").classed("row-chevron", true).text(row.collapsed ? "▶" : "▼");
            rowEl.append("span").classed("row-id", true).text(String(row.data.workItemId));
            rowEl.append("span").classed("row-title", true).text(row.data.title);
            if (row.isParent) rowEl.on("click", () => this.toggleCollapse(row.data!.id));
            rowEl.on("contextmenu", (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); if (row.data?.selectionId) this.selectionManager.showContextMenu(row.data.selectionId, { x: event.clientX, y: event.clientY }); });
            if (!row.isParent) rowEl.on("click", (event: MouseEvent) => { if (row.data?.selectionId) this.selectionManager.select(row.data.selectionId, event.ctrlKey || event.metaKey); });
        }
    }

    private renderTimelineRow(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, row: RowData, dayWidth: number): void {
        const rowEl = container.append("div").classed("tl-row", true).classed("tl-row-parent", row.isParent || false).classed("tl-row-swimlane", row.type === "Swimlane").style("top", `${row.y}px`).style("height", `${row.height}px`);
        if (row.type === "Swimlane" || !row.data) return;
        const item = row.data, color = this.getColor(row.type);
        if (row.type === "Milestone") {
            if (!item.targetDate) return;
            const x = this.daysBetween(this.viewStart, item.targetDate) * dayWidth, size = BAR_HEIGHT.Milestone;
            const el = rowEl.append("div").classed("milestone", true).style("left", `${x - size/2}px`).style("top", `${(row.height - size)/2}px`).style("width", `${size}px`).style("height", `${size}px`).style("background", color).attr("title", `${item.workItemId}: ${item.title}`);
            this.addBarInteractivity(el, item);
        } else {
            if (!item.startDate || !item.targetDate) return;
            const startX = this.daysBetween(this.viewStart, item.startDate) * dayWidth, endX = this.daysBetween(this.viewStart, item.targetDate) * dayWidth;
            const width = Math.max(endX - startX + dayWidth, 30), barHeight = BAR_HEIGHT[row.type] || BAR_HEIGHT.Feature;
            const bar = rowEl.append("div").classed("bar", true).style("left", `${startX}px`).style("width", `${width}px`).style("height", `${barHeight}px`).style("top", `${(row.height - barHeight)/2}px`).style("background", color).attr("title", `${item.workItemId}: ${item.title}`);
            if (width > 50) bar.append("span").classed("bar-label", true).text(`${item.workItemId} · ${item.title}`);
            this.addBarInteractivity(bar, item);
        }
    }

    private addBarInteractivity(element: d3.Selection<HTMLDivElement, unknown, null, undefined>, item: WorkItem): void {
        element.on("click", (event: MouseEvent) => { event.stopPropagation(); if (item.selectionId) this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey); })
            .on("contextmenu", (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); if (item.selectionId) this.selectionManager.showContextMenu(item.selectionId, { x: event.clientX, y: event.clientY }); });
    }

    private renderMonthHeaders(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
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

    private renderGrid(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, totalDays: number, dayWidth: number): void {
        for (let i = 0; i < totalDays; i++) {
            const date = this.addDays(this.viewStart, i);
            container.append("div").classed("grid-line", true).classed("grid-line-month", date.getDate() === 1).style("left", `${i * dayWidth}px`);
        }
    }

    private renderTodayLine(container: d3.Selection<HTMLDivElement, unknown, null, undefined>, viewEnd: Date, dayWidth: number): void {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (today >= this.viewStart && today <= viewEnd) {
            const line = container.append("div").classed("today-line", true).style("left", `${this.daysBetween(this.viewStart, today) * dayWidth}px`);
            line.append("span").classed("today-label", true).text("TODAY");
        }
    }

    // Safe empty state - NO innerHTML (certification requirement)
    private renderEmptyState(message: string): void {
        const empty = this.container.append("div").classed("empty-state", true);
        empty.append("div").classed("empty-icon", true).text("📊");
        empty.append("div").classed("empty-title", true).text("No Data");
        empty.append("div").classed("empty-text", true).text(message);
        const help = empty.append("div").classed("empty-help", true);
        help.append("span").text("Required: ");
        help.append("strong").text("Work Item ID, Title, Type");
    }

    private toggleCollapse(key: string): void { if (this.collapsed.has(key)) this.collapsed.delete(key); else this.collapsed.add(key); this.host.refreshHostData(); }
    private getColor(type: string): string { return type === "Epic" ? this.settings.epicColor : type === "Milestone" ? this.settings.milestoneColor : this.settings.featureColor; }
    private sanitizeString(str: string): string { return str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : ""; }
    private parseDate(value: any): Date | null { if (!value) return null; const d = new Date(value); d.setHours(0, 0, 0, 0); return isNaN(d.getTime()) ? null : d; }
    private addDays(date: Date, days: number): Date { const r = new Date(date); r.setDate(r.getDate() + days); return r; }
    private daysBetween(start: Date, end: Date): number { return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); }
    public destroy(): void { this.container.selectAll("*").remove(); this.workItems = []; this.collapsed.clear(); }
}
