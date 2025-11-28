import client from './config/typesense';

export interface Product {
  pId: string;
  displayname?: string;
  category?: string;
  metalType?: string;
  style?: string;
  occasion?: string;
  collection?: string;
  subCategory?: string;
  searchTags?: string;
  [key: string]: any;
}

export async function fetchProducts(): Promise<Product[]> {
  console.log('Fetching products from Typesense...');
  
  const products: Product[] = [];
  let page = 1;
  const perPage = 250;
  
  try {
    while (true) {
      const searchResults = await client
        .collections('consumer-products')
        .documents()
        .search({
          q: '*',
          query_by: 'displayname',
          per_page: perPage,
          page: page,
          group_by: 'pId',
          group_limit: 1,
        });

      if (!searchResults.hits || searchResults.hits.length === 0) {
        break;
      }

      const pageProducts = searchResults.hits.map((hit: any) => hit.document as Product);
      products.push(...pageProducts);

      console.log(`Fetched page ${page}: ${pageProducts.length} products`);

      if (searchResults.hits.length < perPage) {
        break;
      }

      page++;
    }

    console.log(`Total products fetched: ${products.length}`);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}
