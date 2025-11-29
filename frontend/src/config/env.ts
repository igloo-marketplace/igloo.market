export const runtimeConfig = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    appKit: {
        projectId: import.meta.env.VITE_APPKIT_PROJECT_ID || 'demo-project-id'
    },
    network: {
        chainId: 102030,
        name: 'Creditcoin Mainnet',
        rpcUrl: import.meta.env.VITE_RPC_URL || 'https://mainnet3.creditcoin.network',
        blockExplorer: 'https://creditcoin.blockscout.com'
    }
};
