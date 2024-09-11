// types.ts
export interface CartItem {
  id: number;
  productName: string;
  productPrice: number;
  quantity?: number;
  weight?: number;
  bulk: boolean;
  imageUrl: string;
}

export interface Product {
  id: number;
  productName: string;
  description: string;
  productPrice: number;
  imageUrl: string;
  bulk: boolean;
  quantidade: number | null;
  peso?: number;  // Opcional, para produtos a granel
  productQuantity?: number;
  estoquePeso: number;
  categoryId: number;
}

export interface Category {
  id: number;
  categoryName: string;
}
