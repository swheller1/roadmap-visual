/**
 * Professional Documentation PDF Generator
 * Clean, minimal design for client-releasable documents
 */

const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const { marked } = require('marked');

const PAGE = {
    width: 210,
    height: 297,
    margin: { top: 20, bottom: 20, left: 25, right: 25 }
};

class DocumentGenerator {
    constructor() {
        this.doc = null;
        this.y = 0;
        this.pageNum = 0;
        this.title = '';
        this.subtitle = '';
    }

    get width() {
        return PAGE.width - PAGE.margin.left - PAGE.margin.right;
    }

    get bottomLimit() {
        return PAGE.height - PAGE.margin.bottom - 10;
    }

    create(title, subtitle) {
        this.doc = new jsPDF({ unit: 'mm', format: 'a4' });
        this.title = title;
        this.subtitle = subtitle;
        this.pageNum = 0;
        return this;
    }

    // Cover page - clean and professional
    coverPage() {
        // Title area - positioned in upper third
        this.doc.setFontSize(32);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 30, 30);

        const titleLines = this.doc.splitTextToSize(this.title, this.width);
        let y = 80;
        titleLines.forEach(line => {
            this.doc.text(line, PAGE.margin.left, y);
            y += 14;
        });

        // Subtitle
        if (this.subtitle) {
            this.doc.setFontSize(18);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(80, 80, 80);
            this.doc.text(this.subtitle, PAGE.margin.left, y + 8);
        }

        // Simple line separator
        this.doc.setDrawColor(200, 200, 200);
        this.doc.setLineWidth(0.5);
        this.doc.line(PAGE.margin.left, y + 25, PAGE.margin.left + 60, y + 25);

        // Document metadata at bottom
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(100, 100, 100);

        const meta = [
            `Version 1.0.0`,
            new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
        ];

        let metaY = PAGE.height - 50;
        meta.forEach(line => {
            this.doc.text(line, PAGE.margin.left, metaY);
            metaY += 6;
        });

