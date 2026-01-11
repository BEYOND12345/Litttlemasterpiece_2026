const GELATO_ORDER_API_BASE_URL = 'https://order.gelatoapis.com/v4';
const GELATO_ECOMMERCE_API_BASE_URL = 'https://ecommerce.gelatoapis.com/v1';
const GELATO_API_KEY = import.meta.env.VITE_GELATO_API_KEY;
const GELATO_STORE_ID = import.meta.env.VITE_GELATO_STORE_ID;

export interface GelatoProduct {
  uid: string;
  title: string;
  description: string;
  productType: string;
  variants: GelatoVariant[];
}

export interface GelatoVariant {
  uid: string;
  title: string;
  price: {
    amount: string;
    currency: string;
  };
  attributes: {
    color?: string;
    size?: string;
    material?: string;
  };
}

export interface GelatoOrderRequest {
  orderReferenceId: string;
  customerReferenceId?: string;
  orderType: 'order' | 'draft';
  items: GelatoOrderItem[];
  shipmentMethodUid?: string;
  shippingAddress: GelatoAddress;
  returnAddress?: GelatoAddress;
  billingEntity?: string;
}

export interface GelatoOrderItem {
  itemReferenceId: string;
  productUid: string;
  fileUrl: string;
  quantity: number;
}

export interface GelatoAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postCode: string;
  state?: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface GelatoOrderResponse {
  id: string;
  orderReferenceId: string;
  status: string;
  items: Array<{
    id: string;
    itemReferenceId: string;
    status: string;
  }>;
  createdAt: string;
}

export interface GelatoQuoteRequest {
  items: Array<{
    productUid: string;
    quantity: number;
  }>;
  shippingAddress: {
    country: string;
    state?: string;
  };
}

export interface GelatoQuoteResponse {
  currency: string;
  items: Array<{
    productUid: string;
    price: string;
  }>;
  shipping: {
    price: string;
  };
  total: string;
}

const gelatoFetch = async (
  endpoint: string,
  options: RequestInit = {},
  useEcommerceApi: boolean = false
): Promise<any> => {
  if (!GELATO_API_KEY) {
    throw new Error('Gelato API key is not configured');
  }

  const baseUrl = useEcommerceApi ? GELATO_ECOMMERCE_API_BASE_URL : GELATO_ORDER_API_BASE_URL;
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'X-API-KEY': GELATO_API_KEY,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Gelato API Error: ${response.status} - ${errorData.message || response.statusText}`
    );
  }

  return response.json();
};

export const getGelatoProducts = async (): Promise<GelatoProduct[]> => {
  return gelatoFetch('/products');
};

export const getGelatoProduct = async (productUid: string): Promise<GelatoProduct> => {
  return gelatoFetch(`/products/${productUid}`);
};

export const createGelatoQuote = async (
  quoteRequest: GelatoQuoteRequest
): Promise<GelatoQuoteResponse> => {
  return gelatoFetch('/quotes', {
    method: 'POST',
    body: JSON.stringify(quoteRequest),
  });
};

export const createGelatoOrder = async (
  orderRequest: GelatoOrderRequest
): Promise<GelatoOrderResponse> => {
  return gelatoFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(orderRequest),
  });
};

export const getGelatoOrder = async (orderId: string): Promise<GelatoOrderResponse> => {
  return gelatoFetch(`/orders/${orderId}`);
};

export const getGelatoOrderByReference = async (
  orderReferenceId: string
): Promise<GelatoOrderResponse> => {
  return gelatoFetch(`/orders/reference/${orderReferenceId}`);
};

export interface GelatoTemplateProductRequest {
  templateId: string;
  title: string;
  description?: string;
  imagePlaceholders: Record<string, string>;
}

export interface GelatoTemplateProductResponse {
  id: string;
  title: string;
  status: string;
  previewUrl?: string;
  variants: Array<{
    id: string;
    mockupUrl?: string;
  }>;
}

export const createProductFromTemplate = async (
  storeId: string,
  templateId: string,
  title: string,
  artworkUrl: string,
  placeholderName: string = 'artwork',
  description?: string
): Promise<GelatoTemplateProductResponse> => {
  if (!storeId) {
    throw new Error('Gelato Store ID is not configured');
  }

  const requestBody = {
    templateId,
    title,
    description: description || title,
    imagePlaceholders: {
      [placeholderName]: artworkUrl,
    },
  };

  const response = await gelatoFetch(
    `/stores/${storeId}/products:create-from-template`,
    {
      method: 'POST',
      body: JSON.stringify(requestBody),
    },
    true
  );

  return response;
};

export const getGelatoTemplate = async (
  templateId: string
): Promise<any> => {
  return gelatoFetch(`/templates/${templateId}`, {}, true);
};

export const listGelatoTemplates = async (): Promise<any[]> => {
  const response = await gelatoFetch('/templates', {}, true);
  return response.templates || [];
};

export interface MockupPreviewRequest {
  productUid: string;
  artworkUrl: string;
  variantAttributes?: {
    color?: string;
    size?: string;
  };
}

export interface MockupPreviewResponse {
  mockupUrl: string;
  productUid: string;
  previewId: string;
}

export const generateMockupPreview = async (
  productUid: string,
  artworkUrl: string
): Promise<string | null> => {
  if (!GELATO_API_KEY) {
    console.warn('Gelato API key not configured');
    return null;
  }

  try {
    // Use Gelato's preview/mockup endpoint
    const response = await fetch('https://product.gelatoapis.com/v3/previews', {
      method: 'POST',
      headers: {
        'X-API-KEY': GELATO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productUid: productUid,
        files: [
          {
            url: artworkUrl,
            type: 'default'
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gelato preview API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('Gelato preview response:', data);

    // Return the preview URL from the response
    return data.previewUrl || data.url || null;
  } catch (error) {
    console.error('Failed to generate Gelato mockup preview:', error);
    return null;
  }
};

export const getProductMockupUrl = async (
  storeId: string,
  productId: string
): Promise<string | null> => {
  try {
    const product = await gelatoFetch(
      `/stores/${storeId}/products/${productId}`,
      {},
      true
    );

    if (product.variants && product.variants.length > 0) {
      return product.variants[0].mockupUrl || product.previewUrl || null;
    }

    return null;
  } catch (error) {
    console.error('Failed to get product mockup URL:', error);
    return null;
  }
};
