
import React, { useState, useEffect } from 'react';
import { Layout } from './Layout';
import { LandingPage } from './LandingPage';
import { SimplifiedStudio } from './SimplifiedStudio';
import { MockupGallery } from './MockupGallery';
import { AuthPage } from './AuthPage';
import { Dashboard } from './Dashboard';
import { AboutPage } from './AboutPage';
import { BlogPage } from './BlogPage';
import { CheckoutPage } from './CheckoutPage';
import { MockupTemplateManager } from './MockupTemplateManager';
import { MockupDiagnostic } from './MockupDiagnostic';
import { PrivacyPage } from './legal/PrivacyPage';
import { TermsPage } from './legal/TermsPage';
import { ShippingReturnsPage } from './legal/ShippingReturnsPage';
import { ContactPage } from './legal/ContactPage';
import { MakeFlow, OrderSelection } from '../flow/MakeFlow';
import { startCheckout } from '../flow/checkout';
import { CheckoutStep, readCheckoutReturn } from '../flow/checkoutLogic';
import { CheckoutProgress } from '../flow/CheckoutProgress';
import { OrderConfirmed } from '../flow/OrderConfirmed';
import { AppView, Artwork, User } from '../types/types';
import { getCurrentUser, onAuthStateChange } from '../services/authService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  // Set while a parent's Order is on its way to Stripe (src/flow/checkout.ts):
  // which step it is on, or what went wrong.
  const [checkout, setCheckout] = useState<{ selection: OrderSelection; step: CheckoutStep; error: string | null } | null>(null);
  // Stripe's redirect back: ?session_id=cs_... after paying, ?checkout=cancelled if not.
  const [checkoutReturn, setCheckoutReturn] = useState(() => readCheckoutReturn(window.location.search));

  const runCheckout = async (selection: OrderSelection) => {
    setCheckout({ selection, step: 'order', error: null });
    try {
      // On success this navigates away to Stripe; the overlay stays up until it does.
      await startCheckout(selection, (step) => setCheckout((c) => (c ? { ...c, step } : c)));
    } catch (e) {
      console.error('Checkout failed:', e);
      const error = e instanceof Error ? e.message : 'Something went wrong. Nothing has been charged.';
      setCheckout((c) => (c ? { ...c, error } : c));
    }
  };

  const clearCheckoutReturn = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setCheckoutReturn(null);
  };

  useEffect(() => {
    getCurrentUser().then(user => {
      setCurrentUser(user);
      console.log('🔐 Auth initialized, user:', user ? user.email : 'not logged in');
    });

    const { data: { subscription } } = onAuthStateChange((user) => {
      setCurrentUser(user);
      console.log('🔐 Auth state changed, user:', user ? user.email : 'logged out');
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleNavigate = (view: AppView) => {
    console.log('🧭 Navigation request:', view, 'User:', currentUser ? 'authenticated' : 'not authenticated');

    // Prevent navigation to auth-required pages without authentication
    const requiresAuth = [AppView.DASHBOARD, AppView.ENHANCEMENT];

    if (requiresAuth.includes(view) && !currentUser) {
      console.warn('⚠️ Auth required for', view, '- redirecting to auth page');
      setCurrentView(AppView.AUTH);
      window.scrollTo(0, 0);
      return;
    }

    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const handleStartCreating = (file?: File) => {
    if (file) setInitialFile(file);
    handleNavigate(AppView.STUDIO);
  };

  const handleArtworkComplete = async (artwork: Artwork) => {
    console.log('✅ Artwork save complete:', artwork.id);
    setActiveArtwork(artwork);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    handleNavigate(AppView.DASHBOARD);
  };

  const renderContent = () => {
    switch (currentView) {
      case AppView.HOME:
        return <LandingPage onStart={() => handleStartCreating()} />;

      case AppView.STUDIO:
        // The Christmas flow: photo, two looks, two products. The old studio
        // (SimplifiedStudio) is still used for editing saved artworks below.
        // Checkout progress sits OVER the flow, not instead of it, so Back
        // returns to the parent's choices rather than to an empty flow.
        return (
          <>
            <MakeFlow initialFile={initialFile || undefined} onOrder={runCheckout} />
            {checkout && (
              <CheckoutProgress
                step={checkout.step}
                error={checkout.error}
                onRetry={() => runCheckout(checkout.selection)}
                onBack={() => setCheckout(null)}
              />
            )}
          </>
        );

      case AppView.ENHANCEMENT:
        if (!activeArtwork) {
          handleNavigate(AppView.HOME);
          return null;
        }
        return (
          <SimplifiedStudio
            existingArtwork={activeArtwork}
            onComplete={handleArtworkComplete}
            onContinueToProducts={(artwork) => {
              setActiveArtwork(artwork);
              handleNavigate(AppView.CHECKOUT);
            }}
          />
        );

      case AppView.MOCKUP_GALLERY:
        if (!activeArtwork) {
          handleNavigate(AppView.HOME);
          return null;
        }
        return <MockupGallery artwork={activeArtwork} onBack={() => handleNavigate(AppView.HOME)} />;

      case AppView.AUTH:
        return <AuthPage onLogin={handleLogin} />;

      case AppView.DASHBOARD:
        if (!currentUser) return <AuthPage onLogin={handleLogin} />;
        return (
          <Dashboard
            user={currentUser}
            onSelectArtwork={(art) => {
              setActiveArtwork(art);
            }}
            onNewArtwork={() => handleStartCreating()}
          />
        );

      case AppView.ABOUT:
        return <AboutPage />;

      case AppView.BLOG:
        return <BlogPage />;

      case AppView.CHECKOUT:
        return (
          <CheckoutPage
            onBack={() => activeArtwork ? handleNavigate(AppView.ENHANCEMENT) : handleNavigate(AppView.HOME)}
            onOrderComplete={(orderId) => {
              setCompletedOrderId(orderId);
              handleNavigate(AppView.DASHBOARD);
            }}
            artwork={activeArtwork || undefined}
          />
        );

      case AppView.ADMIN:
        return <MockupTemplateManager />;

      case AppView.DIAGNOSTIC:
        return <MockupDiagnostic />;

      case AppView.PRIVACY:
        return <PrivacyPage />;

      case AppView.TERMS:
        return <TermsPage onNavigate={handleNavigate} />;

      case AppView.SHIPPING:
        return <ShippingReturnsPage onNavigate={handleNavigate} />;

      case AppView.CONTACT:
        return <ContactPage onNavigate={handleNavigate} />;

      default:
        return <LandingPage onStart={() => handleStartCreating()} />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={handleNavigate} currentUser={currentUser}>
      {checkoutReturn?.kind === 'paid' ? (
        <OrderConfirmed
          sessionId={checkoutReturn.sessionId}
          onDone={() => {
            clearCheckoutReturn();
            handleNavigate(AppView.STUDIO);
          }}
        />
      ) : (
        <>
          {checkoutReturn?.kind === 'cancelled' && (
            <div role="status" className="bg-white border-b border-stone-200">
              <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-4 text-stone-700">
                <span>Payment cancelled. Nothing was charged.</span>
                <button onClick={clearCheckoutReturn} className="min-h-[44px] px-3 text-stone-600 underline">
                  OK
                </button>
              </div>
            </div>
          )}
          {renderContent()}
        </>
      )}
    </Layout>
  );
};

export default App;
