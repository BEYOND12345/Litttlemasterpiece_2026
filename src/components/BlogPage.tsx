import React, { useState } from 'react';
import { Clock, ArrowRight } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  readTime: number;
  publishedAt: string;
  category: string;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: '1',
    title: 'Capturing Your Child\'s Art: Photography Tips for Best Results',
    excerpt: 'Learn how to photograph your child\'s artwork in natural light for the most vibrant, true-to-life digital versions.',
    content: `
# Capturing Your Child's Art: Photography Tips for Best Results

Getting a great photo of your child's artwork is the foundation of creating beautiful prints. Here's how to do it right:

## 1. Use Natural Light
Place the artwork near a window on a bright day, but avoid direct sunlight which creates harsh shadows. Overcast days provide soft, even lighting.

## 2. Keep Your Phone Parallel
Hold your phone directly above the artwork, keeping it as parallel as possible to avoid distortion. Most phones have a level feature in the camera app.

## 3. Fill the Frame
Get close enough that the artwork fills most of your camera frame, but leave a small border to ensure you don't cut off any details.

## 4. Check for Shadows
Make sure you're not blocking the light and casting a shadow on the artwork. Step back and adjust your angle if needed.

## 5. Use HDR Mode
If your phone has an HDR (High Dynamic Range) setting, turn it on. This helps capture details in both light and dark areas.

## 6. Clean Your Lens
A quick wipe of your phone's camera lens ensures crystal-clear images without any smudges or blur.

## Pro Tips:
- Photograph on a neutral background (white paper or light table)
- Avoid flash at all costs
- Take multiple shots and choose the best one
- Capture the artwork flat rather than taped to a wall

With these simple steps, you'll have gallery-worthy photos ready to transform into lasting treasures.
    `,
    imageUrl: '/before image.png',
    readTime: 5,
    publishedAt: '2024-01-15',
    category: 'Tips & Tricks'
  },
  {
    id: '2',
    title: 'Choosing the Perfect Style for Your Child\'s Artwork',
    excerpt: 'From original colours to duotone prints, discover which restoration style works best for different types of children\'s art.',
    content: `
# Choosing the Perfect Style for Your Child's Artwork

Every piece of art is unique, and choosing the right style can make all the difference. Here's our guide to selecting the perfect look:

## Original Style
**Best for:** Watercolours, coloured pencil work, detailed paintings
**Why it works:** Preserves every colour and detail exactly as your child created it. Perfect when the original colours are vibrant and well-balanced.

## Enhanced Style
**Best for:** Faded artwork, pencil drawings, mixed media
**Why it works:** Gently boosts contrast and saturation to make the artwork pop without changing its character. Ideal for pieces that have faded over time.

## Monochrome Style
**Best for:** Pen drawings, sketches, bold compositions
**Why it works:** Creates a timeless, sophisticated look. Choose from classic black ink or explore warm browns and cool greys to match your decor.

## Duotone Style
**Best for:** Strong compositions, abstract art, bold shapes
**Why it works:** Two complementary colours create a cohesive, designer look. Perfect for modern interiors and gallery walls.

## Screenprint Style
**Best for:** Simple shapes, bold lines, graphic designs
**Why it works:** Creates a poster-like aesthetic with high contrast. Excellent for children's art with clear subjects and defined edges.

## Matching Your Home
Consider your room's colour palette when choosing a style. A duotone print in navy and terracotta can tie together a coastal-themed nursery, while monochrome works beautifully in minimalist spaces.

## Still Unsure?
Our studio preview lets you test different styles instantly. Take your time exploring options until you find the perfect match!
    `,
    imageUrl: '/after.png',
    readTime: 6,
    publishedAt: '2024-01-10',
    category: 'Style Guide'
  },
  {
    id: '3',
    title: 'Creating a Gallery Wall with Your Child\'s Art',
    excerpt: 'Transform a blank wall into a celebration of creativity with these professional tips for displaying children\'s artwork.',
    content: `
# Creating a Gallery Wall with Your Child's Art

A gallery wall of your child's artwork turns any room into a celebration of their creativity. Here's how to create one that looks professionally curated:

## Planning Your Layout

### The Grid Method
Arrange frames in a perfect grid pattern for a clean, modern look. This works best with same-sized frames and similar art styles.

### The Salon Style
Mix different frame sizes in an organic arrangement. Start with the largest piece in the center and build outward.

### The Timeline
Arrange artwork chronologically from left to right, creating a visual story of your child's artistic development.

## Choosing Frames

**Consistency is key:** Use frames in the same colour family (all black, all natural wood, or all white) even if sizes vary.

**Mat matters:** White or cream mats create breathing room and make bold colours pop. For a cohesive look, use mats that are all the same width.

**Quality counts:** Acid-free mats and UV-protective glass preserve artwork for years to come.

## Hanging Tips

1. **Map it out first:** Lay your arrangement on the floor before putting holes in the wall
2. **Eye level is ideal:** The center of your gallery should sit at 57-60 inches from the floor
3. **Maintain spacing:** Keep 2-3 inches between frames for a cohesive look
4. **Use a level:** Nothing ruins a gallery wall faster than crooked frames

## Adding Variety

Mix framed prints with:
- Canvas prints for texture
- Small shelves with 3D objects
- Tote bags or textiles as focal points
- Your child's name in wooden letters

## Room-Specific Ideas

**Playroom:** Go bold with colours and large-scale pieces
**Bedroom:** Create a calm collection with coordinated colours
**Hallway:** A timeline gallery tells your child's creative story
**Living Room:** Curate more formal, sophisticated pieces

Remember: Your gallery wall can evolve! Rotate artwork seasonally or as your child creates new favourites.
    `,
    imageUrl: '/Large print above fire place.png',
    readTime: 7,
    publishedAt: '2024-01-05',
    category: 'Display Ideas'
  },
  {
    id: '4',
    title: 'Preserving Art Supplies: Getting the Most from Materials',
    excerpt: 'Quality art supplies help children create their best work. Learn how to store and maintain materials for optimal results.',
    content: `
# Preserving Art Supplies: Getting the Most from Materials

Quality materials make a difference in children's artwork. Here's how to keep supplies fresh and ready for creating:

## Paper Storage

**Keep it flat:** Store paper horizontally in a drawer or portfolio to prevent curling
**Control humidity:** Use a closet or drawer away from bathrooms and kitchens
**Separate by type:** Keep watercolour paper separate from drawing paper

## Paint Care

**Seal containers tightly:** Air exposure dries out paint quickly
**Store upside down:** This keeps paint from forming a skin on top
**Add moisture:** A damp paper towel in the container can revive slightly dried paint

## Marker & Pen Maintenance

**Store horizontally:** This distributes ink evenly
**Cap immediately:** Even a few minutes of exposure can dry out tips
**Rotate usage:** Use markers in rotation to prevent favourites from drying out

## Crayon & Pencil Organization

**Sort by colour:** Makes selection easier and inspires colour combinations
**Keep points protected:** Store pencils point-up to prevent breakage
**Remove paper wrapping:** On crayons for easier blending techniques

## Creating a Dedicated Art Space

Set up a consistent space for art creation:
- Good natural light source
- Easy-to-clean surface
- Organized supply storage within reach
- Display area for finished works
- Water source nearby for painting

## When to Refresh Supplies

Replace when:
- Markers become streaky
- Paint develops an unusual smell
- Paper yellows or becomes brittle
- Pencils stop sharpening cleanly

## Eco-Friendly Tips

- Buy quality over quantity for longer-lasting supplies
- Repurpose jars and containers for storage
- Choose non-toxic, washable options
- Look for supplies made from recycled materials

Well-maintained supplies lead to better artwork, which means more treasures to preserve!
    `,
    imageUrl: '/cup flower 1.png',
    readTime: 5,
    publishedAt: '2024-01-01',
    category: 'Tips & Tricks'
  },
  {
    id: '5',
    title: 'Gift Ideas: Turning Art into Meaningful Presents',
    excerpt: 'Your child\'s artwork makes the most heartfelt gifts for grandparents, teachers, and family. Discover creative ways to share their creativity.',
    content: `
# Gift Ideas: Turning Art into Meaningful Presents

Nothing beats a gift made with little hands and big imagination. Here's how to transform your child's artwork into presents that bring tears of joy:

## For Grandparents

**Custom Canvas Print:** Large format prints make statement pieces for their home
**Photo Album:** Compile a year's worth of artwork with dates and the child's age
**Calendar:** Feature 12 favourite pieces, one for each month
**Tote Bag:** Grandma can carry her grandchild's art everywhere she goes

## For Teachers

**Thank You Card:** Turn a special drawing into a personalized card
**Coffee Mug:** Perfect for their morning coffee with your child's design
**Framed Print:** A small framed piece for their desk or classroom wall
**Greeting Card Set:** Multiple designs printed as notecards

## For Family Members

**Holiday Ornaments:** Turn artwork into keepsake decorations
**Pillows:** Cozy textiles featuring their creative designs
**Postcards:** Send artwork through the mail to distant relatives
**Phone Cases:** Wearable art for tech-savvy family members

## Making It Extra Special

### Add a Personal Touch
Include a note from your child explaining their artwork:
- "This is our family going to the beach"
- "I drew this thinking of you"
- "The blue part is the ocean like at your house"

### Consider the Recipient
- Nature lovers: artwork featuring flowers or animals
- Sports fans: drawings of their favourite activities
- Minimalists: choose simpler, graphic pieces
- Maximalists: bold, colourful, detailed work

## Presentation Matters

**Beautiful Packaging:**
- Use kraft paper and twine for rustic charm
- Include a photo of your child creating the piece
- Add a certificate of authenticity (kids love this!)
- Frame it before giving for maximum impact

## Occasion-Specific Ideas

**Mother's Day:** Portrait of mom with flowers
**Father's Day:** Dad's favourite hobby depicted in crayon
**Birthdays:** Age-appropriate artwork from that year
**Christmas:** Winter scenes or family portraits
**New Baby:** The older sibling's welcome artwork

## Group Gifts

Coordinate with other parents to create:
- Class quilts with each child's square
- Collaborative murals
- Collection of teacher appreciation art

## The Gift That Keeps Giving

Consider a subscription service where new artwork arrives quarterly, creating an ongoing connection between grandparents and grandchildren.

Remember: The value isn't in perfection—it's in the authentic expression of childhood creativity. That wobbly heart and those six-fingered hands are what make these gifts priceless.
    `,
    imageUrl: '/tote indoor 2.png',
    readTime: 6,
    publishedAt: '2023-12-28',
    category: 'Gift Ideas'
  }
];

