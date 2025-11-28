import client from './config/typesense';
import { Suggestion } from './generateSuggestions';
import manualOverrides from './manualOverrides.json';

const COLLECTION_NAME = 'search_suggestions';

export async function syncToTypesense(suggestions: Suggestion[]): Promise<void> {
  console.log('Syncing suggestions to Typesense...');

  try {
    // Ensure the collection exists with the correct schema
    await ensureCollection();

    // Wipe existing data
    console.log('Clearing existing suggestions...');
    try {
      await client.collections(COLLECTION_NAME).documents().delete({ filter_by: 'type:!=null' });
    } catch (error: any) {
      if (error.httpStatus !== 404) {
        throw error;
      }
    }

    // Combine generated suggestions with manual overrides
    const allSuggestions = [...suggestions, ...manualOverrides];
    console.log(`Total suggestions to sync: ${allSuggestions.length}`);

    // Import suggestions in batches
    const batchSize = 100;
    for (let i = 0; i < allSuggestions.length; i += batchSize) {
      const batch = allSuggestions.slice(i, i + batchSize);
      
      const documents = batch.map((suggestion, index) => ({
        id: `${i + index + 1}`,
        term: suggestion.term,
        type: suggestion.type,
        boost: suggestion.boost || 10,
        target: suggestion.target || '',
      }));

      await client.collections(COLLECTION_NAME).documents().import(documents, {
        action: 'create',
      });

      console.log(`Imported batch ${Math.floor(i / batchSize) + 1}: ${documents.length} suggestions`);
    }

    console.log('✓ Successfully synced all suggestions to Typesense');
  } catch (error) {
    console.error('Error syncing to Typesense:', error);
    throw error;
  }
}

async function ensureCollection(): Promise<void> {
  try {
    // Check if collection exists
    await client.collections(COLLECTION_NAME).retrieve();
    console.log(`Collection '${COLLECTION_NAME}' already exists`);
  } catch (error: any) {
    if (error.httpStatus === 404) {
      // Create the collection
      console.log(`Creating collection '${COLLECTION_NAME}'...`);
      await client.collections().create({
        name: COLLECTION_NAME,
        fields: [
          { name: 'term', type: 'string' },
          { name: 'type', type: 'string', facet: true },
          { name: 'boost', type: 'int32' },
          { name: 'target', type: 'string' },
        ],
        default_sorting_field: 'boost',
      });
      console.log(`✓ Collection '${COLLECTION_NAME}' created`);
    } else {
      throw error;
    }
  }
}
