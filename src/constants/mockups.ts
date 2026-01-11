export type ProductType = 'frame' | 'tote' | 'mug' | 'tshirt' | 'phonecase';

export type MockupConfig = {
  id: string;
  productType: ProductType;
  name: string;
  templateImageUrl: string;
  overlayImageUrl?: string;
  artworkArea: {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
    rotationDeg?: number;
  };
  blendMode: 'normal' | 'multiply' | 'screen';
};

export const MOCKUPS: MockupConfig[] = [
  {
    id: 'frame-vertical',
    productType: 'frame',
    name: 'Framed Print',
    templateImageUrl: '/images/mockups/Mockup_LargeFrame_01.jpg',
    artworkArea: {
      xPercent: 30,
      yPercent: 21,
      widthPercent: 40,
      heightPercent: 48,
      rotationDeg: 0,
    },
    blendMode: 'normal',
  },
  {
    id: 'tote-front',
    productType: 'tote',
    name: 'Tote Bag',
    templateImageUrl: '/images/mockups/Mockup_Totebag_01.jpg',
    artworkArea: {
      xPercent: 38,
      yPercent: 52,
      widthPercent: 24,
      heightPercent: 28,
      rotationDeg: 0,
    },
    blendMode: 'multiply',
  },
  {
    id: 'mug-white',
    productType: 'mug',
    name: 'Coffee Mug',
    templateImageUrl: '/images/mockups/Mockup_Coffecup_01.jpg',
    artworkArea: {
      xPercent: 42,
      yPercent: 40,
      widthPercent: 20,
      heightPercent: 28,
      rotationDeg: -8,
    },
    blendMode: 'multiply',
  },
  {
    id: 'tshirt-front',
    productType: 'tshirt',
    name: 'T-Shirt',
    templateImageUrl: '/images/mockups/Mockup_Tshirt_01.jpg',
    artworkArea: {
      xPercent: 41,
      yPercent: 38,
      widthPercent: 18,
      heightPercent: 22,
      rotationDeg: 0,
    },
    blendMode: 'multiply',
  },
  {
    id: 'phonecase-back',
    productType: 'phonecase',
    name: 'Phone Case',
    templateImageUrl: '/images/mockups/Mockup_phonecase_01.jpg',
    artworkArea: {
      xPercent: 40,
      yPercent: 26,
      widthPercent: 20,
      heightPercent: 48,
      rotationDeg: 0,
    },
    blendMode: 'normal',
  },
];

export const getMockupById = (id: string): MockupConfig | undefined => {
  return MOCKUPS.find(m => m.id === id);
};

export const getMockupsByType = (type: ProductType): MockupConfig[] => {
  return MOCKUPS.filter(m => m.productType === type);
};
