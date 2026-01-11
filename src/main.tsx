import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import { CartProvider } from './contexts/CartContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </StrictMode>
);
