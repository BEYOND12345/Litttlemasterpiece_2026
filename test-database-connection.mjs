import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bhltnhutjgyzvbcsjitp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobHRuaHV0amd5enZiY3NqaXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzA2NzcsImV4cCI6MjA4MTMwNjY3N30.896dczsNgywyT3E4aUItUWUdZs5g-e05ihhaI8lFKhc';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Testing Supabase Connection...\n');

// Test 1: Check products table
console.log('📦 Testing Products Table:');
const { data: products, error: productsError } = await supabase
  .from('products')
  .select('id, name, type')
  .limit(5);

if (productsError) {
  console.log('❌ Products query failed:', productsError.message);
} else {
  console.log(`✅ Products query succeeded - Found ${products.length} products`);
  if (products.length > 0) {
    products.forEach(p => console.log(`   - ${p.name} (${p.type})`));
  }
}

// Test 2: Check product_variants table
console.log('\n🎨 Testing Product Variants Table:');
const { data: variants, error: variantsError } = await supabase
  .from('product_variants')
  .select('id, name, size')
  .limit(5);

if (variantsError) {
  console.log('❌ Product variants query failed:', variantsError.message);
} else {
  console.log(`✅ Product variants query succeeded - Found ${variants.length} variants`);
}

// Test 3: Check cart_items table
console.log('\n🛒 Testing Cart Items Table:');
const { data: cartItems, error: cartError } = await supabase
  .from('cart_items')
  .select('id')
  .limit(1);

if (cartError) {
  console.log('❌ Cart items query failed:', cartError.message);
  if (cartError.code === '42P01') {
    console.log('   ℹ️  Table does not exist - needs to be created');
  }
} else {
  console.log(`✅ Cart items table exists - Found ${cartItems.length} items`);
}

// Test 4: Check artworks table
console.log('\n🎨 Testing Artworks Table:');
const { data: artworks, error: artworksError } = await supabase
  .from('artworks')
  .select('id, title')
  .limit(5);

if (artworksError) {
  console.log('❌ Artworks query failed:', artworksError.message);
} else {
  console.log(`✅ Artworks query succeeded - Found ${artworks.length} artworks`);
}

// Test 5: Check orders table
console.log('\n📦 Testing Orders Table:');
const { data: orders, error: ordersError } = await supabase
  .from('orders')
  .select('id, status')
  .limit(5);

if (ordersError) {
  console.log('❌ Orders query failed:', ordersError.message);
} else {
  console.log(`✅ Orders query succeeded - Found ${orders.length} orders`);
}

// Test 6: Check mockup_templates table
console.log('\n🖼️  Testing Mockup Templates Table:');
const { data: mockups, error: mockupsError } = await supabase
  .from('mockup_templates')
  .select('id, product_type, cloudinary_public_id')
  .limit(5);

if (mockupsError) {
  console.log('❌ Mockup templates query failed:', mockupsError.message);
  if (mockupsError.code === '42P01') {
    console.log('   ℹ️  Table does not exist - needs to be created');
  }
} else {
  console.log(`✅ Mockup templates query succeeded - Found ${mockups.length} templates`);
  if (mockups.length > 0) {
    mockups.forEach(m => console.log(`   - ${m.product_type}: ${m.cloudinary_public_id || 'no image'}`));
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 DATABASE STATUS SUMMARY');
console.log('='.repeat(60));

const summary = {
  products: !productsError,
  productVariants: !variantsError,
  cartItems: !cartError,
  artworks: !artworksError,
  orders: !ordersError,
  mockupTemplates: !mockupsError
};

const working = Object.values(summary).filter(v => v).length;
const total = Object.keys(summary).length;

console.log(`\n✅ Working: ${working}/${total} tables accessible`);
console.log('\nTable Status:');
Object.entries(summary).forEach(([table, status]) => {
  console.log(`  ${status ? '✅' : '❌'} ${table}`);
});

if (working === total) {
  console.log('\n🎉 All core tables are accessible!');
  console.log('Next: Check if products are seeded');
  if (products && products.length === 0) {
    console.log('⚠️  Products table is empty - run seed-products.sql');
  }
} else {
  console.log('\n⚠️  Some tables are not accessible');
  console.log('Action: Run APPLY_THIS_FIX.sql in Supabase SQL Editor');
}
