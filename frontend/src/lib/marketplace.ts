import type { PublicClient, WalletClient } from 'viem';
import { nftMarketplaceAbi } from '../contract/marketplaceAbi';
import { erc721Abi, erc1155Abi } from '../contract/abi';
import { CONTRACTS, EIP712_DOMAIN } from '../config/contracts';
import { runtimeConfig } from '../config/env';
import { Order, ORDER_TYPES, orderToTuple } from './eip712';

export class MarketplaceClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null;
  private marketplaceAddress: `0x${string}`;
  private chainId: number;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient | null = null,
    marketplaceAddress: `0x${string}` = CONTRACTS.NFT_MARKETPLACE
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.marketplaceAddress = marketplaceAddress;
    this.chainId = runtimeConfig.network.chainId;
  }

  async getNonce(address: `0x${string}`): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'nonces',
      args: [address],
    });
  }

  async isApprovedForAll(
    nftContract: `0x${string}`,
    owner: `0x${string}`,
    isERC1155 = false
  ): Promise<boolean> {
    const abi = isERC1155 ? erc1155Abi : erc721Abi;
    return this.publicClient.readContract({
      address: nftContract,
      abi,
      functionName: 'isApprovedForAll',
      args: [owner, this.marketplaceAddress],
    });
  }

  async isOrderValid(order: Order, signature: `0x${string}`): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: this.marketplaceAddress,
        abi: nftMarketplaceAbi,
        functionName: 'isOrderValid',
        args: [orderToTuple(order), signature],
      });
    } catch {
      return false;
    }
  }

  async getOrderHash(order: Order): Promise<`0x${string}`> {
    return this.publicClient.readContract({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'getOrderHash',
      args: [orderToTuple(order)],
    });
  }

  async isOrderFilled(orderHash: `0x${string}`): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'filledOrders',
      args: [orderHash],
    });
  }

  async isOrderCancelled(orderHash: `0x${string}`): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'cancelledOrders',
      args: [orderHash],
    });
  }

  async getPlatformFeeBps(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'platformFeeBps',
    });
  }

  async estimateFulfillGas(order: Order, signature: `0x${string}`): Promise<bigint> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet not connected');
    }

    return this.publicClient.estimateContractGas({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'fulfillOrder',
      args: [orderToTuple(order), signature],
      value: order.price,
      account: this.walletClient.account,
    });
  }

  async approveMarketplace(
    nftContract: `0x${string}`,
    isERC1155 = false
  ): Promise<`0x${string}`> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet not connected');
    }

    const abi = isERC1155 ? erc1155Abi : erc721Abi;

    const hash = await this.walletClient.writeContract({
      address: nftContract,
      abi,
      functionName: 'setApprovalForAll',
      args: [this.marketplaceAddress, true],
      chain: null,
      account: this.walletClient.account,
    });

    return hash;
  }

  async signOrder(order: Order): Promise<`0x${string}`> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet not connected');
    }

    const signature = await this.walletClient.signTypedData({
      account: this.walletClient.account,
      domain: {
        name: EIP712_DOMAIN.name,
        version: EIP712_DOMAIN.version,
        chainId: this.chainId,
        verifyingContract: this.marketplaceAddress,
      },
      types: ORDER_TYPES,
      primaryType: 'Order',
      message: {
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
    });

    return signature;
  }

  async fulfillOrder(order: Order, signature: `0x${string}`): Promise<`0x${string}`> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet not connected');
    }

    const hash = await this.walletClient.writeContract({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'fulfillOrder',
      args: [orderToTuple(order), signature],
      value: order.price,
      chain: null,
      account: this.walletClient.account,
    });

    return hash;
  }

  async cancelOrder(order: Order): Promise<`0x${string}`> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet not connected');
    }

    const hash = await this.walletClient.writeContract({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'cancelOrder',
      args: [orderToTuple(order)],
      chain: null,
      account: this.walletClient.account,
    });

    return hash;
  }

  async incrementNonce(): Promise<`0x${string}`> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet not connected');
    }

    const hash = await this.walletClient.writeContract({
      address: this.marketplaceAddress,
      abi: nftMarketplaceAbi,
      functionName: 'incrementNonce',
      chain: null,
      account: this.walletClient.account,
    });

    return hash;
  }

  async waitForTransaction(hash: `0x${string}`) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  getMarketplaceAddress(): `0x${string}` {
    return this.marketplaceAddress;
  }

  getChainId(): number {
    return this.chainId;
  }
}

export function createMarketplaceClient(
  publicClient: PublicClient,
  walletClient?: WalletClient | null
): MarketplaceClient {
  return new MarketplaceClient(publicClient, walletClient ?? null);
}
