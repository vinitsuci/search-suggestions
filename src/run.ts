import { extractAttributes } from './extractAttributes';
import { generateSuggestions } from './generateSuggestions';
import { syncToTypesense } from './syncToTypesense';
import manualOverrides from './manualOverrides.json';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=== Starting Suggestion Service ===\n');

  const shouldSync = process.argv.includes('--sync');

  try {
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

    // Step 5: Sync to Typesense (only if --sync flag is provided)
    if (shouldSync) {
      console.log('Syncing to Typesense...');
      await syncToTypesense(generatedSuggestions);
      console.log('');
      console.log('=== Suggestion Service Completed Successfully ===');
    } else {
      console.log('=== Suggestions Generated Successfully ===');
      console.log('💡 Review suggestions-output.json');
      console.log('💡 Run with --sync flag to push to Typesense: npm run dev -- --sync\n');
    }
  } catch (error) {
    console.error('\n=== Error in Suggestion Service ===');
    console.error(error);
    process.exit(1);
  }
}

main();
