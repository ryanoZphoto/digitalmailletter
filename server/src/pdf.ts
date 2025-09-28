import puppeteer from 'puppeteer';

export async function htmlToPdfBuffer(html: string) {
  const browser = await puppeteer.launch({ 
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'Letter', 
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

export default { htmlToPdfBuffer };
