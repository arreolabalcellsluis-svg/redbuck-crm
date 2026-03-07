// Product image mapping - maps product IDs to their images
export const PRODUCT_IMAGES: Record<string, string> = {
  'p1': '/products/elevador-4-postes.jpg',
  'p2': '/products/elevador-2-postes.jpg',
  'p3': '/products/elevador-tijera.jpg',
  'p4': '/products/balanceadora-auto.jpg',
  'p5': '/products/balanceadora-semi.jpg',
  'p6': '/products/desmontadora-auto.jpg',
  'p7': '/products/desmontadora-semi.jpg',
  'p8': '/products/alineadora-3d.jpg',
  'p9': '/products/alineadora-3d.jpg',
  'p10': '/products/prensa-hidraulica.jpg',
  'p11': '/products/prensa-hidraulica.jpg',
  'p12': '/products/prensa-hidraulica.jpg',
  'p13': '/products/compresor.jpg',
  'p14': '/products/compresor.jpg',
  'p15': '/products/compresor.jpg',
};

export function getProductImage(productId: string): string {
  return PRODUCT_IMAGES[productId] || '/placeholder.svg';
}

export function getProductImageByName(productName: string, products: { id: string; name: string }[]): string {
  const product = products.find(p => productName.toLowerCase().includes(p.name.toLowerCase().split(' ').slice(0, 2).join(' ')));
  return product ? getProductImage(product.id) : '/placeholder.svg';
}
