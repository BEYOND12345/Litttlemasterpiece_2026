
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
import { AppView, Artwork, User } from '../types/types';
import { getCurrentUser, onAuthStateChange } from '../services/authService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

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
        return (
          <SimplifiedStudio
            onComplete={handleArtworkComplete}
            onContinueToProducts={(artwork) => {
              setActiveArtwork(artwork);
              handleNavigate(AppView.CHECKOUT);
            }}
            initialFile={initialFile || undefined}
          />
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

      default:
        return <LandingPage onStart={() => handleStartCreating()} />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={handleNavigate} currentUser={currentUser}>
      {renderContent()}
    </Layout>
  );
};

export default App;
