import { ReactNode } from 'react';
import { WagmiProvider, createStorage, noopStorage } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { creditcoinMainnet } from '../config/network';
import { runtimeConfig } from '../config/env';

const queryClient = new QueryClient();

const projectId = runtimeConfig.appKit.projectId;

const STORAGE_PROBE_KEY = '__igloo:storage-probe__';
const SESSION_FLAG_KEY = 'igloo:session-active';

function safeSessionStorage(): Storage | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        const { sessionStorage } = window;
        sessionStorage.setItem(STORAGE_PROBE_KEY, STORAGE_PROBE_KEY);
        sessionStorage.removeItem(STORAGE_PROBE_KEY);
        return sessionStorage;
    } catch {
        return undefined;
    }
}

function safeLocalStorage(): Storage | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        const { localStorage } = window;
        localStorage.setItem(STORAGE_PROBE_KEY, STORAGE_PROBE_KEY);
        localStorage.removeItem(STORAGE_PROBE_KEY);
        return localStorage;
    } catch {
        return undefined;
    }
}

const WALLET_STATE_KEYS = new Set<string>(['wagmi.store', 'walletconnect']);
const WALLET_STATE_PREFIXES = ['@appkit/', 'wc@2:', 'walletconnect:', 'w3m:', 'reown:'];

function shouldClearWalletState(key: string) {
    return WALLET_STATE_KEYS.has(key) || WALLET_STATE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function enforceSessionScopedWalletState() {
    const sessionStorage = safeSessionStorage();
    if (!sessionStorage) return;

    // Only clear once per browser session
    if (sessionStorage.getItem(SESSION_FLAG_KEY)) {
        return;
    }
    sessionStorage.setItem(SESSION_FLAG_KEY, Date.now().toString());

    const localStorage = safeLocalStorage();
    if (!localStorage) return;

    const keysToClear: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (shouldClearWalletState(key)) {
            keysToClear.push(key);
        }
    }

    keysToClear.forEach((key) => localStorage.removeItem(key));
}

if (typeof window !== 'undefined') {
    enforceSessionScopedWalletState();
}

const sessionScopedStorage = safeSessionStorage() ?? safeLocalStorage() ?? noopStorage;

const wagmiStorage = createStorage({
    storage: sessionScopedStorage,
});

const metadata = {
    name: 'igloo.market',
    description: 'NFT Marketplace on Creditcoin',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://igloo.market',
    icons: ['/igloo.svg']
};

const wagmiAdapter = new WagmiAdapter({
    networks: [creditcoinMainnet],
    projectId,
    ssr: false,
    storage: wagmiStorage
});

createAppKit({
    adapters: [wagmiAdapter],
    networks: [creditcoinMainnet],
    projectId,
    metadata,
    features: {
        analytics: false
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#4da4ff',
        '--w3m-border-radius-master': '12px',
        '--w3m-font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }
});

interface Props {
    children: ReactNode;
}

export function AppKitProvider({ children }: Props) {
    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
}
