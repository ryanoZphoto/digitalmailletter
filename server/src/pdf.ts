import puppeteer from 'puppeteer';

export async function htmlToPdfBuffer(html: string) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

export default { htmlToPdfBuffer };