        return this;
    }

    // Start content pages
    startContent() {
        this.nextPage();
        return this;
    }

    nextPage() {
        this.doc.addPage();
        this.pageNum++;
        this.y = PAGE.margin.top + 5;

        // Page number at bottom
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(150, 150, 150);
        this.doc.text(String(this.pageNum), PAGE.width / 2, PAGE.height - 10, { align: 'center' });
    }

    needsNewPage(height = 15) {
        if (this.y + height > this.bottomLimit) {
            this.nextPage();
            return true;
        }
        return false;
    }

    // Section heading
    heading(text, level) {
        const sizes = { 1: 16, 2: 13, 3: 11, 4: 10 };
        const spacing = { 1: 12, 2: 10, 3: 8, 4: 6 };

        this.needsNewPage(spacing[level] + 12);
        this.y += spacing[level] || 8;

        this.doc.setFontSize(sizes[level] || 10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 30, 30);

        const lines = this.doc.splitTextToSize(text, this.width);
        lines.forEach(line => {
            this.doc.text(line, PAGE.margin.left, this.y);
            this.y += (sizes[level] || 10) * 0.5;
        });

        this.y += 4;
        return this;
    }

    // Paragraph text
    paragraph(text) {
        if (!text?.trim()) return this;

        text = this.clean(text);
        this.needsNewPage(8);

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(50, 50, 50);

        const lines = this.doc.splitTextToSize(text, this.width);
        lines.forEach(line => {
            this.needsNewPage(5);
            this.doc.text(line, PAGE.margin.left, this.y);
            this.y += 5;
        });

        this.y += 3;
        return this;
    }

    // Bullet list
    bullets(items, numbered = false) {
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(50, 50, 50);

        items.forEach((item, i) => {
            this.needsNewPage(6);

            const text = this.clean(item);
            const marker = numbered ? `${i + 1}.` : '•';
            const indent = 8;

            this.doc.text(marker, PAGE.margin.left, this.y);

            const lines = this.doc.splitTextToSize(text, this.width - indent);
            lines.forEach((line, j) => {
                if (j > 0) this.needsNewPage(5);
                this.doc.text(line, PAGE.margin.left + indent, this.y);
                this.y += 5;
            });
        });

        this.y += 3;
        return this;
    }

    // Table
    table(headers, rows) {
        const colWidths = this.columnWidths(headers, rows);
        const rowH = 7;
        const headerH = 8;

        this.needsNewPage(headerH + rowH * 2);

        // Header row
        let x = PAGE.margin.left;
        this.doc.setFillColor(245, 245, 245);
        this.doc.rect(PAGE.margin.left, this.y - 5, this.width, headerH, 'F');

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 30, 30);

        headers.forEach((h, i) => {
            this.doc.text(this.truncate(h, colWidths[i] - 3), x + 2, this.y);
            x += colWidths[i];
        });

        this.y += headerH;

        // Data rows
        this.doc.setFont('helvetica', 'normal');

        rows.forEach((row, ri) => {
            this.needsNewPage(rowH);

            // Alternate row shading
            if (ri % 2 === 1) {
                this.doc.setFillColor(250, 250, 250);
                this.doc.rect(PAGE.margin.left, this.y - 5, this.width, rowH, 'F');
            }

            x = PAGE.margin.left;
            row.forEach((cell, ci) => {
                let text = this.clean(cell || '');

                // Status coloring
                if (/PASS|COMPLIANT|✓|YES/i.test(text)) {
                    this.doc.setTextColor(34, 120, 60);
                } else if (/FAIL|NOT\s|NO$/i.test(text)) {
                    this.doc.setTextColor(180, 40, 40);
                } else if (/PARTIAL|NEEDS/i.test(text)) {
                    this.doc.setTextColor(160, 120, 0);
                } else {
                    this.doc.setTextColor(50, 50, 50);
                }

                this.doc.text(this.truncate(text, colWidths[ci] - 3), x + 2, this.y);
                x += colWidths[ci];
            });

            this.y += rowH;
        });

        // Bottom line
        this.doc.setDrawColor(220, 220, 220);
        this.doc.setLineWidth(0.2);
        this.doc.line(PAGE.margin.left, this.y - 3, PAGE.margin.left + this.width, this.y - 3);

        this.y += 6;
        return this;
    }

    // Code block
    code(text, lang = '') {
        const lines = text.split('\n');
        const lineH = 4;
        const padding = 5;
        const blockH = Math.min(lines.length * lineH + padding * 2, 80);

        this.needsNewPage(blockH + 4);

        // Background
        this.doc.setFillColor(248, 248, 248);
        this.doc.setDrawColor(230, 230, 230);
        this.doc.setLineWidth(0.3);
        this.doc.roundedRect(PAGE.margin.left, this.y - 2, this.width, blockH, 1, 1, 'FD');

        this.doc.setFontSize(8);
        this.doc.setFont('courier', 'normal');
        this.doc.setTextColor(60, 60, 60);

        this.y += padding;

        lines.forEach((line, i) => {
            if (this.y > this.bottomLimit - 5) return;
            this.doc.text(line.substring(0, 95), PAGE.margin.left + 4, this.y);
            this.y += lineH;
        });

        this.y += padding + 4;
        return this;
    }

    // Horizontal rule
    rule() {
        this.y += 4;
        this.doc.setDrawColor(220, 220, 220);
        this.doc.setLineWidth(0.3);
        this.doc.line(PAGE.margin.left, this.y, PAGE.margin.left + this.width, this.y);
        this.y += 6;
        return this;
    }

    // Utilities
    clean(text) {
        if (!text) return '';
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .trim();
    }

    truncate(text, maxW) {
        if (!text) return '';
        const max = Math.floor(maxW / 1.8);
        return text.length > max ? text.substring(0, max - 1) + '…' : text;
    }

    columnWidths(headers, rows) {
        const widths = headers.map((h, i) => {
            let max = h.length;
            rows.forEach(r => {
                if (r[i]) max = Math.max(max, String(r[i]).length);
            });
            return max;
        });

        const total = widths.reduce((a, b) => a + b, 0);
        return widths.map(w => Math.max((w / total) * this.width, 20));
    }

    // Parse markdown content
    parse(markdown) {
        const tokens = marked.lexer(markdown);
        let skipFirst = true;

        tokens.forEach(token => {
            switch (token.type) {
                case 'heading':
                    if (skipFirst && token.depth === 1) {
                        skipFirst = false;
                        return;
                    }
                    this.heading(token.text, token.depth);
                    break;

                case 'paragraph':
                    this.paragraph(token.text);
                    break;

                case 'list':
                    this.bullets(token.items.map(i => i.text), token.ordered);
                    break;

                case 'code':
                    this.code(token.text, token.lang);
                    break;

                case 'table':
                    this.table(
                        token.header.map(h => h.text),
                        token.rows.map(r => r.map(c => c.text))
                    );
                    break;

                case 'hr':
                    this.rule();
                    break;

                case 'space':
                    this.y += 2;
                    break;
            }
        });

        return this;
    }

    // Save to file
    save(filename) {
        const outPath = path.join(__dirname, '..', 'docs', filename);
        fs.writeFileSync(outPath, Buffer.from(this.doc.output('arraybuffer')));
        return outPath;
    }
}

// Generate all documents
async function main() {
    console.log('\nGenerating PDF Documentation\n');

    const docsDir = path.join(__dirname, '..', 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const docs = [
        { src: 'USER_MANUAL.md', out: 'Roadmap_Visual_User_Manual.pdf', title: 'Roadmap Visual', sub: 'User Manual' },
        { src: 'TEST_REPORT.md', out: 'Roadmap_Visual_Test_Report.pdf', title: 'Roadmap Visual', sub: 'Test Report' },
        { src: 'SECURITY_AUDIT.md', out: 'Roadmap_Visual_Security_Audit.pdf', title: 'Roadmap Visual', sub: 'Security Audit Report' }
    ];

    for (const d of docs) {
        const srcPath = path.join(__dirname, '..', d.src);
        if (!fs.existsSync(srcPath)) {
            console.log(`  Skip: ${d.src} not found`);
            continue;
        }

        const md = fs.readFileSync(srcPath, 'utf8');

        new DocumentGenerator()
            .create(d.title, d.sub)
            .coverPage()
            .startContent()
            .parse(md)
            .save(d.out);

        console.log(`  Created: ${d.out}`);
    }

    console.log('\nDone.\n');
}

if (require.main === module) {
    main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { DocumentGenerator };
