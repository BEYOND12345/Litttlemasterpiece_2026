import { cloudinaryService } from '../services/cloudinaryService';
import { supabase } from '../services/supabaseClient';

interface MockupImageMapping {
  localPath: string;
  productType: string;
  name: string;
  placementConfig: {
    width?: string;
    height?: string;
    gravity?: string;
    rotation?: number;
  };
}

const MOCKUP_MAPPINGS: MockupImageMapping[] = [
  {
    localPath: '/large framed rainbow.png',
    productType: 'frame',
    name: 'Framed Art on Wall',
    placementConfig: {
      width: '45%',
      height: '55%',
      gravity: 'center',
    },
  },
  {
    localPath: '/Cup indoors.png',
    productType: 'mug',
    name: 'Ceramic Mug on Table',
    placementConfig: {
      width: '30%',
      height: '35%',
      gravity: 'center',
    },
  },
  {
    localPath: '/dragon tote 1.png',
    productType: 'tote',
    name: 'Tote Bag Display',
    placementConfig: {
      width: '28%',
      height: '32%',
      gravity: 'center',
    },
  },
  {
    localPath: '/tote indoor 2.png',
    productType: 'tote',
    name: 'Tote Bag Indoor Scene',
    placementConfig: {
      width: '25%',
      height: '30%',
      gravity: 'center',
    },
  },
  {
    localPath: '/Phone.png',
    productType: 'phone',
    name: 'Phone Case on Desk',
    placementConfig: {
      width: '18%',
      height: '40%',
      gravity: 'center',
    },
  },
];

async function uploadMockupImages() {
  console.log('Starting mockup image upload process...\n');

  for (const mapping of MOCKUP_MAPPINGS) {
    try {
      console.log(`Processing: ${mapping.name}`);

      const response = await fetch(mapping.localPath);
      if (!response.ok) {
        console.error(`  ❌ Failed to load local file: ${mapping.localPath}`);
        continue;
      }

      const blob = await response.blob();
      const fileName = mapping.localPath.split('/').pop() || 'mockup';
      const file = new File([blob], fileName, { type: blob.type });

      const mockupId = crypto.randomUUID();
      const uploadResult = await cloudinaryService.uploadArtwork(file, `mockup_${mockupId}`);

      console.log(`  ✓ Uploaded to Cloudinary: ${uploadResult.public_id}`);

      const { data, error } = await supabase
        .from('mockup_templates')
        .insert({
          name: mapping.name,
          product_type: mapping.productType,
          cloudinary_public_id: uploadResult.public_id,
          placement_config: mapping.placementConfig,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error(`  ❌ Database insert failed:`, error);
      } else {
        console.log(`  ✓ Created template in database: ${data.id}`);
      }

      console.log('');
    } catch (error) {
      console.error(`  ❌ Error processing ${mapping.name}:`, error);
      console.log('');
    }
  }

  console.log('✅ Mockup upload process complete!');
}

export { uploadMockupImages };
