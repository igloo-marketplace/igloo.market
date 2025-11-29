export interface OrderJSON {
  seller: string;
  assetType: number;
  nftContract: string;
  tokenId: string;
  amount: string;
  price: string;
  expiry: string;
  salt: string;
  nonce: string;
}

export interface ListingMetadata {
  name?: string;
  description?: string;
  imageUrl?: string;
  attributes?: unknown[] | null;
}

export interface ListingWithOrder {
  id: number;
  order: OrderJSON;
  signature: string;
  orderHash: string;
  status: 'active' | 'filled' | 'cancelled' | 'expired';
  createdAt: number;
  expiresAt: number;
  metadata: ListingMetadata;
}

export interface NFTMetadata {
  contract_address: string;
  token_id: string;
  token_uri?: string;
  name?: string;
  description?: string;
  image_url?: string;
  image_type?: string;
  attributes?: string;
  resolved_image_url?: string;
}

export interface Transaction {
  id: number;
  listing_id?: number;
  order_hash: string;
  seller_address: string;
  buyer_address: string;
  nft_contract: string;
  token_id: string;
  amount?: number;
  price_wei: string;
  fee_wei: string;
  tx_hash: string;
  completed_at: number;
}

export interface Statistics {
  activeListings: number;
  totalSales: number;
  totalVolumeWei: string;
}

export interface ContractInfo {
  address: string;
  chainId: number;
}

