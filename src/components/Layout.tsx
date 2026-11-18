import React from 'react';
import { AppView, User } from '../types/types';
import { APP_NAME } from '../constants/constants';
import { BUSINESS } from './legal/business';
import { Placeholder } from './legal/LegalKit';

interface LayoutProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  /**
   * Still passed by App, unused: there are no accounts at launch, so the header
   * has no Sign In, no signed-in menu and no cart. Ordering is a guest checkout
   * from inside the flow.
   */
  currentUser?: User | null;
  children: React.ReactNode;
}

// Every link is at least 44px tall, so it can be hit with a thumb.
const footerLink =
  'inline-flex items-center min-h-[44px] min-w-[44px] text-left hover:text-white transition-colors';

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  const footerLinks: { label: string; view: AppView }[] = [
    { label: 'Shipping & Returns', view: AppView.SHIPPING },
    { label: 'Contact', view: AppView.CONTACT },
    { label: 'Privacy', view: AppView.PRIVACY },
    { label: 'Terms', view: AppView.TERMS },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-3 h-16 sm:h-20">
            <button
              onClick={() => onNavigate(AppView.HOME)}
              className="min-h-[44px] whitespace-nowrap font-serif text-xl sm:text-2xl text-stone-900 hover:text-terracotta transition-colors"
            >
              {APP_NAME}
            </button>

            {/* The same action as the landing page's Start button: open the
                flow. Hidden inside the flow, where it would do nothing. */}
            {currentView !== AppView.STUDIO && (
              <button
                onClick={() => onNavigate(AppView.STUDIO)}
                className="min-h-[44px] whitespace-nowrap px-4 text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-stone-900 text-stone-400 mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <p className="font-serif text-2xl text-white mb-3">{APP_NAME}</p>
              <p className="text-sm font-light">Framed prints and mugs made from your child's drawing.</p>
              <button onClick={() => onNavigate(AppView.STUDIO)} className={`${footerLink} text-sm text-white underline underline-offset-4 mt-2`}>
                Get Started
              </button>
            </div>

            <nav aria-label="Help and legal" className="md:col-span-2">
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-2">Help</h3>
              <ul className="grid grid-cols-2 gap-x-6 text-sm">
                {footerLinks.map((link) => (
                  <li key={link.view}>
                    <button onClick={() => onNavigate(link.view)} className={footerLink}>
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="border-t border-stone-800 pt-8 text-xs leading-relaxed space-y-2">
            <p>
              {BUSINESS.tradingName} is run by {BUSINESS.legalName}, ABN{' '}
              <Placeholder confirm="this ABN was taken from the owner's other business's website: check on the ABN Lookup that it is MotionStory Pty Ltd's">
                {BUSINESS.abn}
              </Placeholder>
              , {BUSINESS.location}.
            </p>
            <p>Printed by Gelato. Payments by Stripe. Prices in AUD, including GST.</p>
            <p>&copy; {new Date().getFullYear()} {BUSINESS.legalName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
