const BLOCKSCOUT_API = 'https://creditcoin.blockscout.com/api/v2';

export interface BlockscoutNFT {
    id: string;
    image_url: string | null;
    animation_url: string | null;
    external_app_url: string | null;
    media_type: string | null;
    media_url: string | null;
    metadata: {
        name?: string;
        description?: string;
        image?: string;
        attributes?: Array<{
            trait_type: string;
            value: string | number;
        }>;
    } | null;
    token: {
        address_hash: string;
        name: string;
        symbol: string;
        type: 'ERC-721' | 'ERC-1155';
        total_supply: string;
        holders_count: string;
    };
    token_type: 'ERC-721' | 'ERC-1155';
    value: string;
}

export interface BlockscoutNFTResponse {
    items: BlockscoutNFT[];
    next_page_params: {
        token_contract_address_hash: string;
        token_id: string;
        token_type: string;
    } | null;
}

export async function fetchUserNFTs(
    address: string,
    type?: 'ERC-721' | 'ERC-1155' | 'ERC-721,ERC-1155'
): Promise<BlockscoutNFT[]> {
    const params = new URLSearchParams();
    if (type) {
        params.set('type', type);
    }

    const allNFTs: BlockscoutNFT[] = [];
    let url = `${BLOCKSCOUT_API}/addresses/${address}/nft?${params.toString()}`;

    while (url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch NFTs: ${response.statusText}`);
        }

        const data: BlockscoutNFTResponse = await response.json();
        allNFTs.push(...data.items);

        if (data.next_page_params) {
            const nextParams = new URLSearchParams();
            if (type) nextParams.set('type', type);
            nextParams.set('token_contract_address_hash', data.next_page_params.token_contract_address_hash);
            nextParams.set('token_id', data.next_page_params.token_id);
            nextParams.set('token_type', data.next_page_params.token_type);
            url = `${BLOCKSCOUT_API}/addresses/${address}/nft?${nextParams.toString()}`;
        } else {
            break;
        }
    }

    return allNFTs;
}

export interface BlockscoutNFTCollection {
    token: {
        address_hash: string;
        name: string;
        symbol: string;
        type: 'ERC-721' | 'ERC-1155';
    };
    amount: string;
}

export interface BlockscoutCollectionsResponse {
    items: BlockscoutNFTCollection[];
    next_page_params: unknown | null;
}

export async function fetchUserNFTCollections(address: string): Promise<BlockscoutNFTCollection[]> {
    const response = await fetch(`${BLOCKSCOUT_API}/addresses/${address}/nft/collections`);
    if (!response.ok) {
        throw new Error(`Failed to fetch NFT collections: ${response.statusText}`);
    }

    const data: BlockscoutCollectionsResponse = await response.json();
    return data.items;
}
