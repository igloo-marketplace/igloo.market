import { useMemo, useCallback, useEffect, useState } from 'react';
import {
  usePublicClient,
  useWalletClient,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MarketplaceClient } from '../lib/marketplace';
import { Order, createOrder, orderToJSON, jsonToOrder, OrderJSON } from '../lib/eip712';
import { CONTRACTS } from '../config/contracts';
import { nftMarketplaceAbi } from '../contract/marketplaceAbi';
import { erc721Abi, erc1155Abi } from '../contract/abi';

export function useMarketplaceClient(): MarketplaceClient | null {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!publicClient) return null;
    return new MarketplaceClient(publicClient, walletClient ?? null, CONTRACTS.NFT_MARKETPLACE);
  }, [publicClient, walletClient]);
}

export function useNonce(address: `0x${string}` | undefined) {
  const client = useMarketplaceClient();

  return useQuery({
    queryKey: ['nonce', address],
    queryFn: () => client!.getNonce(address!),
    enabled: !!client && !!address,
    staleTime: 10000,
  });
}

export function usePlatformFee() {
  const client = useMarketplaceClient();

  return useQuery({
    queryKey: ['platformFeeBps'],
    queryFn: () => client!.getPlatformFeeBps(),
    enabled: !!client,
    staleTime: 60000,
  });
}

export function useNFTApproval(nftContract: `0x${string}` | undefined, isERC1155 = false) {
  const { address } = useAccount();
  const client = useMarketplaceClient();
  const queryClient = useQueryClient();

  const approvalQuery = useQuery({
    queryKey: ['nftApproval', nftContract, address],
    queryFn: () => client!.isApprovedForAll(nftContract!, address!, isERC1155),
    enabled: !!client && !!nftContract && !!address,
    staleTime: 30000,
  });

  const { writeContract, data: approveTxHash, isPending: isApproving, error: approveError, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  const approve = useCallback(async () => {
    if (!nftContract) return;

    const abi = isERC1155 ? erc1155Abi : erc721Abi;
    writeContract({
      address: nftContract,
      abi,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.NFT_MARKETPLACE, true],
    });
  }, [nftContract, isERC1155, writeContract]);

  useEffect(() => {
    if (isApproveConfirmed) {
      queryClient.invalidateQueries({ queryKey: ['nftApproval', nftContract, address] });
    }
  }, [isApproveConfirmed, queryClient, nftContract, address]);

  return {
    isApproved: approvalQuery.data ?? false,
    isLoading: approvalQuery.isLoading,
    approve,
    isApproving: isApproving || isConfirming,
    isApproveConfirmed,
    approveError,
    approveTxHash,
    reset,
    refetch: approvalQuery.refetch,
  };
}

export function useSignOrder() {
  const client = useMarketplaceClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signOrder = useCallback(
    async (order: Order): Promise<`0x${string}`> => {
      if (!client) throw new Error('Client not initialized');
      setIsPending(true);
      setError(null);
      try {
        const signature = await client.signOrder(order);
        return signature;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to sign order');
        setError(error);
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    [client]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { signOrder, isPending, error, reset };
}

export function useFulfillOrder() {
  const queryClient = useQueryClient();

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const fulfillOrder = useCallback(
    (order: Order, signature: `0x${string}`) => {
      writeContract({
        address: CONTRACTS.NFT_MARKETPLACE,
        abi: nftMarketplaceAbi,
        functionName: 'fulfillOrder',
        args: [
          {
            seller: order.seller,
            assetType: order.assetType,
            nftContract: order.nftContract,
            tokenId: order.tokenId,
            amount: order.amount,
            price: order.price,
            expiry: order.expiry,
            salt: order.salt,
            nonce: order.nonce,
          },
          signature,
        ],
        value: order.price,
        gas: 350000n,
      });
    },
    [writeContract]
  );

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    }
  }, [isSuccess, queryClient]);

  return {
    fulfillOrder,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError: !!error || isReceiptError,
    error: error || receiptError,
    reset,
  };
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const cancelOrder = useCallback(
    (order: Order) => {
      writeContract({
        address: CONTRACTS.NFT_MARKETPLACE,
        abi: nftMarketplaceAbi,
        functionName: 'cancelOrder',
        args: [
          {
            seller: order.seller,
            assetType: order.assetType,
            nftContract: order.nftContract,
            tokenId: order.tokenId,
            amount: order.amount,
            price: order.price,
            expiry: order.expiry,
            salt: order.salt,
            nonce: order.nonce,
          },
        ],
      });
    },
    [writeContract]
  );

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    }
  }, [isSuccess, queryClient]);

  return {
    cancelOrder,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useIncrementNonce() {
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const incrementNonce = useCallback(() => {
    writeContract({
      address: CONTRACTS.NFT_MARKETPLACE,
      abi: nftMarketplaceAbi,
      functionName: 'incrementNonce',
    });
  }, [writeContract]);

  useEffect(() => {
    if (isSuccess && address) {
      queryClient.invalidateQueries({ queryKey: ['nonce', address] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    }
  }, [isSuccess, queryClient, address]);

  return {
    incrementNonce,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
  };
}

export function useOrderValidity(order: Order | null, signature: `0x${string}` | null) {
  const client = useMarketplaceClient();

  return useQuery({
    queryKey: ['orderValidity', order?.salt?.toString(), signature],
    queryFn: () => client!.isOrderValid(order!, signature!),
    enabled: !!client && !!order && !!signature,
    staleTime: 30000,
  });
}

export function useGasEstimate(order: Order | null, signature: `0x${string}` | null) {
  const client = useMarketplaceClient();
  const { address } = useAccount();

  return useQuery({
    queryKey: ['gasEstimate', order?.salt?.toString(), signature],
    queryFn: () => client!.estimateFulfillGas(order!, signature!),
    enabled: !!client && !!order && !!signature && !!address,
    staleTime: 30000,
    retry: false,
  });
}

export { createOrder, orderToJSON, jsonToOrder };
export type { Order, OrderJSON };
