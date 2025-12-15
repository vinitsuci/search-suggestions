import client from './src/config/typesense';

async function resolveIds() {
  try {
    // Test for subCategory
    const subCategories = ['ENGAGEMENT', 'PLATINUM']; // Example values
    
    for (const subCat of subCategories) {
      const result = await client.collections('consumer-products').documents().search({
        q: '*',
        filter_by: `subCategory:=${subCat}`,
        per_page: 5, // Fetch 5 docs
      });

      if (result.hits && result.hits.length > 0) {
        // Get scId arrays from all hits
        const scIdArrays = result.hits.map(h => (h.document as any).scId as number[]);
        
        // Find intersection
        if (scIdArrays.length > 0) {
          let intersection = scIdArrays[0];
          for (let i = 1; i < scIdArrays.length; i++) {
            intersection = intersection.filter(id => scIdArrays[i].includes(id));
          }
          console.log(`SubCategory: ${subCat} -> ID Candidates: ${intersection}`);
        }
      } else {
        console.log(`No docs for ${subCat}`);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

resolveIds();
