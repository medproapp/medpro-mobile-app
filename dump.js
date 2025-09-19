const fetch = global.fetch;
(async () => {
  try {
    const categoriesRes = await fetch('http://192.168.2.30:3000/pract/getservicecategory');
    const categoriesData = await categoriesRes.json();
    console.log('RAW getServiceCategories:', JSON.stringify(categoriesData, null, 2));
  } catch (err) {
    console.error('Failed to fetch categories', err);
  }

  try {
    const serviceTypesRes = await fetch('http://192.168.2.30:3000/pract/getservicetypes');
    const serviceTypesData = await serviceTypesRes.json();
    console.log('RAW getServiceTypes:', JSON.stringify(serviceTypesData, null, 2));
  } catch (err) {
    console.error('Failed to fetch service types', err);
  }
})();
