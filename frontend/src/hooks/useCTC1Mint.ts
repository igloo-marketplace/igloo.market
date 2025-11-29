import { useCallback } from 'react';
import {
  usePublicClient,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ctc1Abi } from '../contract/ctc1Abi';
import { CONTRACTS } from '../config/contracts';

const CTC1_ADDRESS = CONTRACTS.CTC1_NFT as `0x${string}`;

export function useMintInfo() {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['ctc1-mint-info'],
    queryFn: async () => {
      if (!publicClient) throw new Error('No public client');

      const [mintStart, mintEnd, mintLimit, totalSupply, name, symbol] = await Promise.all([
        publicClient.readContract({
          address: CTC1_ADDRESS,
          abi: ctc1Abi,
          functionName: 'mintStart',
        }),
        publicClient.readContract({
          address: CTC1_ADDRESS,
          abi: ctc1Abi,
          functionName: 'mintEnd',
        }),
        publicClient.readContract({
          address: CTC1_ADDRESS,
          abi: ctc1Abi,
          functionName: 'mintLimit',
        }),
        publicClient.readContract({
          address: CTC1_ADDRESS,
          abi: ctc1Abi,
          functionName: 'totalSupply',
        }),
        publicClient.readContract({
          address: CTC1_ADDRESS,
          abi: ctc1Abi,
          functionName: 'name',
        }),
        publicClient.readContract({
          address: CTC1_ADDRESS,
          abi: ctc1Abi,
          functionName: 'symbol',
        }),
      ]);

      return {
        mintStart: Number(mintStart),
        mintEnd: Number(mintEnd),
        mintLimit: Number(mintLimit),
        totalSupply: Number(totalSupply),
        name: name as string,
        symbol: symbol as string,
      };
    },
    enabled: !!publicClient,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

export function useUserMintCount() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['ctc1-mint-count', address],
    queryFn: async () => {
      if (!publicClient || !address) return 0;

      const count = await publicClient.readContract({
        address: CTC1_ADDRESS,
        abi: ctc1Abi,
        functionName: 'mintCount',
        args: [address],
      });

      return Number(count);
    },
    enabled: !!publicClient && !!address,
    staleTime: 5000,
  });
}

export function useMint() {
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const {
    writeContract,
    data: txHash,
    isPending,
    isError,
    error,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const mint = useCallback(() => {
    writeContract({
      address: CTC1_ADDRESS,
      abi: ctc1Abi,
      functionName: 'mint',
    });
  }, [writeContract]);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ctc1-mint-info'] });
    queryClient.invalidateQueries({ queryKey: ['ctc1-mint-count', address] });
  }, [queryClient, address]);

  return {
    mint,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    error,
    receipt,
    reset,
    invalidateQueries,
  };
}

export function getMintingStatus(mintStart: number, mintEnd: number): 'before' | 'active' | 'ended' {
  const now = Math.floor(Date.now() / 1000);
  if (now < mintStart) return 'before';
  if (now > mintEnd) return 'ended';
  return 'active';
}

export function formatTimeRemaining(targetTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = targetTimestamp - now;

  if (diff <= 0) return '00:00:00';

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
