import client from "./config/typesense";
import { ExtractedAttributes } from "./extractAttributes";

export interface Suggestion {
  term: string;
  type: string;
  boost?: number;
  target?: string;
}

export async function generateSuggestions(
  attributes: ExtractedAttributes
): Promise<Suggestion[]> {
  console.log("Generating suggestions with faceted validation...");

  const suggestions: Suggestion[] = [];

  // Helper function to check if products exist for a given filter using faceting
  async function hasProducts(filterBy: string): Promise<boolean> {
    try {
      const result = await client
        .collections("consumer-products")
        .documents()
        .search({
          q: "*",
          query_by: "displayname",
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
  console.log("Validating category suggestions...");
  for (const category of attributes.categories) {
    if (await hasProducts(`category:=${category}`)) {
      suggestions.push({
        term: category,
        type: "category",
        boost: 10,
        target: `category:${category}`,
      });
    }
  }

  // 2. Occasion + Category (e.g., "Engagement Rings")
  console.log("Validating occasion + category suggestions...");
  for (const occasion of attributes.occasions) {
    for (const category of attributes.categories) {
      if (await hasProducts(`occasion:=${occasion} && category:=${category}`)) {
        suggestions.push({
          term: `${occasion} ${category}`,
          type: "occasion_category",
          boost: 5,
          target: `occasion:${occasion},category:${category}`,
        });
      }
    }
  }

  // 3. Style + Category (e.g., "Solitaire Rings")
  console.log("Validating style + category suggestions...");
  for (const style of attributes.styles) {
    for (const category of attributes.categories) {
      if (await hasProducts(`style:=${style} && category:=${category}`)) {
        suggestions.push({
          term: `${style} ${category}`,
          type: "style_category",
          boost: 5,
          target: `style:${style},category:${category}`,
        });
      }
    }
  }

  // 4. SubCategory + Category (e.g., "Diamond Rings")
  console.log("Validating subcategory + category suggestions...");
  for (const subCategory of attributes.subCategories) {
    for (const category of attributes.categories) {
      if (
        await hasProducts(
          `subCategory:=${subCategory} && category:=${category}`
        )
      ) {
        suggestions.push({
          term: `${subCategory} ${category}`,
          type: "subcategory_category",
          boost: 8,
          target: `subCategory:${subCategory},category:${category}`,
        });
      }
    }
  }

  // 5. "<collection> Collection"
  console.log("Validating collection suggestions...");
  for (const collection of attributes.collections) {
    if (await hasProducts(`collection:=${collection}`)) {
      suggestions.push({
        term: `${collection} Collection`,
        type: "collection",
        boost: 4,
        target: `collection:${collection}`,
      });
    }
  }

  // 6. Search Tags (popular tags as suggestions)
  console.log("Validating search tag suggestions...");
  for (const tag of attributes.searchTags) {
    if (await hasProducts(`searchTags:=${tag}`)) {
      suggestions.push({
        term: tag,
        type: "search_tag",
        boost: 8,
        target: `searchTags:${tag}`,
      });
    }
  }

  // 7. Displaynames (product names as suggestions)
  console.log("Fetching displayname suggestions...");
  try {
    const uniqueDisplaynames = new Set<string>();
    let page = 1;
    const perPage = 250;

    while (true) {
      const displaynameResults = await client
        .collections("consumer-products")
        .documents()
        .search({
          q: "*",
          query_by: "displayname",
          per_page: perPage,
          page: page,
          group_by: "pId",
          group_limit: 1,
        });

      // When using group_by, results are in grouped_hits, not hits
      const groupedHits = (displaynameResults as any).grouped_hits || [];
      if (groupedHits.length === 0) {
        if (page === 1) {
          console.log("No products found with displaynames");
        }
        break;
      }

      // Iterate through each group and extract displaynames from their hits
      for (const group of groupedHits) {
        if (group.hits && Array.isArray(group.hits)) {
          for (const hit of group.hits) {
            const document = hit.document as { displayname?: string };
            const displayname = document?.displayname;
            if (
              displayname &&
              typeof displayname === "string" &&
              displayname.trim()
            ) {
              uniqueDisplaynames.add(displayname.trim());
            }
          }
        }
      }

      const totalHitsInPage = groupedHits.reduce(
        (sum: number, group: any) => sum + (group.hits?.length || 0),
        0
      );
      console.log(
        `Fetched page ${page}: ${groupedHits.length} groups (${totalHitsInPage} products), ${uniqueDisplaynames.size} unique displaynames so far`
      );

      if (groupedHits.length < perPage) {
        break;
      }

      page++;
    }

    // Add all unique displaynames as suggestions
    for (const displayname of Array.from(uniqueDisplaynames)) {
      // For displaynames, we'll search by the displayname itself
      suggestions.push({
        term: displayname,
        type: "displayname",
        boost: 10,
        // No target filter needed - the search will match by displayname
      });
    }
    console.log(`Added ${uniqueDisplaynames.size} displayname suggestions`);
  } catch (error) {
    console.error("Error fetching displaynames:", error);
  }

  console.log(`Generated ${suggestions.length} suggestions`);
  return suggestions;
}
