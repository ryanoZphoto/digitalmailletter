// Simple PDF generation using a basic approach
// This creates a minimal PDF that Lob can accept

export async function htmlToPdfBuffer(html: string): Promise<Uint8Array> {
  // Extract text content from HTML for a simple PDF
  const textContent = extractTextFromHtml(html);
  
  // Create a simple PDF using a basic PDF structure
  const pdfContent = createSimplePdf(textContent);
  
  return new Uint8Array(Buffer.from(pdfContent, 'binary'));
}

function extractTextFromHtml(html: string): string {
  // Simple HTML to text extraction
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

function createSimplePdf(text: string): string {
  // Create a minimal PDF structure
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const maxLinesPerPage = 50;
  const pages = [];
  
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    const pageLines = lines.slice(i, i + maxLinesPerPage);
    pages.push(pageLines);
  }
  
  let pdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${createPageContent(pages[0] || []).length}
>>
stream
${createPageContent(pages[0] || [])}
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000${String(createPageContent(pages[0] || []).length + 300).padStart(6, '0')} 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
${createPageContent(pages[0] || []).length + 400}
%%EOF`;

  return pdf;
}

function createPageContent(lines: string[]): string {
  let content = 'BT\n';
  content += '/F1 12 Tf\n';
  content += '50 750 Td\n';
  
  lines.forEach((line, index) => {
    if (index > 0) {
      content += '0 -15 Td\n'; // Move to next line
    }
    content += `(${escapePdfString(line)}) Tj\n`;
  });
  
  content += 'ET\n';
  return content;
}

function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ');
}

export default { htmlToPdfBuffer };
