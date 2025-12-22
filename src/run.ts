import { extractAttributes } from './extractAttributes';
import { generateSuggestions } from './generateSuggestions';
import { resolveMappings } from './resolveMappings';
import { syncToTypesense } from './syncToTypesense';
import { getCollectionConfig } from './config/collections';
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

  // Extract collection name from args
  const collectionIndex = args.indexOf('--collection');
  const sourceCollection = collectionIndex !== -1 && args[collectionIndex + 1] 
    ? args[collectionIndex + 1] 
    : 'consumer-products'; // default

  const config = getCollectionConfig(sourceCollection);

  console.log(`=== Starting Suggestion Service (${mode} mode) ===`);
  console.log(`Source Collection: ${config.sourceCollection}`);
  console.log(`Output Collection: ${config.outputCollection}`);
  console.log(`Output File: ${config.outputFile}\n`);

  try {
    if (mode === 'serve') {
      // Check if suggestions exist
      const outputPath = path.join(__dirname, '..', config.outputFile);
      if (!fs.existsSync(outputPath)) {
        console.log(`⚠️ ${config.outputFile} not found. Generating first...`);
        await runGeneration(config);
      }
      startServer();
    } else if (mode === 'sync') {
      const suggestions = await runGeneration(config);
      console.log('Syncing to Typesense...');
      await syncToTypesense(suggestions, config.outputCollection);
      console.log('');
      console.log('=== Suggestion Service Completed Successfully ===');
      process.exit(0);
    } else {
      // Generate mode
      await runGeneration(config);
      console.log('=== Suggestions Generated Successfully ===');
      console.log(`💡 Review suggestions in: ${config.outputFile}`);
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

async function runGeneration(config: { sourceCollection: string; outputCollection: string; outputFile: string }) {
  // Step 1: Extract unique attributes via faceting (efficient)
  const attributes = await extractAttributes(config.sourceCollection);
  console.log('');

  // Step 1.5: Resolve IDs and slugs for attributes
  const mappings = await resolveMappings(attributes, config.sourceCollection);
  console.log('');

  // Step 2: Generate suggestions with faceted validation (no full product loading!)
  const generatedSuggestions = await generateSuggestions(attributes, mappings, config.sourceCollection);
  console.log('');

  // Step 3: Combine with manual overrides
  const allSuggestions = [...generatedSuggestions, ...manualOverrides];
  console.log(`Total suggestions (including manual overrides): ${allSuggestions.length}\n`);

  // Step 4: Write to output file for review
  const outputPath = path.join(__dirname, '..', config.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(allSuggestions, null, 2));
  console.log(`✓ Suggestions written to: ${outputPath}\n`);

  return generatedSuggestions;
}

main();
