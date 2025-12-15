import client from './src/config/typesense';

async function inspectDoc() {
  try {
    const result = await client.collections('consumer-products').documents().search({
      q: '*',
      per_page: 1,
    });
    if (result.hits && result.hits.length > 0) {
      console.log(JSON.stringify(result.hits[0].document, null, 2));
    } else {
      console.log('No documents found');
    }
  } catch (error) {
    console.error(error);
  }
}

inspectDoc();
