export const nftMarketplaceAbi = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'nonces',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'orderHash', type: 'bytes32' }],
    name: 'filledOrders',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'orderHash', type: 'bytes32' }],
    name: 'cancelledOrders',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'platformFeeBps',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeRecipient',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        components: [
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
      },
    ],
    name: 'getOrderHash',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        components: [
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
      },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'isOrderValid',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'eip712Domain',
    outputs: [
      { name: 'fields', type: 'bytes1' },
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
      { name: 'salt', type: 'bytes32' },
      { name: 'extensions', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        components: [
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
      },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'fulfillOrder',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        components: [
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
      },
    ],
    name: 'cancelOrder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'incrementNonce',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderHash', type: 'bytes32' },
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: false, name: 'nftContract', type: 'address' },
      { indexed: false, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'price', type: 'uint256' },
    ],
    name: 'OrderFulfilled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderHash', type: 'bytes32' },
      { indexed: true, name: 'seller', type: 'address' },
    ],
    name: 'OrderCancelled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'newNonce', type: 'uint256' },
    ],
    name: 'NonceIncremented',
    type: 'event',
  },
  { inputs: [], name: 'OrderExpired', type: 'error' },
  { inputs: [], name: 'OrderIsCancelled', type: 'error' },
  { inputs: [], name: 'OrderAlreadyFilled', type: 'error' },
  { inputs: [], name: 'InvalidSignature', type: 'error' },
  { inputs: [], name: 'InvalidNonce', type: 'error' },
  { inputs: [], name: 'InsufficientPayment', type: 'error' },
  { inputs: [], name: 'NotApproved', type: 'error' },
  { inputs: [], name: 'TransferFailed', type: 'error' },
  { inputs: [], name: 'BuyerIsSeller', type: 'error' },
  { inputs: [], name: 'ZeroAddress', type: 'error' },
  { inputs: [], name: 'InvalidFee', type: 'error' },
] as const;

export type OrderTuple = {
  seller: `0x${string}`;
  assetType: number;
  nftContract: `0x${string}`;
  tokenId: bigint;
  amount: bigint;
  price: bigint;
  expiry: bigint;
  salt: bigint;
  nonce: bigint;
};
