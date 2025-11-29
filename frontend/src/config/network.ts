import { defineChain } from 'viem';
import { runtimeConfig } from './env';

export const creditcoinMainnet = defineChain({
    id: runtimeConfig.network.chainId,
    name: runtimeConfig.network.name,
    nativeCurrency: {
        decimals: 18,
        name: 'Creditcoin',
        symbol: 'CTC',
    },
    rpcUrls: {
        default: {
            http: [runtimeConfig.network.rpcUrl],
        },
        public: {
            http: [runtimeConfig.network.rpcUrl],
        },
    },
    blockExplorers: {
        default: {
            name: 'Blockscout',
            url: runtimeConfig.network.blockExplorer,
        },
    },
});
