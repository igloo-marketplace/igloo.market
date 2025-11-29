import { MARKETPLACE_CONFIG } from '../config/contracts';

export enum AssetType {
  ERC721 = 0,
  ERC1155 = 1,
}

export interface Order {
  seller: `0x${string}`;
  assetType: AssetType;
  nftContract: `0x${string}`;
  tokenId: bigint;
  amount: bigint;
  price: bigint;
  expiry: bigint;
  salt: bigint;
  nonce: bigint;
}

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

export const ORDER_TYPES = {
  Order: [
    { name: 'seller', type: 'address' },
    { name: 'assetType', type: 'uint8' },
    { name: 'nftContract', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'salt', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

export function generateSalt(): bigint {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return BigInt(
    '0x' +
      Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
  );
}

export function calculateExpiry(durationDays: number): bigint {
  const seconds = Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60;
  return BigInt(seconds);
}

export function isOrderExpired(order: Order): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return now >= order.expiry;
}

export function calculateFee(price: bigint): bigint {
  return (price * MARKETPLACE_CONFIG.PLATFORM_FEE_BPS) / MARKETPLACE_CONFIG.BPS_DENOMINATOR;
}

export function calculateSellerProceeds(price: bigint): bigint {
  return price - calculateFee(price);
}

export function createOrder(params: {
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint | string | number;
  price: bigint;
  durationDays?: number;
  isERC1155?: boolean;
  amount?: bigint | number;
  nonce: bigint | number;
}): Order {
  return {
    seller: params.seller,
    assetType: params.isERC1155 ? AssetType.ERC1155 : AssetType.ERC721,
    nftContract: params.nftContract,
    tokenId: BigInt(params.tokenId),
    amount: params.isERC1155 ? BigInt(params.amount ?? 1) : 1n,
    price: params.price,
    expiry: calculateExpiry(params.durationDays ?? MARKETPLACE_CONFIG.DEFAULT_LISTING_DURATION_DAYS),
    salt: generateSalt(),
    nonce: BigInt(params.nonce),
  };
}

export function orderToTuple(order: Order) {
  return {
    seller: order.seller,
    assetType: order.assetType,
    nftContract: order.nftContract,
    tokenId: order.tokenId,
    amount: order.amount,
    price: order.price,
    expiry: order.expiry,
    salt: order.salt,
    nonce: order.nonce,
  };
}

export function orderToJSON(order: Order): OrderJSON {
  return {
    seller: order.seller,
    assetType: order.assetType,
    nftContract: order.nftContract,
    tokenId: order.tokenId.toString(),
    amount: order.amount.toString(),
    price: order.price.toString(),
    expiry: order.expiry.toString(),
    salt: order.salt.toString(),
    nonce: order.nonce.toString(),
  };
}

export function jsonToOrder(json: OrderJSON): Order {
  return {
    seller: json.seller as `0x${string}`,
    assetType: json.assetType as AssetType,
    nftContract: json.nftContract as `0x${string}`,
    tokenId: BigInt(json.tokenId),
    amount: BigInt(json.amount),
    price: BigInt(json.price),
    expiry: BigInt(json.expiry),
    salt: BigInt(json.salt),
    nonce: BigInt(json.nonce),
  };
}

export function formatCTC(wei: bigint, decimals = 4): string {
  const ctc = Number(wei) / 1e18;
  return ctc.toFixed(decimals);
}

export function parseCTC(ctc: string): bigint {
  const value = parseFloat(ctc);
  if (isNaN(value) || value < 0) {
    throw new Error('Invalid CTC amount');
  }
  const [whole, fraction = ''] = ctc.split('.');
  const paddedFraction = fraction.padEnd(18, '0').slice(0, 18);
  return BigInt(whole + paddedFraction);
}

export function formatExpiry(expiry: bigint): string {
  const date = new Date(Number(expiry) * 1000);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTimeRemaining(expiry: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Number(expiry) - now;

  if (remaining <= 0) {
    return 'Expired';
  }

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  const minutes = Math.floor((remaining % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
