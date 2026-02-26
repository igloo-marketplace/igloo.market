# Igloo Market - Security & Transparency

> **Igloo Market** – NFT Marketplace on Creditcoin, by Creditcoin OGs

---

## Contract Information

| Item | Value |
|------|-------|
| **Network** | Creditcoin Mainnet (Chain ID: 102030) |
| **Contract Address** | `0x26840edB734C1482210CE8A83A4C13D9E672F21D` |
| **Contract Name** | NFTMarketplaceV3 |
| **Compiler** | Solidity v0.8.24 |
| **License** | MIT |
| **Verification** | Verified on Blockscout |

### Quick Links
- [View on Blockscout](https://creditcoin.blockscout.com/address/0x26840edB734C1482210CE8A83A4C13D9E672F21D)
- [Verified Source Code](https://creditcoin.blockscout.com/address/0x26840edB734C1482210CE8A83A4C13D9E672F21D?tab=contract)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Igloo Market                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [Seller]                              [Buyer]                 │
│      │                                     │                    │
│      │ 1. Sign order (EIP-712)             │                    │
│      │    (off-chain, no gas)              │                    │
│      ▼                                     │                    │
│   ┌──────────┐                             │                    │
│   │ Off-chain│  ◄── Order stored in DB     │                    │
│   │ Database │                             │                    │
│   └──────────┘                             │                    │
│                                            │                    │
│      │                                     │ 2. fulfillOrder()  │
│      │                                     │    (on-chain tx)   │
│      ▼                                     ▼                    │
│   ┌─────────────────────────────────────────────┐               │
│   │         NFTMarketplaceV3 Contract           │               │
│   │  • Verify EIP-712 signature                 │               │
│   │  • Transfer NFT (seller → buyer)            │               │
│   │  • Transfer WCTC payment (buyer → seller)   │               │
│   │  • Collect platform fee                     │               │
│   └─────────────────────────────────────────────┘               │
│                                                                 │
│   [Bidder]                              [NFT Owner]             │
│      │                                     │                    │
│      │ 1. createOffer()                    │                    │
│      │    (WCTC escrowed in contract)      │                    │
│      │                                     │ 2. acceptOffer()   │
│      ▼                                     ▼                    │
│   ┌─────────────────────────────────────────────┐               │
│   │  • Verify ownership & approval              │               │
│   │  • Transfer NFT (owner → bidder)            │               │
│   │  • Release escrowed WCTC (→ seller)         │               │
│   │  • Collect platform fee                     │               │
│   └─────────────────────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Payment Model

All settlements use **WCTC** (Wrapped CTC, an ERC-20 token).

| Method | Description |
|--------|-------------|
| **WCTC** | Buyer approves WCTC allowance, contract transfers via `safeTransferFrom` |
| **Native CTC** | `buyWithNative()` / `makeOfferWithNative()` auto-wraps CTC → WCTC, excess refunded |

---

## Permission Structure

### Owner Permissions

The contract inherits OpenZeppelin's `Ownable` pattern. The owner has **limited administrative capabilities**:

| Function | Description |
|----------|-------------|
| `setPlatformFee(uint256)` | Adjust platform fee (max 10%) |
| `setFeeRecipient(address)` | Change fee recipient address |

### What Owner CANNOT Do

| Action | Protected By |
|--------|--------------|
| Access user NFTs directly | EIP-712 signature required |
| Withdraw user funds | No such function exists |
| Cancel user orders | Only order creator can cancel |
| Modify order parameters | Immutable once signed |
| Upgrade contract logic | **Non-upgradeable** |
| Pause/freeze trading | No pause mechanism |
| Withdraw escrowed offer funds | Only bidder can cancel/reclaim |

### Fee Constraints

```solidity
uint256 public constant MAX_FEE_BPS = 1000; // Max 10% - immutable
uint256 public platformFeeBps;              // Actual fee - owner can change
```

| Fee Type | Value | Note |
|----------|-------|------|
| **Maximum cap** | 10% | Hardcoded, immutable, cannot be changed |
| **Current fee** | 0% | |
| **Fee visibility** | On-chain | Check via `platformFeeBps()` anytime |

- Fee changes are transparent (emits `PlatformFeeUpdated` event)

---

## Core Functions

### Listings (Order-based)

| Function | Description | Who Can Call |
|----------|-------------|--------------|
| `fulfillOrder(order, signature)` | Purchase NFT with WCTC | Anyone (buyer) |
| `buyWithNative(order, signature)` | Purchase NFT with native CTC (auto-wraps) | Anyone (buyer) |
| `cancelOrder(order)` | Cancel your own order | Seller only |
| `incrementNonce()` | Cancel ALL your orders at once | Any user |
| `isOrderValid(order, signature)` | Check if order is valid | Anyone (view) |

### Offers

| Function | Description | Who Can Call |
|----------|-------------|--------------|
| `createOffer(offer)` | Place an offer with WCTC escrow | Anyone (bidder) |
| `makeOfferWithNative(offer)` | Place an offer with native CTC (auto-wraps) | Anyone (bidder) |
| `acceptOffer(offer)` | Accept offer, receive WCTC | NFT owner |
| `cancelOffer(offer)` | Cancel offer, reclaim escrowed WCTC | Bidder only |

### For Admin (Owner Only)

| Function | Description | Constraint |
|----------|-------------|------------|
| `setPlatformFee(newFee)` | Set platform fee | Max 10% (1000 bps) |
| `setFeeRecipient(address)` | Set fee recipient | Non-zero address |

---

## Security Features

### 1. EIP-712 Typed Signatures
- Orders are signed off-chain using EIP-712 standard
- Prevents signature replay across different chains/contracts
- Domain separator: `IglooMarket` version `2`, chain ID `102030`

### 2. Reentrancy Protection
```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
```
- All state-changing functions protected by `nonReentrant` modifier
- Follows CEI (Checks-Effects-Interactions) pattern

### 3. Order Validation
- **Time**: Orders expire after specified timestamp
- **Nonce**: Prevents double-spending and enables batch cancellation
- **Ownership**: Verifies seller owns the NFT before transfer
- **Approval**: Verifies marketplace is approved to transfer NFT

### 4. Payment Safety (WCTC)
- Uses OpenZeppelin `SafeERC20` for all token transfers
- Excess native CTC refunded automatically in `buyWithNative` / `makeOfferWithNative`
- Failed transfers revert the entire transaction

### 5. Offer Escrow
- WCTC is held in the contract until the offer is accepted or cancelled
- Only the original bidder can cancel and reclaim escrowed funds
- Escrow amount is tracked per offer hash — no fund mixing

---

## Trust Assumptions

### What You're Trusting

| Trust Point | Mitigation |
|-------------|------------|
| Contract code is correct | Open source, verified on explorer |
| Owner won't set 10% fee | Fee visible on-chain, transparent |
| Off-chain order database | Orders require your signature anyway |
| Offer escrow is safe | Tracked per-hash, only bidder can reclaim |

### What You Don't Need to Trust

| Aspect | Reason |
|--------|--------|
| Custody of your NFTs | You hold them until sale |
| Custody of your funds | WCTC transfers are atomic |
| Contract upgrade risk | **Not upgradeable** |
| Emergency withdrawal | No such function exists |

---

## Commitment to Users

### Our Principles

1. **No Direct Asset Access**
   All asset movements require user signatures or explicit on-chain actions. We cannot move your NFTs or funds without your approval.

2. **Transparent Fee Structure**
   Platform fees are visible on-chain and capped at 10% by immutable code.

3. **Non-Custodial Design**
   Your assets remain in your wallet until the moment of sale. Offer escrow is fully trackable and reclaimable.

4. **Open Source**
   All smart contract code is open source under MIT license.

5. **Verified Contracts**
   All contracts are verified on Blockscout for public inspection.

### Risk Disclosure

 **Please be aware:**

- Smart contracts may contain undiscovered bugs
- This contract has not undergone a formal third-party audit
- Cryptocurrency transactions are irreversible
- Only trade NFTs you understand and trust
- DYOR (Do Your Own Research) before trading

---

## Contract Verification

### How to Verify

1. Visit [Blockscout Contract Page](https://creditcoin.blockscout.com/address/0x26840edB734C1482210CE8A83A4C13D9E672F21D?tab=contract)
2. Click "Contract" tab
3. Compare source code with this repository

### Verification Details

```
Contract: NFTMarketplaceV3
Compiler: v0.8.24+commit.e11b9ed9
Optimization: Enabled (200 runs)
EVM Version: Cancun
License: MIT
```

---

## Audit Status

| Item | Status |
|------|--------|
| Internal Code Review |  Complete |
| Formal Security Audit |  Planned |
| Bug Bounty Program |  Not yet |

We plan to conduct a formal security audit before significant trading volume.

---

## Contact & Support

- **Issues**: Please report security issues privately
- **X**: [Igloo Market](https://x.com/igloomarket)
---

*Last Updated: February 2026*
