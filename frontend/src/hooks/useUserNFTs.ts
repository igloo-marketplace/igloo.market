import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { fetchUserNFTs, BlockscoutNFT } from '../services/blockscout';

export function useUserNFTs() {
    const { address, isConnected } = useAccount();

    const query = useQuery<BlockscoutNFT[], Error>({
        queryKey: ['userNFTs', address],
        queryFn: () => fetchUserNFTs(address!, 'ERC-721,ERC-1155'),
        enabled: isConnected && !!address,
        staleTime: 30 * 1000, // 30 seconds
        refetchOnWindowFocus: true,
    });

    return {
        nfts: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    };
}
