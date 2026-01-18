/**
 * PDF Documentation Generator
 * Converts markdown documentation to client-releasable PDFs
 */

const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const { marked } = require('marked');

// PDF Configuration
const CONFIG = {
    pageWidth: 210, // A4 width in mm
    pageHeight: 297, // A4 height in mm
    margin: {
        top: 25,
        bottom: 25,
        left: 20,
        right: 20
    },
    fonts: {
        title: { size: 24, style: 'bold' },
        h1: { size: 18, style: 'bold' },
        h2: { size: 14, style: 'bold' },
        h3: { size: 12, style: 'bold' },
        h4: { size: 11, style: 'bold' },
        body: { size: 10, style: 'normal' },
        code: { size: 9, style: 'normal' },
        tableHeader: { size: 9, style: 'bold' },
        tableCell: { size: 9, style: 'normal' },
        footer: { size: 8, style: 'normal' }
    },
    colors: {
        primary: [0, 51, 102],      // Dark blue
        secondary: [51, 51, 51],     // Dark gray
        accent: [0, 102, 153],       // Teal
        success: [34, 139, 34],      // Green
        warning: [220, 38, 38],      // Red
        tableHeader: [240, 240, 240],
        tableBorder: [200, 200, 200],
        codeBg: [245, 245, 245]
    }
};

class PDFGenerator {
    constructor(config = CONFIG) {
        this.config = config;
        this.doc = null;
        this.currentY = 0;
        this.pageNumber = 0;
        this.documentTitle = '';
        this.securityClassification = 'OFFICIAL';
    }

    init(title, classification = 'OFFICIAL') {
        this.doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        this.documentTitle = title;
        this.securityClassification = classification;
        this.currentY = this.config.margin.top;
        this.pageNumber = 1;
        this.addHeader();
        this.addFooter();
    }

    addHeader() {
        const { margin, pageWidth } = this.config;

        // Security classification at top (only if set)
        if (this.securityClassification) {
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(220, 38, 38); // Red
            this.doc.text(this.securityClassification, pageWidth / 2, 10, { align: 'center' });
        }

        // Header line
        this.doc.setDrawColor(0, 51, 102);
        this.doc.setLineWidth(0.5);
        this.doc.line(margin.left, 15, pageWidth - margin.right, 15);
    }

