import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppKitProvider } from './providers/AppKitProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppKitProvider>
            <App />
        </AppKitProvider>
    </StrictMode>
);
