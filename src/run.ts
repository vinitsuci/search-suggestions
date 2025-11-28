import { extractAttributes } from './extractAttributes';
import { generateSuggestions } from './generateSuggestions';
import { syncToTypesense } from './syncToTypesense';
import manualOverrides from './manualOverrides.json';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { exec } from 'child_process';

const PORT = 8081;

function startServer() {
  const server = http.createServer((req, res) => {
    const filePath = req.url === '/' ? '/index.html' : req.url!;
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(__dirname, '..', safePath);

    const extname = path.extname(fullPath);
    let contentType = 'text/html';
    switch (extname) {
      case '.json':
        contentType = 'application/json';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'text/javascript';
        break;
    }

    fs.readFile(fullPath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}/`);
    openBrowser(`http://localhost:${PORT}/`);
  });
}

function openBrowser(url: string) {
  const start =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} ${url}`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--serve') ? 'serve' : args.includes('--sync') ? 'sync' : 'generate';

  console.log(`=== Starting Suggestion Service (${mode} mode) ===\n`);

  try {
    if (mode === 'serve') {
      // Check if suggestions exist
      const outputPath = path.join(__dirname, '..', 'suggestions-output.json');
      if (!fs.existsSync(outputPath)) {
        console.log('⚠️ suggestions-output.json not found. Generating first...');
        await runGeneration();
      }
      startServer();
    } else if (mode === 'sync') {
      const suggestions = await runGeneration();
      console.log('Syncing to Typesense...');
      await syncToTypesense(suggestions);
      console.log('');
      console.log('=== Suggestion Service Completed Successfully ===');
      process.exit(0);
    } else {
      // Generate mode
      await runGeneration();
      console.log('=== Suggestions Generated Successfully ===');
      console.log('💡 Run "npm run dev" to view suggestions in the UI');
      console.log('💡 Run "npm run sync" to push to Typesense\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n=== Error in Suggestion Service ===');
    console.error(error);
    process.exit(1);
  }
}

async function runGeneration() {
  // Step 1: Extract unique attributes via faceting (efficient)
  const attributes = await extractAttributes();
  console.log('');

  // Step 2: Generate suggestions with faceted validation (no full product loading!)
  const generatedSuggestions = await generateSuggestions(attributes);
  console.log('');

  // Step 3: Combine with manual overrides
  const allSuggestions = [...generatedSuggestions, ...manualOverrides];
  console.log(`Total suggestions (including manual overrides): ${allSuggestions.length}\n`);

  // Step 4: Write to output file for review
  const outputPath = path.join(__dirname, '..', 'suggestions-output.json');
  fs.writeFileSync(outputPath, JSON.stringify(allSuggestions, null, 2));
  console.log(`✓ Suggestions written to: ${outputPath}\n`);

  return generatedSuggestions;
}

main();
