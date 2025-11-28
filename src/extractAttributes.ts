import client from './config/typesense';

export interface ExtractedAttributes {
  categories: string[];
  subCategories: string[];
  searchTags: string[];
  metals: string[];
  styles: string[];
  occasions: string[];
  collections: string[];
}

export async function extractAttributes(): Promise<ExtractedAttributes> {
  console.log('Extracting unique attributes via faceting...');

  try {
    const searchResults = await client
      .collections('consumer-products')
      .documents()
      .search({
        q: '*',
        query_by: 'category,searchTags,subCategory,occasion,collection,style',
        query_by_weights: '10,8,8,5,4,4',
        facet_by: 'category,subCategory,searchTags,metalType,style,occasion,collection',
        max_facet_values: 999,
        page: 1,
        per_page: 0,
        group_by: 'pId',
        group_limit: 1,
      });

    const facets = searchResults.facet_counts || [];

    const attributes: ExtractedAttributes = {
      categories: extractFacetValues(facets, 'category'),
      subCategories: extractFacetValues(facets, 'subCategory'),
      searchTags: extractFacetValues(facets, 'searchTags'),
      metals: extractFacetValues(facets, 'metalType'),
      styles: extractFacetValues(facets, 'style'),
      occasions: extractFacetValues(facets, 'occasion'),
      collections: extractFacetValues(facets, 'collection'),
    };

    console.log(`Extracted attributes:
  - Categories: ${attributes.categories.length}
  - SubCategories: ${attributes.subCategories.length}
  - Search Tags: ${attributes.searchTags.length}
  - Metals: ${attributes.metals.length}
  - Styles: ${attributes.styles.length}
  - Occasions: ${attributes.occasions.length}
  - Collections: ${attributes.collections.length}`);

    return attributes;
  } catch (error) {
    console.error('Error extracting attributes:', error);
    throw error;
  }
}

function extractFacetValues(facets: any[], fieldName: string): string[] {
  const facet = facets.find((f) => f.field_name === fieldName);
  if (!facet || !facet.counts) {
    return [];
  }
  return facet.counts.map((c: any) => c.value).sort();
}
