export interface CollectionConfig {
  sourceCollection: string;
  outputCollection: string;
  outputFile: string;
}

// Custom mappings for output collection names
// If a source collection is listed here, it will use the custom output collection name
// Otherwise, it will auto-generate: search_suggestions_{sourceCollection}
const CUSTOM_OUTPUT_COLLECTIONS: Record<string, string> = {
  'store-products': 'store_search_suggestions',
};

export function getCollectionConfig(sourceCollection: string): CollectionConfig {
  // Check if there's a custom output collection name
  const outputCollection = CUSTOM_OUTPUT_COLLECTIONS[sourceCollection] 
    || `search_suggestions_${sourceCollection.replace(/-/g, '_')}`;
  
  return {
    sourceCollection,
    outputCollection,
    outputFile: `suggestions-output-${sourceCollection}.json`
  };
}

