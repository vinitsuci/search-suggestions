import client from "./config/typesense";
import { ExtractedAttributes } from "./extractAttributes";

export interface AttributeMappings {
  categories: Map<string, number>;
  subCategories: Map<string, number>;
  occasions: Map<string, number>;
  styles: Map<string, string>;
  collections: Map<string, string>;
}

export async function resolveMappings(
  attributes: ExtractedAttributes,
  collectionName: string
): Promise<AttributeMappings> {
  console.log(`Resolving attribute IDs and slugs for '${collectionName}'...`);

  const mappings: AttributeMappings = {
    categories: new Map(),
    subCategories: new Map(),
    occasions: new Map(),
    styles: new Map(),
    collections: new Map(),
  };

  // 1. Resolve Categories (cId)
  // We can use group_by to get one document per category and extract cId
  try {
    const results = await client
      .collections(collectionName)
      .documents()
      .search({
        q: "*",
        query_by: "category",
        group_by: "category",
        group_limit: 1,
        include_fields: "category,cId",
        per_page: 100, // Assuming < 100 categories
      });

    const groupedHits = (results as any).grouped_hits || [];
    for (const group of groupedHits) {
      if (group.hits && group.hits.length > 0) {
        const doc = group.hits[0].document;
        if (doc.category && doc.cId) {
          mappings.categories.set(doc.category, doc.cId);
        }
      }
    }
    console.log(`Resolved ${mappings.categories.size} category IDs`);
  } catch (e) {
    console.error("Error resolving categories:", e);
  }

  // 2. Resolve Collections (collectionSlug)
  try {
    const results = await client
      .collections(collectionName)
      .documents()
      .search({
        q: "*",
        query_by: "collection",
        group_by: "collection",
        group_limit: 1,
        include_fields: "collection,collectionSlug",
        per_page: 100,
      });

    const groupedHits = (results as any).grouped_hits || [];
    for (const group of groupedHits) {
      if (group.hits && group.hits.length > 0) {
        const doc = group.hits[0].document;
        if (doc.collection && doc.collectionSlug) {
          mappings.collections.set(doc.collection, doc.collectionSlug);
        }
      }
    }
    console.log(`Resolved ${mappings.collections.size} collection slugs`);
  } catch (e) {
    console.error("Error resolving collections:", e);
  }

  // 3. Resolve SubCategories (scId) - using intersection
  console.log("Resolving subCategory IDs...");
  for (const subCat of attributes.subCategories) {
    try {
      const result = await client
        .collections(collectionName)
        .documents()
        .search({
          q: "*",
          filter_by: `subCategory:=${subCat}`,
          include_fields: "scId",
          per_page: 10, // Check a few docs to find intersection
        });

      if (result.hits && result.hits.length > 0) {
        const scIdArrays = result.hits.map(
          (h) => (h.document as any).scId as number[]
        );
        if (scIdArrays.length > 0) {
          // Find intersection
          let intersection = scIdArrays[0];
          for (let i = 1; i < scIdArrays.length; i++) {
            intersection = intersection.filter((id) =>
              scIdArrays[i].includes(id)
            );
          }

          if (intersection.length > 0) {
            // Use the first matching ID from intersection
            mappings.subCategories.set(subCat, intersection[0]);
          }
        }
      }
    } catch (e) {
      console.error(`Error resolving subCategory ${subCat}:`, e);
    }
  }
  console.log(`Resolved ${mappings.subCategories.size} subCategory IDs`);

  // 4. Resolve Occasions (oId) - using intersection
  console.log("Resolving occasion IDs...");
  for (const occasion of attributes.occasions) {
    try {
      const result = await client
        .collections(collectionName)
        .documents()
        .search({
          q: "*",
          filter_by: `occasion:=${occasion}`,
          include_fields: "oId",
          per_page: 10,
        });

      if (result.hits && result.hits.length > 0) {
        const oIdArrays = result.hits.map(
          (h) => (h.document as any).oId as number[]
        );
        if (oIdArrays.length > 0) {
          let intersection = oIdArrays[0];
          for (let i = 1; i < oIdArrays.length; i++) {
            intersection = intersection.filter((id) =>
              oIdArrays[i].includes(id)
            );
          }

          if (intersection.length > 0) {
            mappings.occasions.set(occasion, intersection[0]);
          }
        }
      }
    } catch (e) {
      console.error(`Error resolving occasion ${occasion}:`, e);
    }
  }
  console.log(`Resolved ${mappings.occasions.size} occasion IDs`);

  // 5. Resolve Styles (styleIds) - using intersection
  console.log("Resolving style IDs...");
  for (const style of attributes.styles) {
    try {
      const result = await client
        .collections(collectionName)
        .documents()
        .search({
          q: "*",
          filter_by: `style:=${style}`,
          include_fields: "styleIds",
          per_page: 10,
        });

      if (result.hits && result.hits.length > 0) {
        const styleIdArrays = result.hits
          .map((h) => (h.document as any).styleIds)
          .filter(
            (ids) => ids !== undefined && ids !== null && Array.isArray(ids)
          ) as string[][];

        if (styleIdArrays.length > 0 && styleIdArrays[0]) {
          let intersection = styleIdArrays[0];
          for (let i = 1; i < styleIdArrays.length; i++) {
            if (styleIdArrays[i]) {
              intersection = intersection.filter((id) =>
                styleIdArrays[i].includes(id)
              );
            }
          }

          if (intersection && intersection.length > 0) {
            mappings.styles.set(style, intersection[0]);
          }
        }
      }
    } catch (e) {
      console.error(`Error resolving style ${style}:`, e);
    }
  }
  console.log(`Resolved ${mappings.styles.size} style IDs`);

  return mappings;
}
