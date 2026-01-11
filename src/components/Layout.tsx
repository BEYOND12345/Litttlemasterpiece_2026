import React, { useState } from 'react';
import { AppView, User } from '../types/types';
import { signOut } from '../services/authService';
import { APP_NAME } from '../constants/constants';
import { LogOut } from 'lucide-react';
import { CartButton } from './CartButton';
import { CartSidebar } from './CartSidebar';

interface LayoutProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  currentUser: User | null;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ onNavigate, currentUser, children }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      onNavigate(AppView.HOME);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    onNavigate(AppView.CHECKOUT);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <button
              onClick={() => onNavigate(AppView.HOME)}
              className="font-serif text-2xl text-stone-900 hover:text-terracotta transition-colors"
            >
              {APP_NAME}
            </button>

            <nav className="flex items-center gap-6">
              <CartButton onClick={() => setIsCartOpen(true)} />
              {currentUser ? (
                <>
                  <button
                    onClick={() => onNavigate(AppView.DASHBOARD)}
                    className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    My Collection
                  </button>
                  <button
                    onClick={() => onNavigate(AppView.STUDIO)}
                    className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onNavigate(AppView.STUDIO)}
                    className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    Get Started
                  </button>
                  <button
                    onClick={() => onNavigate(AppView.AUTH)}
                    className="text-sm font-medium bg-stone-900 text-white px-4 py-2 hover:bg-stone-800 transition-colors"
                  >
                    Sign In
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />

      <main>{children}</main>

      <footer className="bg-stone-900 text-stone-400 mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <p className="font-serif text-2xl text-white mb-3">{APP_NAME}</p>
              <p className="text-sm font-light">Preserving childhood creativity with care and craft.</p>
            </div>

            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Explore</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <button
                    onClick={() => onNavigate(AppView.ABOUT)}
                    className="hover:text-white transition-colors"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate(AppView.BLOG)}
                    className="hover:text-white transition-colors"
                  >
                    Blog & Tips
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate(AppView.STUDIO)}
                    className="hover:text-white transition-colors"
                  >
                    Get Started
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <button
                    onClick={() => onNavigate(AppView.BLOG)}
                    className="hover:text-white transition-colors"
                  >
                    Photography Tips
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate(AppView.BLOG)}
                    className="hover:text-white transition-colors"
                  >
                    Style Guide
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate(AppView.BLOG)}
                    className="hover:text-white transition-colors"
                  >
                    Display Ideas
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-stone-800 pt-8 text-center">
            <p className="text-xs">&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
