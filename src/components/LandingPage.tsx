import React from 'react';
import { Button } from './Button';
import { ArrowRight, Camera, Palette, Gift, ShoppingBag } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

/*
 * Copy rule for this page: it may only say what the launch actually does.
 * Parents photograph a drawing, choose one of two looks (As drawn, Screen
 * print), and order it as a framed print or an 11oz mug, printed by Gelato,
 * paid through Stripe, no account. No invented reviews, numbers or awards.
 *
 * The example images are illustrations, not photographs of real orders, and
 * the page says so. The printed names and ages they came with ("Molly, Age 9"
 * beside "Molly, Aged 8", "Mia, Age 6" beside "Mia, Aged 7") were removed from
 * the files: they disagreed with each other, and the product prints no name.
 */
export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="w-full overflow-x-hidden">

      {/* 1. HERO */}
      <section className="relative bg-stone-50 min-h-[90vh] flex items-center">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-terracotta/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-navy/5 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
          <div className="space-y-8 order-2 lg:order-1">
            <p className="text-xs font-bold tracking-widest uppercase text-stone-500">Framed prints and mugs</p>

            <h1 className="font-serif text-5xl md:text-7xl leading-[1.1] text-stone-900">
              Turn their little artwork into a <span className="italic text-terracotta">Little Masterpiece.</span>
            </h1>

            <p className="text-lg md:text-xl text-stone-600 font-light leading-relaxed max-w-lg">
              Take a photo of your child's drawing and see it two ways: as drawn, cleaned up and ready to print, or as a
              bold screen print. Then order it as a framed print or a mug.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" onClick={onStart} className="group min-h-[52px] shadow-xl shadow-stone-900/10">
                Start Your Masterpiece
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-[52px]"
                onClick={() => document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })}
              >
                See examples
              </Button>
            </div>
          </div>

          <div className="order-1 lg:order-2 relative">
            <div className="relative aspect-[4/5] bg-white shadow-2xl rounded-sm transform md:rotate-2 hover:rotate-0 transition-transform duration-1000">
              <img
                src="/framed-flower.png"
                width={864}
                height={1184}
                alt="Example: a child's flower drawing as a framed print on a wall"
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
              <p>Every parent has that one drawing. The one that made you smile. The one that showed their personality. The one you quietly tucked away so it wouldn't get lost.</p>
              <p className="text-stone-900 font-medium font-serif italic text-2xl">Little Masterpiece turns that moment into something lasting.</p>
              <p>Take a photo on your phone and we clean it up for print, keeping every line where they put it. Choose a look, choose a framed print or a mug, and it's printed and posted to you.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="relative rotate-[-2deg] shadow-lg">
                <img
                  src="/before image.png"
                  width={864}
                  height={1184}
                  loading="lazy"
                  className="w-full h-auto"
                  alt="Example: a child's cat drawing on crumpled paper, photographed on a table"
                />
                <div className="absolute -top-3 -left-3 bg-terracotta text-white text-xs font-bold px-3 py-1 uppercase tracking-widest shadow-md">
                  Before
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative shadow-2xl rotate-[1deg]">
                <img
                  src="/after.png"
                  width={864}
                  height={1184}
                  loading="lazy"
                  className="w-full h-auto"
                  alt="Example: the same cat drawing, cleaned up, as a framed print"
                />
                <div className="absolute -top-3 -right-3 bg-stone-900 text-white text-xs font-bold px-3 py-1 uppercase tracking-widest shadow-md">
                  After
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-stone-400 mt-8">Example images, for illustration.</p>
        </div>
      </section>

      {/* 3. WHY THIS MATTERS */}
      <section className="py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-serif text-4xl text-stone-900 mb-6">Art you'll want to keep. <br />A story they'll remember.</h2>
              <p className="text-stone-600 font-light mb-8">
                Kids create freely. Instinctively. Without self-doubt. Their art is pure imagination, and these early pieces become tiny time capsules of who they were.
              </p>
              <ul className="space-y-4">
                {[
                  'Keeps every line where they drew it',
                  'Clears shadows and uneven light from your photo',
                  'Gives you a meaningful gift for grandparents',
                  'Makes their creativity part of your home',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-terracotta mt-2.5 shrink-0"></div>
                    <span className="text-stone-700 font-light text-lg">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 font-serif italic text-stone-500 text-lg">This is the artwork they'll look back on in twenty years.</p>
            </div>
            <div className="relative">
              <div className="shadow-xl rotate-2 overflow-hidden">
                <img src="/Fridge.png" width={864} height={1184} loading="lazy" className="w-full h-full object-cover" alt="Children's drawings taped to a fridge door" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl text-stone-900">How it works</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
            {[
              {
                icon: Camera,
                title: '1. Take a photo',
                desc: 'Photograph the drawing on your phone. No scanner needed. Flat, in good light, works best.',
              },
              {
                icon: Palette,
                title: '2. Choose a look',
                desc: 'As drawn, cleaned up and ready to print. Or Screen print, in one to three flat inks.',
              },
              {
                icon: Gift,
                title: '3. Choose a gift',
                desc: "A framed print or an 11oz mug. You'll see their drawing on it before you order.",
              },
              {
                icon: ShoppingBag,
                title: '4. Order',
                desc: 'Pay securely with Stripe, no account needed. Our print partner, Gelato, prints it and posts it to you.',
              },
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

      {/* 5. THE TWO LOOKS */}
      <section className="py-24 bg-stone-900 text-stone-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-4 text-center">Two looks. Their drawing in both.</h2>
          <p className="font-light text-lg text-center mb-12">Both are made on your phone from your photo, so you can see each one before you choose.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-l-2 border-terracotta pl-5">
              <h3 className="text-white font-serif text-2xl mb-2">As drawn</h3>
              <p className="text-stone-400 leading-relaxed">Cleaned up and print-ready. Shadows and uneven light from the photo are taken out, and every line stays exactly as they drew it.</p>
            </div>
            <div className="border-l-2 border-stone-600 pl-5">
              <h3 className="text-white font-serif text-2xl mb-2">Screen print</h3>
              <p className="text-stone-400 leading-relaxed">The drawing's own colours as one to three flat inks, for the bold look of a screen-printed poster.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. THE TWO PRODUCTS */}
      <section id="gallery" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 text-center">
          <h2 className="font-serif text-4xl text-stone-900 mb-4">A framed print or a mug</h2>
          <p className="text-stone-500 font-light text-lg max-w-2xl mx-auto">
            Before you order, you'll see your child's own drawing on the one you choose.
          </p>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12">
            <div>
              <div className="bg-stone-100 overflow-hidden rounded-sm">
                <img
                  src="/large framed rainbow.png"
                  width={864}
                  height={1184}
                  loading="lazy"
                  alt="Example: a child's rainbow drawing as a framed print on a wall"
                  className="w-full h-auto"
                />
              </div>
              <div className="pt-6 text-center">
                <h3 className="font-serif text-2xl text-stone-900 mb-2">Framed print</h3>
                <p className="text-stone-500 text-sm">Oak frame, ready to hang</p>
              </div>
            </div>

            <div>
              <div className="bg-stone-100 overflow-hidden rounded-sm">
                <img
                  src="/cup flower 1.png"
                  width={864}
                  height={1184}
                  loading="lazy"
                  alt="Example: a child's flower drawing on a white mug"
                  className="w-full h-auto"
                />
              </div>
              <div className="pt-6 text-center">
                <h3 className="font-serif text-2xl text-stone-900 mb-2">Mug</h3>
                <p className="text-stone-500 text-sm">11oz white ceramic</p>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-stone-400 mt-8">Example images, for illustration.</p>

          <div className="text-center mt-12">
            <Button size="lg" className="min-h-[52px]" onClick={onStart}>Start Your Masterpiece</Button>
          </div>
        </div>
      </section>

      {/* 7. FOUNDER. True, and in the owner's (Dan's) own words, as he gave
          them for launch. No photo yet: add one here only when it is his. */}
      <section className="py-24 bg-stone-50 border-y border-stone-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-4xl text-stone-900 mb-2">From one parent to another</h2>
          <p className="text-xs uppercase tracking-widest text-stone-500 mb-8">Dan, founder and dad</p>
          <div className="space-y-6 text-stone-600 font-light text-lg leading-relaxed">
            <p>I'm a dad. I love art and illustration, and I love my kids' drawings.</p>
            <p>I wanted a way to keep them: to save them, and to make them into something cool enough to share as a gift.</p>
            <p>So I made Little Masterpiece, for my kids' drawings and for yours.</p>
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl text-center text-stone-900 mb-12">Common Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'What are the two looks?',
                a: "As drawn is your child's drawing cleaned up and ready to print. Screen print turns the drawing's own colours into one to three flat inks.",
              },
              {
                q: "Do you change my child's drawing?",
                a: 'Nothing is redrawn or added. As drawn keeps every line where they put it. Screen print keeps their drawing and simplifies its colours into flat inks.',
              },
              {
                q: 'What can I order?',
                a: 'A framed print in an oak frame, or an 11oz white ceramic mug.',
              },
              {
                q: 'Do I need an account?',
                a: 'No. You order as a guest and pay securely with Stripe.',
              },
              {
                q: 'Where do you deliver, and how long does it take?',
                a: 'We deliver worldwide. Your order is printed and posted by our print partner, Gelato. Delivery times depend on where you are: see Shipping & Returns, linked at the bottom of this page.',
              },
              {
                q: 'What currency are prices in?',
                a: 'Australian dollars, including GST. If your card is in another currency, your card provider converts it.',
              },
              {
                q: 'What happens to the photo of the drawing?',
                a: 'Both looks are made on your phone. When you order, only the finished print file is uploaded, to private storage, and sent to Gelato to print. Our Privacy Policy, linked below, has the details.',
              },
              {
                q: 'What if it arrives damaged?',
                a: "We'll reprint it or refund you. Shipping & Returns, linked below, explains how.",
              },
            ].map((faq, i) => (
              <div key={i} className="bg-stone-50 p-6 border border-stone-100 rounded-sm">
                <h3 className="font-serif text-lg text-stone-900 mb-2">{faq.q}</h3>
                <p className="text-stone-600 font-light">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button size="lg" className="min-h-[52px]" onClick={onStart}>Start Your Masterpiece</Button>
          </div>
        </div>
      </section>

    </div>
  );
};