    addFooter() {
        const { margin, pageWidth, pageHeight } = this.config;

        // Footer line
        this.doc.setDrawColor(0, 51, 102);
        this.doc.setLineWidth(0.5);
        this.doc.line(margin.left, pageHeight - 20, pageWidth - margin.right, pageHeight - 20);

        // Page number
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(100, 100, 100);
        this.doc.text(`Page ${this.pageNumber}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

        // Security classification at bottom (only if set)
        if (this.securityClassification) {
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(220, 38, 38);
            this.doc.text(this.securityClassification, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }
    }

    newPage() {
        this.doc.addPage();
        this.pageNumber++;
        this.currentY = this.config.margin.top;
        this.addHeader();
        this.addFooter();
    }

    checkPageBreak(requiredSpace = 20) {
        const { pageHeight, margin } = this.config;
        if (this.currentY + requiredSpace > pageHeight - margin.bottom - 25) {
            this.newPage();
            return true;
        }
        return false;
    }

    getContentWidth() {
        const { pageWidth, margin } = this.config;
        return pageWidth - margin.left - margin.right;
    }

    addTitle(text) {
        this.checkPageBreak(40);
        const { fonts, colors, margin, pageWidth } = this.config;

        this.currentY += 10;
        this.doc.setFontSize(fonts.title.size);
        this.doc.setFont('helvetica', fonts.title.style);
        this.doc.setTextColor(...colors.primary);

        const lines = this.doc.splitTextToSize(text, this.getContentWidth());
        this.doc.text(lines, pageWidth / 2, this.currentY, { align: 'center' });
        this.currentY += lines.length * 10 + 5;

        // Underline
        this.doc.setDrawColor(...colors.primary);
        this.doc.setLineWidth(1);
        this.doc.line(margin.left + 20, this.currentY, pageWidth - margin.right - 20, this.currentY);
        this.currentY += 10;
    }

    addHeading(text, level) {
        const fontConfig = this.config.fonts[`h${level}`] || this.config.fonts.h3;
        const spacing = level === 1 ? 12 : level === 2 ? 8 : 6;

        this.checkPageBreak(spacing + 10);
        this.currentY += spacing;

        this.doc.setFontSize(fontConfig.size);
        this.doc.setFont('helvetica', fontConfig.style);
        this.doc.setTextColor(...this.config.colors.primary);

        const lines = this.doc.splitTextToSize(text, this.getContentWidth());
        this.doc.text(lines, this.config.margin.left, this.currentY);
        this.currentY += lines.length * (fontConfig.size * 0.4) + 3;

        if (level <= 2) {
            this.doc.setDrawColor(...this.config.colors.tableBorder);
            this.doc.setLineWidth(0.3);
            this.doc.line(this.config.margin.left, this.currentY,
                         this.config.margin.left + this.getContentWidth() * 0.3, this.currentY);
            this.currentY += 3;
        }
    }

    addParagraph(text) {
        if (!text || text.trim() === '') return;

        const { fonts, colors, margin } = this.config;

        this.doc.setFontSize(fonts.body.size);
        this.doc.setFont('helvetica', fonts.body.style);
        this.doc.setTextColor(...colors.secondary);

        // Clean up text
        text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markers for plain text
        text = text.replace(/\*(.*?)\*/g, '$1'); // Remove italic markers
        text = text.replace(/`(.*?)`/g, '$1'); // Remove code markers

        const lines = this.doc.splitTextToSize(text, this.getContentWidth());

        for (const line of lines) {
            this.checkPageBreak(6);
            this.doc.text(line, margin.left, this.currentY);
            this.currentY += 5;
        }
        this.currentY += 2;
    }

    addBulletPoint(text, indent = 0) {
        const { fonts, colors, margin } = this.config;

        this.checkPageBreak(6);

        this.doc.setFontSize(fonts.body.size);
        this.doc.setFont('helvetica', fonts.body.style);
        this.doc.setTextColor(...colors.secondary);

        const indentSize = indent * 5;
        const bulletX = margin.left + indentSize;
        const textX = bulletX + 5;

        // Clean up text
        text = text.replace(/\*\*(.*?)\*\*/g, '$1');
        text = text.replace(/\*(.*?)\*/g, '$1');
        text = text.replace(/`(.*?)`/g, '$1');

        // Draw bullet
        this.doc.circle(bulletX + 1, this.currentY - 1.5, 0.8, 'F');

        const lines = this.doc.splitTextToSize(text, this.getContentWidth() - indentSize - 5);
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) this.checkPageBreak(5);
            this.doc.text(lines[i], textX, this.currentY);
            this.currentY += 5;
        }
    }

    addNumberedItem(text, number, indent = 0) {
        const { fonts, colors, margin } = this.config;

        this.checkPageBreak(6);

        this.doc.setFontSize(fonts.body.size);
        this.doc.setFont('helvetica', fonts.body.style);
        this.doc.setTextColor(...colors.secondary);

        const indentSize = indent * 5;
        const numberX = margin.left + indentSize;
        const textX = numberX + 8;

        // Clean up text
        text = text.replace(/\*\*(.*?)\*\*/g, '$1');
        text = text.replace(/\*(.*?)\*/g, '$1');
        text = text.replace(/`(.*?)`/g, '$1');

        // Draw number
        this.doc.text(`${number}.`, numberX, this.currentY);

        const lines = this.doc.splitTextToSize(text, this.getContentWidth() - indentSize - 8);
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) this.checkPageBreak(5);
            this.doc.text(lines[i], textX, this.currentY);
            this.currentY += 5;
        }
    }

    addCodeBlock(code) {
        const { fonts, colors, margin } = this.config;

        const lines = code.split('\n');
        const blockHeight = lines.length * 4 + 6;

        this.checkPageBreak(blockHeight);

        // Background
        this.doc.setFillColor(...colors.codeBg);
        this.doc.roundedRect(margin.left, this.currentY - 2, this.getContentWidth(), blockHeight, 2, 2, 'F');

        // Border
        this.doc.setDrawColor(...colors.tableBorder);
        this.doc.setLineWidth(0.2);
        this.doc.roundedRect(margin.left, this.currentY - 2, this.getContentWidth(), blockHeight, 2, 2, 'S');

        this.currentY += 3;
        this.doc.setFontSize(fonts.code.size);
        this.doc.setFont('courier', fonts.code.style);
        this.doc.setTextColor(50, 50, 50);

        for (const line of lines) {
            const truncatedLine = line.substring(0, 85); // Truncate long lines
            this.doc.text(truncatedLine, margin.left + 3, this.currentY);
            this.currentY += 4;
        }
        this.currentY += 5;
    }

    addTable(headers, rows) {
        const { fonts, colors, margin, pageWidth } = this.config;
        const contentWidth = this.getContentWidth();

        // Calculate column widths based on content
        const colCount = headers.length;
        const colWidths = this.calculateColumnWidths(headers, rows, contentWidth);

        // Draw header
        this.checkPageBreak(12);
        let x = margin.left;
        const headerHeight = 8;

        this.doc.setFillColor(...colors.tableHeader);
        this.doc.rect(margin.left, this.currentY - 5, contentWidth, headerHeight, 'F');

        this.doc.setFontSize(fonts.tableHeader.size);
        this.doc.setFont('helvetica', fonts.tableHeader.style);
        this.doc.setTextColor(...colors.primary);

        for (let i = 0; i < headers.length; i++) {
            const cellText = this.truncateText(headers[i], colWidths[i] - 2);
            this.doc.text(cellText, x + 2, this.currentY);
            x += colWidths[i];
        }
        this.currentY += headerHeight - 2;

        // Draw rows
        this.doc.setFontSize(fonts.tableCell.size);
        this.doc.setFont('helvetica', fonts.tableCell.style);

        for (const row of rows) {
            this.checkPageBreak(8);
            x = margin.left;

            // Row border
            this.doc.setDrawColor(...colors.tableBorder);
            this.doc.setLineWidth(0.1);
            this.doc.line(margin.left, this.currentY - 4, margin.left + contentWidth, this.currentY - 4);

            for (let i = 0; i < row.length; i++) {
                let cellText = row[i] || '';
                // Clean up cell text
                cellText = cellText.replace(/\*\*(.*?)\*\*/g, '$1');
                cellText = cellText.replace(/`(.*?)`/g, '$1');

                // Color status cells
                if (cellText.includes('PASS') || cellText.includes('COMPLIANT') || cellText.includes('✓')) {
                    this.doc.setTextColor(...colors.success);
                } else if (cellText.includes('FAIL') || cellText.includes('NOT')) {
                    this.doc.setTextColor(...colors.warning);
                } else {
                    this.doc.setTextColor(...colors.secondary);
                }

                cellText = this.truncateText(cellText, colWidths[i] - 2);
                this.doc.text(cellText, x + 2, this.currentY);
                x += colWidths[i];
            }
            this.currentY += 6;
        }

        // Bottom border
        this.doc.setDrawColor(...colors.tableBorder);
        this.doc.line(margin.left, this.currentY - 4, margin.left + contentWidth, this.currentY - 4);
        this.currentY += 5;
    }

    calculateColumnWidths(headers, rows, totalWidth) {
        const colCount = headers.length;
        const widths = [];

        for (let i = 0; i < colCount; i++) {
            let maxLen = headers[i].length;
            for (const row of rows) {
                if (row[i]) {
                    maxLen = Math.max(maxLen, row[i].length);
                }
            }
            widths.push(maxLen);
        }

        const totalLen = widths.reduce((a, b) => a + b, 0);
        return widths.map(w => Math.max((w / totalLen) * totalWidth, 20));
    }

    truncateText(text, maxWidth) {
        if (!text) return '';
        const charWidth = 1.8; // Approximate character width in mm
        const maxChars = Math.floor(maxWidth / charWidth);
        if (text.length > maxChars) {
            return text.substring(0, maxChars - 3) + '...';
        }
        return text;
    }

    addHorizontalRule() {
        this.currentY += 5;
        this.doc.setDrawColor(...this.config.colors.tableBorder);
        this.doc.setLineWidth(0.3);
        this.doc.line(this.config.margin.left, this.currentY,
                     this.config.margin.left + this.getContentWidth(), this.currentY);
        this.currentY += 8;
    }

    parseMarkdown(markdown) {
        // Tokenize the markdown
        const tokens = marked.lexer(markdown);
        let listNumber = 0;

        for (const token of tokens) {
            switch (token.type) {
                case 'heading':
                    if (token.depth === 1 && this.currentY < 50) {
                        this.addTitle(token.text);
                    } else {
                        this.addHeading(token.text, token.depth);
                    }
                    listNumber = 0;
                    break;

                case 'paragraph':
                    this.addParagraph(token.text);
                    listNumber = 0;
                    break;

                case 'list':
                    for (let i = 0; i < token.items.length; i++) {
                        const item = token.items[i];
                        if (token.ordered) {
                            this.addNumberedItem(item.text, i + 1);
                        } else {
                            this.addBulletPoint(item.text);
                        }
                    }
                    break;

                case 'code':
                    this.addCodeBlock(token.text);
                    break;

                case 'table':
                    const headers = token.header.map(h => h.text);
                    const rows = token.rows.map(row => row.map(cell => cell.text));
                    this.addTable(headers, rows);
                    break;

                case 'hr':
                    this.addHorizontalRule();
                    break;

                case 'space':
                    this.currentY += 3;
                    break;
            }
        }
    }

    save(filename) {
        const outputPath = path.join(__dirname, '..', 'docs', filename);
        const buffer = Buffer.from(this.doc.output('arraybuffer'));
        fs.writeFileSync(outputPath, buffer);
        console.log(`  ✓ Generated: ${outputPath}`);
        return outputPath;
    }
}

// Generate PDFs for all documentation
async function generateDocumentation() {
    console.log('\n📄 Generating Client Documentation PDFs\n');
    console.log('=' .repeat(50));

    const docsDir = path.join(__dirname, '..', 'docs');
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }

    const documents = [
        {
            source: 'USER_MANUAL.md',
            output: 'Roadmap_Visual_User_Manual.pdf',
            title: 'ROADMAP VISUAL FOR POWER BI - USER MANUAL',
            classification: 'OFFICIAL'
        },
        {
            source: 'TEST_REPORT.md',
            output: 'Roadmap_Visual_Test_Report.pdf',
            title: 'ROADMAP VISUAL - TEST REPORT',
            classification: 'OFFICIAL'
        },
        {
            source: 'SECURITY_AUDIT.md',
            output: 'Roadmap_Visual_Security_Audit.pdf',
            title: 'SECURITY AUDIT REPORT - ROADMAP VISUAL',
            classification: ''
        }
    ];

    const generatedFiles = [];

    for (const doc of documents) {
        console.log(`\n📝 Processing: ${doc.source}`);

        const sourcePath = path.join(__dirname, '..', doc.source);
        if (!fs.existsSync(sourcePath)) {
            console.log(`  ⚠ Source file not found: ${sourcePath}`);
            continue;
        }

        const markdown = fs.readFileSync(sourcePath, 'utf8');

        const generator = new PDFGenerator();
        generator.init(doc.title, doc.classification);
        generator.parseMarkdown(markdown);

        const outputPath = generator.save(doc.output);
        generatedFiles.push(outputPath);
    }

    console.log('\n' + '=' .repeat(50));
    console.log('\n✅ Documentation generation complete!\n');
    console.log('Generated files:');
    generatedFiles.forEach(f => console.log(`  - ${f}`));
    console.log('\nFiles are available in the /docs directory.\n');

    return generatedFiles;
}

// Run if called directly
if (require.main === module) {
    generateDocumentation().catch(err => {
        console.error('Error generating documentation:', err);
        process.exit(1);
    });
}

module.exports = { PDFGenerator, generateDocumentation };
