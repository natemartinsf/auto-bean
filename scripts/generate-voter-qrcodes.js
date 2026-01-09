#!/usr/bin/env node

/**
 * QR Code Generator for People's Choice Beer Voting
 * 
 * Generates unique voter URLs and QR codes for distribution at the event.
 * No database connection required - UUIDs are created lazily on first use.
 * 
 * Usage:
 *   node generate-voter-qrcodes.js [count] [base-url]
 * 
 * Examples:
 *   node generate-voter-qrcodes.js 100 https://beervote.vercel.app
 *   node generate-voter-qrcodes.js 50 http://localhost:5173
 * 
 * Output:
 *   - ./qrcodes/voter-cards.html (printable sheet of all QR codes)
 *   - ./qrcodes/individual/*.png (individual QR code images)
 *   - ./qrcodes/voter-urls.csv (list of all generated URLs)
 * 
 * Dependencies:
 *   npm install qrcode uuid
 */

import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// Configuration
const DEFAULT_COUNT = 100;
const DEFAULT_BASE_URL = 'https://beervote.vercel.app';
const OUTPUT_DIR = './qrcodes';
const INDIVIDUAL_DIR = join(OUTPUT_DIR, 'individual');

// Parse command line arguments
const count = parseInt(process.argv[2]) || DEFAULT_COUNT;
const baseUrl = process.argv[3] || DEFAULT_BASE_URL;

async function generateVoterCodes() {
  console.log(`Generating ${count} voter QR codes for ${baseUrl}...\n`);

  // Create output directories
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(INDIVIDUAL_DIR, { recursive: true });

  const voters = [];

  // Generate UUIDs and QR codes
  for (let i = 0; i < count; i++) {
    const uuid = randomUUID();
    const url = `${baseUrl}/vote/${uuid}`;
    const cardNumber = String(i + 1).padStart(3, '0');

    voters.push({ cardNumber, uuid, url });

    // Generate individual PNG
    await QRCode.toFile(
      join(INDIVIDUAL_DIR, `voter-${cardNumber}.png`),
      url,
      {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      }
    );

    if ((i + 1) % 10 === 0) {
      console.log(`  Generated ${i + 1}/${count} codes...`);
    }
  }

  // Generate CSV of all URLs
  const csvContent = [
    'card_number,uuid,url',
    ...voters.map(v => `${v.cardNumber},${v.uuid},${v.url}`)
  ].join('\n');
  
  await writeFile(join(OUTPUT_DIR, 'voter-urls.csv'), csvContent);

  // Generate printable HTML
  const htmlContent = generatePrintableHTML(voters);
  await writeFile(join(OUTPUT_DIR, 'voter-cards.html'), htmlContent);

  console.log(`\n✓ Complete! Output files:`);
  console.log(`  ${OUTPUT_DIR}/voter-cards.html  - Printable card sheet`);
  console.log(`  ${OUTPUT_DIR}/voter-urls.csv    - URL reference list`);
  console.log(`  ${OUTPUT_DIR}/individual/       - Individual PNG files`);
}

function generatePrintableHTML(voters) {
  // Generate QR code data URLs for embedding
  const generateQRDataURL = async (url) => {
    return await QRCode.toDataURL(url, { width: 200, margin: 1 });
  };

  // Since we need async for data URLs, we'll use individual files in the HTML
  // and reference them relatively
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>People's Choice Voting Cards</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .page {
      width: 8.5in;
      padding: 0.25in;
      page-break-after: always;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(4, 1fr);
      gap: 0.125in;
      height: 10.5in;
    }
    
    .card {
      border: 1px dashed #ccc;
      border-radius: 8px;
      padding: 0.15in;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    
    .card img {
      width: 1.4in;
      height: 1.4in;
    }
    
    .card-title {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 4px;
      color: #333;
    }
    
    .card-subtitle {
      font-size: 8px;
      color: #666;
      margin-bottom: 6px;
    }
    
    .card-number {
      font-size: 8px;
      color: #999;
      margin-top: 4px;
    }
    
    .card-instructions {
      font-size: 7px;
      color: #666;
      margin-top: 4px;
      line-height: 1.3;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; }
      .card { border: 1px dashed #ccc; }
    }
    
    @page {
      size: letter;
      margin: 0;
    }
  </style>
</head>
<body>
${generatePages(voters)}
</body>
</html>`;
}

function generatePages(voters) {
  const cardsPerPage = 12; // 3 columns x 4 rows
  const pages = [];
  
  for (let i = 0; i < voters.length; i += cardsPerPage) {
    const pageVoters = voters.slice(i, i + cardsPerPage);
    pages.push(`
  <div class="page">
    <div class="grid">
${pageVoters.map(v => `      <div class="card">
        <div class="card-title">🍺 People's Choice</div>
        <div class="card-subtitle">Bay Area Mashers</div>
        <img src="individual/voter-${v.cardNumber}.png" alt="QR Code ${v.cardNumber}">
        <div class="card-instructions">Scan to vote for your<br>favorite beers!</div>
        <div class="card-number">#${v.cardNumber}</div>
      </div>`).join('\n')}
    </div>
  </div>`);
  }
  
  return pages.join('\n');
}

// Run the generator
generateVoterCodes().catch(console.error);
