import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import { CartProvider } from './contexts/CartContext';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// /batch-test is the Phase 1 image-quality contact sheet. import.meta.env.DEV
// is replaced with false in a production build, so this branch and the
// dynamic import inside it are dropped and the page never ships.
if (import.meta.env.DEV && window.location.pathname === '/batch-test') {
  import('./dev/BatchTest').then(({ BatchTest }) => root.render(<BatchTest />));
} else {
  root.render(
    <StrictMode>
      <CartProvider>
        <App />
      </CartProvider>
    </StrictMode>
  );
}
