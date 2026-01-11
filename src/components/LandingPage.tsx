import React from 'react';
import { Button } from './Button';
import { ArrowRight, Star, Camera, Frame, PenTool, ShoppingBag, Heart, Palette, Quote } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="w-full overflow-x-hidden">
      
      {/* 1. HERO SECTION */}
      <section className="relative bg-stone-50 min-h-[90vh] flex items-center">
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-terracotta/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-navy/5 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
          
          {/* Copy */}
          <div className="space-y-8 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-stone-200 rounded-full shadow-sm">
              <Star size={12} className="text-terracotta fill-terracotta" />
              <span className="text-xs font-bold tracking-widest uppercase text-stone-600">The #1 Art Preservation Studio</span>
            </div>
            
            <h1 className="font-serif text-5xl md:text-7xl leading-[1.1] text-stone-900">
              Turn their little artwork into a <span className="italic text-terracotta">Little Masterpiece.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-stone-600 font-light leading-relaxed max-w-lg">
              Beautifully restored, professionally styled and ready to frame. Celebrate your child’s creativity with art you’ll proudly display in your home.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" onClick={onStart} className="group shadow-xl shadow-stone-900/10">
                Start Your Masterpiece
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth'})}>
                View Gallery
              </Button>
            </div>
          </div>

          {/* Hero Image */}
          <div className="order-1 lg:order-2 relative">
             <div className="relative aspect-[4/5] bg-white shadow-2xl rounded-sm transform md:rotate-2 hover:rotate-0 transition-transform duration-1000">
                <img
                  src="/Gemini_Generated_Image_3.png"
                  alt="Molly's flower drawing, age 9, beautifully framed on wall"
                  className="w-full h-full object-cover rounded-sm"
                />
             </div>
          </div>
        </div>
      </section>

      {/* 2. EMOTIONAL HOOK */}
      <section className="py-24 bg-white border-y border-stone-100">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
               <h2 className="font-serif text-3xl md:text-5xl text-stone-900 mb-8 leading-tight">Because childhood creativity deserves more than the fridge door</h2>
               <div className="space-y-6 text-lg text-stone-500 font-light leading-relaxed">
                  <p>Every parent has that one drawing. The one that made you smile. The one that showed their personality. The one you quietly tucked away so it wouldn’t get lost.</p>
                  <p className="text-stone-900 font-medium font-serif italic text-2xl">Little Masterpiece turns that moment into something lasting.</p>
                  <p>We restore the artwork, elevate the linework, enhance the colours and present it as a beautifully styled print worthy of your walls. It’s a way of celebrating who they are right now. A way of holding onto the magic before it rushes past you.</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
               {/* Before */}
               <div className="relative group">
                  <div className="relative rotate-[-2deg] shadow-lg">
                     <img
                       src="/before image.png"
                       className="w-full h-auto"
                       alt="Original crumpled cat drawing by Molly"
                     />
                     <div className="absolute -top-3 -left-3 bg-terracotta text-white text-xs font-bold px-3 py-1 uppercase tracking-widest shadow-md">
                        Before
                     </div>
                  </div>
               </div>

               {/* After */}
               <div className="relative group">
                  <div className="relative shadow-2xl rotate-[1deg]">
                     <img
                       src="/after.png"
                       className="w-full h-auto"
                       alt="Beautifully framed cat drawing by Molly, age 8"
                     />
                     <div className="absolute -top-3 -right-3 bg-stone-900 text-white text-xs font-bold px-3 py-1 uppercase tracking-widest shadow-md">
                        After
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* 3. WHY THIS MATTERS */}
      <section className="py-24 bg-stone-50">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
               <div>
                  <h2 className="font-serif text-4xl text-stone-900 mb-6">Art you’ll want to keep. <br/>A story they’ll remember.</h2>
                  <p className="text-stone-600 font-light mb-8">
                     Kids create freely. Instinctively. Without self-doubt. Their art is pure imagination, and these early pieces become tiny time capsules of who they were.
                  </p>
                  <ul className="space-y-4">
                     {[
                        "Preserves the character of the original",
                        "Enhances the lines and colours for professional print",
                        "Brings interior-design styling to your child’s work",
                        "Gives you a meaningful gift for grandparents",
                        "Makes their creativity part of your home"
                     ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                           <div className="w-1.5 h-1.5 rounded-full bg-terracotta mt-2.5"></div>
                           <span className="text-stone-700 font-light text-lg">{item}</span>
                        </li>
                     ))}
                  </ul>
                  <p className="mt-8 font-serif italic text-stone-500 text-lg">This is the artwork they’ll look back on in twenty years.</p>
               </div>
               <div className="relative">
                  <div className="shadow-xl rotate-2 overflow-hidden">
                      <img src="/Fridge.png" className="w-full h-full object-cover" alt="Children's artwork on fridge door" />
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 bg-white">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
               <h2 className="font-serif text-3xl md:text-4xl text-stone-900">Turning scribbles into gallery pieces, beautifully and simply</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
               {[
                 { 
                   icon: Camera, 
                   title: "1. Upload", 
                   desc: "Upload a photo of the artwork. No scanner needed. Natural light works best." 
                 },
                 { 
                   icon: Palette, 
                   title: "2. Choose Look", 
                   desc: "Original, enhanced, monochrome, duotone or screenprint styles." 
                 },
                 { 
                   icon: PenTool, 
                   title: "3. Signature", 
                   desc: "Add their name, age or a small message. Modern, subtle artist-style typography." 
                 },
                 { 
                   icon: Frame, 
                   title: "4. Preview", 
                   desc: "See it on frames, totes, mugs and more using studio-grade mockups." 
                 },
                 { 
                   icon: ShoppingBag, 
                   title: "5. Order", 
                   desc: "Order the print or download the file. Museum-grade resolution. Delivered worldwide." 
                 }
               ].map((step, idx) => (
                 <div key={idx} className="flex flex-col items-center text-center group">
                    <div className="w-14 h-14 bg-stone-50 border border-stone-100 rounded-full flex items-center justify-center mb-6 shadow-sm group-hover:bg-stone-900 transition-colors duration-300">
                       <step.icon size={24} className="text-stone-500 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-serif text-xl text-stone-900 mb-3">{step.title}</h3>
                    <p className="text-stone-500 font-light text-sm leading-relaxed">{step.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* 5. STYLE OPTIONS & SIGNATURE */}
      <section className="py-24 bg-stone-900 text-stone-300">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
               {/* Styles */}
               <div className="space-y-8">
                  <h2 className="font-serif text-3xl text-white">Designed to feel premium. Styled to suit your home.</h2>
                  <p className="font-light text-lg">Your child’s art stays the hero. We simply help it look its best.</p>
                  
                  <div className="grid grid-cols-1 gap-6">
                     {[
                        { title: "Original", desc: "Cleaned, enhanced and printed beautifully." },
                        { title: "Monochrome", desc: "A single ink colour inspired by design studios. Perfect for modern interiors." },
                        { title: "Duotone", desc: "Two complementary tones drawn from your artwork for a soft, contemporary look." },
                        { title: "Screenprint", desc: "A bold two-colour poster style with handcrafted texture." },
                        { title: "Colour Refinement", desc: "Reduces chaotic colours into a curated palette while staying true to the drawing." }
                     ].map((s, i) => (
                        <div key={i} className="border-l-2 border-stone-700 pl-4">
                           <h4 className="text-white font-serif text-lg">{s.title}</h4>
                           <p className="text-stone-400 text-sm">{s.desc}</p>
                        </div>
                     ))}
                  </div>
                  <p className="italic text-stone-500 mt-4">Every style is designed to feel premium, calm and intentional in your space.</p>
               </div>

               {/* Signature Feature */}
               <div className="bg-stone-800 p-8 md:p-12 rounded-sm border border-stone-700 flex flex-col justify-center">
                  <h3 className="font-serif text-2xl text-white mb-4">An artist-style signature they’ll be proud of</h3>
                  <p className="text-stone-400 font-light mb-8">Add a subtle pencil-style signature in the bottom right corner:</p>
                  
                  <ul className="space-y-2 mb-8 text-stone-300">
                     <li className="flex items-center gap-2"><div className="w-1 h-1 bg-terracotta rounded-full"></div> Child’s name</li>
                     <li className="flex items-center gap-2"><div className="w-1 h-1 bg-terracotta rounded-full"></div> Age or year</li>
                     <li className="flex items-center gap-2"><div className="w-1 h-1 bg-terracotta rounded-full"></div> Optional short message like "For Daddy • 2025"</li>
                  </ul>

                  <div className="bg-white p-6 rounded flex items-end justify-end shadow-inner">
                     <div className="text-right transform rotate-[-1deg]">
                        <p className="font-hand text-4xl text-stone-800">Leo</p>
                        <p className="font-sans text-xs uppercase tracking-[0.2em] text-stone-400 mt-1">Age 5 • 2025</p>
                     </div>
                  </div>
                  <p className="text-center text-xs text-stone-500 mt-4 uppercase tracking-widest">Preview</p>
               </div>
            </div>
         </div>
      </section>

      {/* 6. PRODUCT VISUALISER (GALLERY) */}
      <section id="gallery" className="py-24 bg-white">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center">
            <h2 className="font-serif text-4xl text-stone-900 mb-4">See it on real objects instantly</h2>
            <p className="text-stone-500 font-light text-lg max-w-2xl mx-auto">
               Every mockup is photographed in real interiors so the artwork feels authentic, not artificial.
            </p>
         </div>

         {/* Product Examples Section */}
         <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
            <div className="bg-stone-50 p-8 md:p-12 border border-stone-200">
               <h3 className="font-serif text-2xl text-stone-900 mb-8 text-center">Your artwork, anywhere you imagine</h3>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="group">
                     <div className="aspect-square bg-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <img src="/large framed rainbow.png" alt="Framed Print" className="w-full h-full object-cover" />
                     </div>
                     <p className="text-center text-xs text-stone-500 mt-3 font-medium">Framed Print</p>
                  </div>
                  <div className="group">
                     <div className="aspect-square bg-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <img src="/tote indoor 2.png" alt="Tote Bag" className="w-full h-full object-cover" />
                     </div>
                     <p className="text-center text-xs text-stone-500 mt-3 font-medium">Tote Bag</p>
                  </div>
                  <div className="group">
                     <div className="aspect-square bg-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <img src="/cup flower 1.png" alt="Coffee Mug" className="w-full h-full object-cover" />
                     </div>
                     <p className="text-center text-xs text-stone-500 mt-3 font-medium">Coffee Mug</p>
                  </div>
                  <div className="group">
                     <div className="aspect-square bg-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <img src="/Bedroom .png" alt="T-Shirt" className="w-full h-full object-cover" />
                     </div>
                     <p className="text-center text-xs text-stone-500 mt-3 font-medium">T-Shirt</p>
                  </div>
                  <div className="group">
                     <div className="aspect-square bg-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden">
                        <img src="/Phone.png" alt="Phone Case" className="w-full h-full object-cover" />
                     </div>
                     <p className="text-center text-xs text-stone-500 mt-3 font-medium">Phone Case</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Grid */}
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12">
               <div className="group relative cursor-pointer">
                  <div className="bg-stone-100 overflow-hidden rounded-sm relative">
                     <img
                       src="/large framed rainbow.png"
                       alt="Rainbow artwork by Mia, Age 6, framed on wall"
                       className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                     />
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                  </div>
                  <div className="pt-6 text-center">
                     <h3 className="font-serif text-2xl text-stone-900 mb-2">The Gallery Frame</h3>
                     <p className="text-stone-500 text-sm">Museum-quality oak frame with premium matting</p>
                  </div>
               </div>

               <div className="group relative cursor-pointer">
                  <div className="bg-stone-100 overflow-hidden rounded-sm relative">
                     <img
                       src="/tote indoor 2.png"
                       alt="Abstract artwork by Leo on cotton tote bag in art studio"
                       className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                     />
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                  </div>
                  <div className="pt-6 text-center">
                     <h3 className="font-serif text-2xl text-stone-900 mb-2">Everyday Tote Bag</h3>
                     <p className="text-stone-500 text-sm">Heavy-duty 100% cotton canvas</p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
               <div className="group relative cursor-pointer">
                  <div className="bg-stone-100 overflow-hidden rounded-sm aspect-square relative">
                     <img
                       src="/dragon tote 1.png"
                       alt="Dragon drawing by Charlie on tote bag"
                       className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                     />
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                  </div>
                  <div className="pt-4 text-center">
                     <h3 className="font-serif text-base text-stone-900">Tote Bags</h3>
                     <p className="text-xs text-stone-500 mt-1">Perfect for groceries or the beach</p>
                  </div>
               </div>

               <div className="group relative cursor-pointer">
                  <div className="bg-stone-100 overflow-hidden rounded-sm aspect-square relative">
                     <img
                       src="/cup flower 1.png"
                       alt="Flower drawing by Mia on ceramic mug"
                       className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                     />
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                  </div>
                  <div className="pt-4 text-center">
                     <h3 className="font-serif text-base text-stone-900">Ceramic Mugs</h3>
                     <p className="text-xs text-stone-500 mt-1">Daily reminder of their creativity</p>
                  </div>
               </div>

               <div className="group relative cursor-pointer">
                  <div className="bg-stone-100 overflow-hidden rounded-sm aspect-square relative">
                     <img
                       src="/pillow print 1.png"
                       alt="Family drawing by Lewis on decorative pillow"
                       className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                     />
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                  </div>
                  <div className="pt-4 text-center">
                     <h3 className="font-serif text-base text-stone-900">Throw Pillows</h3>
                     <p className="text-xs text-stone-500 mt-1">Cozy home decor with meaning</p>
                  </div>
               </div>
            </div>
            
            <div className="text-center mt-12">
               <Button size="lg" onClick={onStart}>Start Your Masterpiece</Button>
            </div>
         </div>
      </section>

      {/* 7. TESTIMONIALS */}
      <section className="py-24 bg-stone-50">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
               <h2 className="font-serif text-3xl text-stone-900">Loved by parents who want something more meaningful than another toy</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               {[
                 { text: "It’s honestly the only gift the grandparents wanted this year.", author: "Sarah, Byron Bay" },
                 { text: "Seeing my daughter’s drawing as a framed print made me teary. It feels like proper art.", author: "Emma, Melbourne" },
                 { text: "It brought so much pride to my son. He keeps pointing at it saying ‘I made that!’", author: "Adele, Brisbane" },
                 { text: "Stylish enough to hang in the living room. Everyone comments on it.", author: "Maya, Sydney" },
                 { text: "I finally found a way to keep the memories without the clutter.", author: "Jess, Gold Coast" }
               ].map((quote, i) => (
                 <div key={i} className="bg-white p-8 shadow-sm border border-stone-100 relative">
                    <Quote size={24} className="text-terracotta/30 absolute top-6 left-6" />
                    <p className="relative z-10 text-stone-600 font-light italic leading-relaxed mb-6 pt-4">"{quote.text}"</p>
                    <div className="flex items-center gap-2">
                       <Heart size={12} className="text-terracotta fill-terracotta" />
                       <span className="text-xs font-bold uppercase tracking-widest text-stone-900">{quote.author}</span>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* 8. FOUNDER STORY */}
      <section className="py-24 bg-white border-y border-stone-100">
         <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
               <div className="relative">
                  <div className="aspect-[4/5] bg-stone-200 grayscale rounded-sm overflow-hidden">
                     <img src="https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=1000" alt="Father and child drawing" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-6 -right-6 bg-stone-900 text-white p-6 shadow-xl max-w-xs hidden md:block">
                     <p className="font-serif italic text-lg">"The difference is the creative director is three years old."</p>
                  </div>
               </div>
               <div>
                  <h2 className="font-serif text-4xl text-stone-900 mb-2">From one parent to another</h2>
                  <p className="text-xs uppercase tracking-widest text-stone-400 mb-8">Daniel, Founder & Dad</p>
                  
                  <div className="space-y-6 text-stone-600 font-light text-lg leading-relaxed">
                     <p>I’m a creative director and a dad. My son brings home piles of drawings. Some are silly, some are wild, some are beautiful in the most unexpected way.</p>
                     <p>One day I realised… this is his purest creativity. This is the art I’ll want to remember.</p>
                     <p>I created Little Masterpiece so parents can preserve those moments with care and craft. Because childhood doesn’t stay still, but we can keep parts of it close.</p>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* 9. FAQ */}
      <section className="py-24 bg-stone-50">
         <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl text-center text-stone-900 mb-12">Common Questions</h2>
            <div className="space-y-4">
               {[
                  { q: "Do you change my child’s drawing?", a: "Never the meaning. We only clean, refine and style it for high-quality printing." },
                  { q: "Do I get the digital file?", a: "Yes. Every artwork comes with a premium print-ready download." },
                  { q: "Can I order framed prints?", a: "Yes, we offer gallery-grade frames delivered worldwide." },
                  { q: "Can I create multiple versions?", a: "Yes. You can try different colours and styles in the studio." }
               ].map((faq, i) => (
                  <div key={i} className="bg-white p-6 shadow-sm border border-stone-100 rounded-sm">
                     <h4 className="font-serif text-lg text-stone-900 mb-2">{faq.q}</h4>
                     <p className="text-stone-500 font-light">{faq.a}</p>
                  </div>
               ))}
            </div>
         </div>
      </section>

    </div>
  );
};