import client from "./config/typesense";
import { ExtractedAttributes } from "./extractAttributes";

export interface Suggestion {
  term: string;
  type: string;
  boost?: number;
  target?: string;
}

import { AttributeMappings } from "./resolveMappings";

export async function generateSuggestions(
  attributes: ExtractedAttributes,
  mappings: AttributeMappings,
  collectionName: string
): Promise<Suggestion[]> {
  console.log(`Generating suggestions with faceted validation for '${collectionName}'...`);

  const suggestions: Suggestion[] = [];

  // Helper function to check if products exist for a given filter using faceting
  async function hasProducts(filterBy: string): Promise<boolean> {
    try {
      const result = await client
        .collections(collectionName)
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
      const cId = mappings.categories.get(category);
      suggestions.push({
        term: category,
        type: "category",
        boost: 10,
        target: cId ? `cId:${cId}` : `category:${category}`,
      });
    }
  }

  // 2. Occasion + Category (e.g., "Engagement Rings")
  console.log("Validating occasion + category suggestions...");
  for (const occasion of attributes.occasions) {
    for (const category of attributes.categories) {
      if (await hasProducts(`occasion:=${occasion} && category:=${category}`)) {
        const oId = mappings.occasions.get(occasion);
        const cId = mappings.categories.get(category);
        const occasionPart = oId
          ? `oId:${oId},occasion:${occasion}`
          : `occasion:${occasion}`;
        const categoryPart = cId ? `cId:${cId}` : `category:${category}`;
        suggestions.push({
          term: `${occasion} ${category}`,
          type: "occasion_category",
          boost: 5,
          target: `${occasionPart},${categoryPart}`,
        });
      }
    }
  }

  // 3. Style + Category (e.g., "Solitaire Rings")
  console.log("Validating style + category suggestions...");
  for (const style of attributes.styles) {
    for (const category of attributes.categories) {
      if (await hasProducts(`style:=${style} && category:=${category}`)) {
        const styleId = mappings.styles.get(style);
        const cId = mappings.categories.get(category);
        const stylePart = styleId
          ? `styleId:${styleId},style:${style}`
          : `style:${style}`;
        const categoryPart = cId ? `cId:${cId}` : `category:${category}`;
        suggestions.push({
          term: `${style} ${category}`,
          type: "style_category",
          boost: 5,
          target: `${stylePart},${categoryPart}`,
        });
      }
    }
  }

  // 4. Style only (e.g., "Solitaire", "Eternal")
  console.log("Validating style suggestions...");
  for (const style of attributes.styles) {
    if (await hasProducts(`style:=${style}`)) {
      const styleId = mappings.styles.get(style);
      suggestions.push({
        term: style,
        type: "style",
        boost: 5,
        target: styleId
          ? `styleId:${styleId},style:${style}`
          : `style:${style}`,
      });
    }
  }

  // 5. "<collection> Collection"
  console.log("Validating collection suggestions...");
  for (const collection of attributes.collections) {
    if (await hasProducts(`collection:=${collection}`)) {
      const collectionSlug = mappings.collections.get(collection);
      suggestions.push({
        term: `${collection} Collection`,
        type: "collection",
        boost: 4,
        target: collectionSlug
          ? `collectionSlug:${collectionSlug}`
          : `collection:${collection}`,
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
    const uniqueDisplaynames = new Map<string, string>();
    let page = 1;
    const perPage = 250;

    while (true) {
      const displaynameResults = await client
        .collections(collectionName)
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
            const document = hit.document as {
              displayname?: string;
              slug?: string;
            };
            const displayname = document?.displayname;
            const slug = document?.slug;
            if (
              displayname &&
              typeof displayname === "string" &&
              displayname.trim()
            ) {
              // Store displayname -> slug mapping if slug exists
              // We can't use a simple Set<string> anymore if we want to keep the slug.
              // Let's store objects in a Map to ensure uniqueness by displayname
              if (!uniqueDisplaynames.has(displayname.trim())) {
                uniqueDisplaynames.set(displayname.trim(), slug || "");
              }
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
    for (const [displayname, slug] of uniqueDisplaynames.entries()) {
      suggestions.push({
        term: displayname,
        type: "displayname",
        boost: 9,
        target: slug ? `slug:${slug}` : undefined,
      });
    }
    console.log(`Added ${uniqueDisplaynames.size} displayname suggestions`);
  } catch (error) {
    console.error("Error fetching displaynames:", error);
  }

  console.log(`Generated ${suggestions.length} suggestions`);
  return suggestions;
}
