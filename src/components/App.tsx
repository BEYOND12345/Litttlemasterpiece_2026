
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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

/**
 * Navigation is view state, not a router, so each view change gets its own
 * history entry ({ view, y }) and Back walks them instead of leaving the site.
 */
type HistoryEntry = { view: AppView; y?: number };

function entryFrom(state: unknown): HistoryEntry | null {
  const view = (state as { view?: unknown } | null)?.view;
  if (typeof view !== 'string' || !(Object.values(AppView) as string[]).includes(view)) return null;
  const y = (state as { y?: unknown }).y;
  return { view: view as AppView, y: typeof y === 'number' ? y : undefined };
}

/**
 * Views a reload may come back to. The rest need an artwork or a user that
 * only lived in memory, so a reload on one of them starts at the landing page.
 */
const RELOADABLE = new Set<AppView>([
  AppView.HOME,
  AppView.STUDIO,
  AppView.ABOUT,
  AppView.BLOG,
  AppView.PRIVACY,
  AppView.TERMS,
  AppView.SHIPPING,
  AppView.CONTACT,
]);

/** A reload keeps the entry's state: come back to its view and place, if it can be shown. */
function reloadedEntry(): HistoryEntry | null {
  const entry = entryFrom(window.history.state);
  return entry && RELOADABLE.has(entry.view) ? entry : null;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(() => reloadedEntry()?.view ?? AppView.HOME);
  // The view as of the latest navigation, for the popstate listener and for
  // calls that arrive between a navigation and its render.
  const viewRef = useRef(currentView);
  // Where to scroll once a view brought back by Back, Forward or a reload has rendered.
  const pendingScroll = useRef<number | null>(reloadedEntry()?.y ?? null);
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  // Set while a parent's Order is on its way to Stripe (src/flow/checkout.ts):
  // which step it is on, or what went wrong.
  const [checkout, setCheckout] = useState<{ selection: OrderSelection; step: CheckoutStep; error: string | null } | null>(null);
  // Stripe's redirect back: ?session_id=cs_... after paying, ?checkout=cancelled if not.
  const [checkoutReturn, setCheckoutReturn] = useState(() => readCheckoutReturn(window.location.search));
  const checkoutRef = useRef(checkout);
  checkoutRef.current = checkout;

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
    // Keep this entry's { view } so Back still knows where it is.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    setCheckoutReturn(null);
  };

  useEffect(() => {
    // The page puts scroll back itself (below): the browser would restore it
    // before React has swapped the view, against the page being left.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    // The entry the parent arrived on. The URL is left exactly as it is, so a
    // return from Stripe (?session_id=, ?checkout=cancelled) still reads.
    window.history.replaceState({ view: viewRef.current, y: reloadedEntry()?.y }, '');

    const onPopState = (e: PopStateEvent) => {
      const entry = entryFrom(e.state);
      // An entry this app did not make (a #fragment): leave the view alone.
      if (!entry) return;
      const c = checkoutRef.current;
      if (c && !c.error) {
        // An order is on its way to Stripe and will open it whatever this page
        // shows, so Back holds here, on the overlay that says what is happening.
        window.history.pushState({ view: viewRef.current }, '');
        return;
      }
      // A failed checkout is over; it must not be waiting when the flow reopens.
      if (c) setCheckout(null);
      if (entry.view === viewRef.current) {
        window.scrollTo(0, entry.y ?? 0);
        return;
      }
      viewRef.current = entry.view;
      pendingScroll.current = entry.y ?? 0;
      setCurrentView(entry.view);
    };

    // Back from Stripe's page can restore this one from the back/forward cache
    // exactly as it was left: overlay up, on its last step, going nowhere.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && checkoutRef.current) setCheckout(null);
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useLayoutEffect(() => {
    if (pendingScroll.current === null) return;
    window.scrollTo(0, pendingScroll.current);
    pendingScroll.current = null;
  }, [currentView]);

  /**
   * Show a view. 'push' is a navigation the parent made, so Back returns
   * from it; 'replace' corrects the current entry without adding one.
   */
  const showView = (view: AppView, how: 'push' | 'replace') => {
    if (how === 'replace') {
      window.history.replaceState({ view }, '');
    } else if (view !== viewRef.current) {
      // Remember where the parent was on the page being left.
      window.history.replaceState({ view: viewRef.current, y: window.scrollY }, '');
      window.history.pushState({ view }, '');
    }
    viewRef.current = view;
    pendingScroll.current = null;
    setCurrentView(view);
    window.scrollTo(0, 0);
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
      showView(AppView.AUTH, 'push');
      return;
    }

    showView(view, 'push');
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

  // Set the first time the flow is shown; from then on it stays mounted.
  const [flowOpened, setFlowOpened] = useState(false);
  useEffect(() => {
    if (currentView === AppView.STUDIO) setFlowOpened(true);
  }, [currentView]);

  const renderContent = () => {
    switch (currentView) {
      case AppView.HOME:
        return <LandingPage onStart={() => handleStartCreating()} />;

      case AppView.STUDIO:
        // The flow itself is rendered outside this switch (see below) so it
        // survives a visit to another page. Checkout progress sits OVER it,
        // so Back returns to the parent's choices rather than an empty flow.
        return checkout ? (
          <CheckoutProgress
            step={checkout.step}
            error={checkout.error}
            onRetry={() => runCheckout(checkout.selection)}
            onBack={() => setCheckout(null)}
          />
        ) : null;

      case AppView.ENHANCEMENT:
        // Nothing to show (e.g. Back to an entry from before a reload): this
        // entry becomes the landing page rather than adding one.
        if (!activeArtwork) {
          showView(AppView.HOME, 'replace');
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
          showView(AppView.HOME, 'replace');
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
          {/* The Christmas flow stays mounted once opened, and is only hidden
              on other pages: a parent who checks Shipping & Returns before
              ordering comes back to their photo, look and gift instead of
              an empty flow. */}
          {flowOpened && (
            <div hidden={currentView !== AppView.STUDIO}>
              <MakeFlow initialFile={initialFile || undefined} onOrder={runCheckout} />
            </div>
          )}
          {renderContent()}
        </>
      )}
    </Layout>
  );
};

export default App;