export const BlogPage: React.FC = () => {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  if (selectedPost) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button
            onClick={() => setSelectedPost(null)}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-8 transition-colors"
          >
            <ArrowRight size={16} className="rotate-180" />
            Back to all articles
          </button>

          <article>
            <div className="mb-8">
              <div className="flex items-center gap-4 text-sm text-stone-500 mb-4">
                <span className="bg-terracotta/10 text-terracotta px-3 py-1 text-xs font-bold uppercase tracking-widest">
                  {selectedPost.category}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {selectedPost.readTime} min read
                </span>
                <span>{new Date(selectedPost.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <h1 className="font-serif text-4xl md:text-5xl text-stone-900 mb-6 leading-tight">
                {selectedPost.title}
              </h1>
            </div>

            <div className="bg-white border border-stone-200 shadow-sm mb-12">
              <img
                src={selectedPost.imageUrl}
                alt={selectedPost.title}
                className="w-full h-96 object-cover"
              />
            </div>

            <div className="prose prose-stone prose-lg max-w-none">
              {selectedPost.content.split('\n').map((line, idx) => {
                if (line.startsWith('# ')) {
                  return <h1 key={idx} className="font-serif text-3xl text-stone-900 mt-12 mb-6">{line.replace('# ', '')}</h1>;
                } else if (line.startsWith('## ')) {
                  return <h2 key={idx} className="font-serif text-2xl text-stone-900 mt-8 mb-4">{line.replace('## ', '')}</h2>;
                } else if (line.startsWith('### ')) {
                  return <h3 key={idx} className="font-serif text-xl text-stone-900 mt-6 mb-3">{line.replace('### ', '')}</h3>;
                } else if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={idx} className="font-bold text-stone-900 mt-4 mb-2">{line.replace(/\*\*/g, '')}</p>;
                } else if (line.startsWith('- ')) {
                  return <li key={idx} className="text-stone-700 ml-6 mb-2">{line.replace('- ', '')}</li>;
                } else if (line.trim()) {
                  return <p key={idx} className="text-stone-700 leading-relaxed mb-4">{line}</p>;
                }
                return null;
              })}
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">

        <div className="text-center mb-16">
          <h1 className="font-serif text-5xl md:text-6xl text-stone-900 mb-6">
            Art & Inspiration
          </h1>
          <p className="text-xl text-stone-600 font-light leading-relaxed max-w-2xl mx-auto">
            Tips, guides, and inspiration for capturing, preserving, and displaying your child's creative masterpieces.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="bg-white border border-stone-200 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              <div className="aspect-video bg-stone-100 overflow-hidden">
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-terracotta">
                    {post.category}
                  </span>
                  <span className="text-xs text-stone-400 flex items-center gap-1">
                    <Clock size={12} />
                    {post.readTime} min
                  </span>
                </div>
                <h2 className="font-serif text-xl text-stone-900 mb-3 group-hover:text-terracotta transition-colors">
                  {post.title}
                </h2>
                <p className="text-stone-600 text-sm leading-relaxed mb-4">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-400">
                    {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-sm text-stone-900 group-hover:text-terracotta flex items-center gap-1 transition-colors">
                    Read More
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-20 bg-stone-900 text-white p-12 text-center">
          <h2 className="font-serif text-3xl mb-4">Ready to Preserve Your Little Artist's Work?</h2>
          <p className="text-stone-400 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
            Start transforming those fridge masterpieces into gallery-quality prints that will last a lifetime.
          </p>
          <button className="bg-terracotta text-white px-8 py-4 hover:bg-terracotta/90 transition-colors font-medium">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};
