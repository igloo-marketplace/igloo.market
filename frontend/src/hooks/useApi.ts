import { runtimeConfig } from '../config/env';
import type { ListingWithOrder, NFTMetadata, Transaction, Statistics, OrderJSON } from '../types';

const BASE_URL = runtimeConfig.apiBaseUrl;

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

export async function getListings(limit = 50, offset = 0): Promise<{ listings: ListingWithOrder[] }> {
  return fetchApi(`/listings?limit=${limit}&offset=${offset}`);
}

export async function getListing(id: number): Promise<ListingWithOrder> {
  return fetchApi(`/listings/${id}`);
}

export async function createListing(data: {
  order: OrderJSON;
  signature: string;
  metadata?: {
    name?: string;
    description?: string;
    image_url?: string;
  };
}): Promise<{ id: number; orderHash: string }> {
  return fetchApi('/listings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cancelListing(
  id: number,
  seller_address: string
): Promise<{ success: boolean; orderHash: string }> {
  return fetchApi(`/listings/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ seller_address }),
  });
}

export async function getUserListings(address: string): Promise<{ listings: ListingWithOrder[] }> {
  return fetchApi(`/user/${address}/listings`);
}

export async function getUserNonce(address: string): Promise<{ nonce: number }> {
  return fetchApi(`/user/${address}/nonce`);
}

export async function getUserHistory(address: string): Promise<{ transactions: Transaction[] }> {
  return fetchApi(`/user/${address}/history`);
}

export async function getNFTMetadata(
  contract: string,
  tokenId: string,
  isERC1155 = false
): Promise<NFTMetadata> {
  return fetchApi(`/nft/${contract}/${tokenId}?erc1155=${isERC1155}`);
}

export async function getContractInfo(): Promise<{ address: string; chainId: number }> {
  return fetchApi('/contract');
}

export async function getStatistics(): Promise<Statistics> {
  return fetchApi('/statistics');
}

export async function getHealth(): Promise<{
  status: string;
  timestamp: number;
  chainId: number;
  contract: string;
}> {
  return fetchApi('/health');
}

