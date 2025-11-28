import client from './config/typesense';
import { ExtractedAttributes } from './extractAttributes';

export interface Suggestion {
  term: string;
  type: string;
  boost?: number;
  target?: string;
}

export async function generateSuggestions(attributes: ExtractedAttributes): Promise<Suggestion[]> {
  console.log('Generating suggestions with faceted validation...');

  const suggestions: Suggestion[] = [];

  // Helper function to check if products exist for a given filter using faceting
  async function hasProducts(filterBy: string): Promise<boolean> {
    try {
      const result = await client
        .collections('consumer-products')
        .documents()
        .search({
          q: '*',
          query_by: 'displayname',
          filter_by: filterBy,
          per_page: 0,
          page: 1,
        });
      return (result.found || 0) > 0;
    } catch (error) {
      console.error(`Error checking filter: ${filterBy}`, error);
      return false;
    }
  }

  // 1. Category only (e.g., "Rings")
  console.log('Validating category suggestions...');
  for (const category of attributes.categories) {
    if (await hasProducts(`category:=${category}`)) {
      suggestions.push({
        term: category,
        type: 'category',
        boost: 10,
        target: `category:${category}`,
      });
    }
  }

  // 2. Occasion + Category (e.g., "Engagement Rings")
  console.log('Validating occasion + category suggestions...');
  for (const occasion of attributes.occasions) {
    for (const category of attributes.categories) {
      if (await hasProducts(`occasion:=${occasion} && category:=${category}`)) {
        suggestions.push({
          term: `${occasion} ${category}`,
          type: 'occasion_category',
          boost: 15,
          target: `occasion:${occasion},category:${category}`,
        });
      }
    }
  }

  // 3. Metal + Category (e.g., "22kt Yellow Gold Rings")
  console.log('Validating metal + category suggestions...');
  for (const metal of attributes.metals) {
    for (const category of attributes.categories) {
      if (await hasProducts(`metalType:=${metal} && category:=${category}`)) {
        suggestions.push({
          term: `${metal} ${category}`,
          type: 'metal_category',
          boost: 12,
          target: `metalType:${metal},category:${category}`,
        });
      }
    }
  }

  // 4. Style + Category (e.g., "Solitaire Rings")
  console.log('Validating style + category suggestions...');
  for (const style of attributes.styles) {
    for (const category of attributes.categories) {
      if (await hasProducts(`style:=${style} && category:=${category}`)) {
        suggestions.push({
          term: `${style} ${category}`,
          type: 'style_category',
          boost: 13,
          target: `style:${style},category:${category}`,
        });
      }
    }
  }

  // 5. "<collection> Collection"
  console.log('Validating collection suggestions...');
  for (const collection of attributes.collections) {
    if (await hasProducts(`collection:=${collection}`)) {
      suggestions.push({
        term: `${collection} Collection`,
        type: 'collection',
        boost: 14,
        target: `collection:${collection}`,
      });
    }
  }

  // 6. SubCategory suggestions
  console.log('Validating subcategory suggestions...');
  for (const subCategory of attributes.subCategories) {
    if (await hasProducts(`subCategory:=${subCategory}`)) {
      suggestions.push({
        term: subCategory,
        type: 'subcategory',
        boost: 11,
        target: `subCategory:${subCategory}`,
      });
    }
  }

  // 7. Search Tags (popular tags as suggestions)
  console.log('Validating search tag suggestions...');
  for (const tag of attributes.searchTags) {
    if (await hasProducts(`searchTags:=${tag}`)) {
      suggestions.push({
        term: tag,
        type: 'search_tag',
        boost: 9,
        target: `searchTags:${tag}`,
      });
    }
  }

  console.log(`Generated ${suggestions.length} suggestions`);
  return suggestions;
}
