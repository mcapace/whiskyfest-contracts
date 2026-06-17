import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = path.resolve(__dirname, '../docs/nywe-susannah-cheat-sheet.html');
const pdf = path.resolve(__dirname, '../docs/nywe-susannah-cheat-sheet.pdf');

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`file://${html}`, { waitUntil: 'networkidle0' });
await page.pdf({
  path: pdf,
  format: 'Letter',
  printBackground: true,
  margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
});
await browser.close();
console.log('Wrote', pdf);
