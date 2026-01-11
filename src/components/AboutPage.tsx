import React from 'react';
import { Heart, Sparkles, Users, Shield } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">

        <div className="text-center mb-16">
          <h1 className="font-serif text-5xl md:text-6xl text-stone-900 mb-6">
            Every Masterpiece Deserves Forever
          </h1>
          <p className="text-xl text-stone-600 font-light leading-relaxed max-w-2xl mx-auto">
            We believe that children's art is more than scribbles on paper. It's imagination made visible, creativity in its purest form, and memories worth preserving.
          </p>
        </div>

        <div className="bg-white border border-stone-200 shadow-sm mb-16">
          <img
            src="/Bedroom .png"
            alt="Child's artwork displayed in bedroom"
            className="w-full h-96 object-cover"
          />
        </div>

        <div className="prose prose-stone max-w-none mb-20">
          <h2 className="font-serif text-3xl text-stone-900 mb-6">Our Story</h2>
          <p className="text-stone-700 leading-relaxed mb-6">
            We started with a simple observation: every parent knows the heartbreak of discarding a child's artwork. The fridge door fills up, the art box overflows, and eventually, pieces disappear. But each drawing tells a story, captures a moment, and represents a stage in your child's creative journey.
          </p>
          <p className="text-stone-700 leading-relaxed mb-6">
            Our mission is to transform fleeting creations into lasting treasures. Using gentle restoration techniques and museum-quality printing, we help you preserve your little artist's work in ways that honour their creativity while fitting beautifully into your home.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          <div className="bg-white p-8 border border-stone-200 shadow-sm">
            <div className="w-12 h-12 bg-terracotta/10 rounded-full flex items-center justify-center mb-4">
              <Heart className="text-terracotta" size={24} />
            </div>
            <h3 className="font-serif text-2xl text-stone-900 mb-3">Made with Care</h3>
            <p className="text-stone-600 leading-relaxed">
              Every piece is carefully curated using gentle restoration that respects the original artwork. We enhance, never replace, your child's creative vision.
            </p>
          </div>

          <div className="bg-white p-8 border border-stone-200 shadow-sm">
            <div className="w-12 h-12 bg-terracotta/10 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="text-terracotta" size={24} />
            </div>
            <h3 className="font-serif text-2xl text-stone-900 mb-3">Gallery Quality</h3>
            <p className="text-stone-600 leading-relaxed">
              Archival-grade materials, professional framing options, and printing techniques ensure your child's art looks stunning for generations to come.
            </p>
          </div>

          <div className="bg-white p-8 border border-stone-200 shadow-sm">
            <div className="w-12 h-12 bg-terracotta/10 rounded-full flex items-center justify-center mb-4">
              <Users className="text-terracotta" size={24} />
            </div>
            <h3 className="font-serif text-2xl text-stone-900 mb-3">Family First</h3>
            <p className="text-stone-600 leading-relaxed">
              We're parents too. We understand the joy, pride, and occasional chaos that comes with raising creative little humans. This service is built by parents, for parents.
            </p>
          </div>

          <div className="bg-white p-8 border border-stone-200 shadow-sm">
            <div className="w-12 h-12 bg-terracotta/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="text-terracotta" size={24} />
            </div>
            <h3 className="font-serif text-2xl text-stone-900 mb-3">Safe & Secure</h3>
            <p className="text-stone-600 leading-relaxed">
              Your memories are precious. We use secure storage, encrypted backups, and never share your family's artwork without permission.
            </p>
          </div>
        </div>

        <div className="bg-stone-900 text-white p-12 text-center">
          <h2 className="font-serif text-3xl mb-4">Let's Preserve Their Magic Together</h2>
          <p className="text-stone-400 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
            Join thousands of families who have transformed their homes into galleries of childhood wonder. Start preserving your little artist's legacy today.
          </p>
          <button className="bg-terracotta text-white px-8 py-4 hover:bg-terracotta/90 transition-colors font-medium">
            Start Creating
          </button>
        </div>
      </div>
    </div>
  );
};
