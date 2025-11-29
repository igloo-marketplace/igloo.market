import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useListing } from '../hooks/useListings';
import { useFulfillOrder, useCancelOrder, usePlatformFee, jsonToOrder } from '../hooks/useMarketplace';
import { NFTImage } from '../components/common/NFTImage';
import styles from './NFTDetail.module.css';

const DEFAULT_FEE_BPS = 20; // 0.2% (기본값, 할인 비교용)

export function NFTDetail() {
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get('listing');

  const { address, isConnected, connector } = useAccount();
  const { open } = useAppKit();
  const { data: listing, isLoading, refetch } = useListing(Number(listingId));

  const [error, setError] = useState<string | null>(null);

  // Fulfill order hook
  const {
    fulfillOrder,
    txHash: fulfillTxHash,
    isPending: isFulfilling,
    isSuccess: isFulfillSuccess,
    isError: isFulfillError,
    error: fulfillError,
    reset: resetFulfill,
  } = useFulfillOrder();

  // Cancel order hook
  const {
    cancelOrder,
    txHash: cancelTxHash,
    isPending: isCancelling,
    isSuccess: isCancelSuccess,
    error: cancelError,
    reset: resetCancel,
  } = useCancelOrder();

  // Platform fee from contract
  const { data: platformFeeBps } = usePlatformFee();
  const currentFeeBps = platformFeeBps !== undefined ? Number(platformFeeBps) : DEFAULT_FEE_BPS;
  const isDiscounted = currentFeeBps < DEFAULT_FEE_BPS;

  // Handle fulfill errors
  useEffect(() => {
    if (isFulfillError && fulfillError) {
      const message = fulfillError.message || 'Purchase failed';
      if (
        message.includes('rejected') ||
        message.includes('denied') ||
        message.includes('cancelled')
      ) {
        setError('Transaction was rejected');
      } else if (
        message.includes('connection') ||
        message.includes('disconnected') ||
        message.includes('session')
      ) {
        setError('Wallet connection issue. Please reconnect your wallet.');
      } else {
        setError(message);
      }
    }
  }, [isFulfillError, fulfillError]);

  // Handle cancel errors
  useEffect(() => {
    if (cancelError) {
      const message = cancelError.message || 'Cancel failed';
      setError(message);
    }
  }, [cancelError]);

  // Handle cancel success
  useEffect(() => {
    if (isCancelSuccess) {
      refetch();
    }
  }, [isCancelSuccess, refetch]);

  const handleBuy = async () => {
    if (!listing) {
      setError('Listing not found');
      return;
    }

    if (!isConnected || !address) {
      setError('Please connect your wallet');
      open();
      return;
    }

    // For WalletConnect/mobile, wake the modal if needed
    if (connector?.name?.toLowerCase().includes('walletconnect')) {
      open();
    }

    resetFulfill();
    setError(null);

    try {
      // Convert OrderJSON to Order type
      const order = jsonToOrder(listing.order);
      fulfillOrder(order, listing.signature as `0x${string}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to purchase';
      setError(message);
    }
  };

  const handleCancel = async () => {
    if (!listing) return;

    resetCancel();
    setError(null);

    try {
      const order = jsonToOrder(listing.order);
      cancelOrder(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel';
      setError(message);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton}>Loading...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <h2>Listing not found</h2>
          <p>This NFT might have been sold or the listing was cancelled.</p>
        </div>
      </div>
    );
  }

  const price = formatEther(BigInt(listing.order.price));
  const priceNum = parseFloat(price);
  const feeAmount = (priceNum * currentFeeBps) / 10000;
  const sellerReceives = priceNum - feeAmount;
  const feePercent = currentFeeBps / 100; // Convert BPS to percentage
  const isOwner = address?.toLowerCase() === listing.order.seller.toLowerCase();
  const isActive = listing.status === 'active';
  const isFilled = listing.status === 'filled';
  const isCancelled = listing.status === 'cancelled';
  const isExpired = listing.status === 'expired';
  const expiryDate = new Date(listing.expiresAt);
  const isERC1155 = listing.order.assetType === 1;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Image */}
        <div className={styles.imageSection}>
          <div className={styles.imageWrapper}>
            <NFTImage
              src={listing.metadata.imageUrl}
              alt={listing.metadata.name || `NFT #${listing.order.tokenId}`}
              fit="contain"
              autoPlay
            />
          </div>
        </div>

        {/* Info */}
        <div className={styles.infoSection}>
          <div className={styles.collection}>{truncateAddress(listing.order.nftContract)}</div>

          <h1 className={styles.name}>{listing.metadata.name || `#${listing.order.tokenId}`}</h1>

          {listing.metadata.description && (
            <p className={styles.description}>{listing.metadata.description}</p>
          )}

          <div className={styles.owner}>
            <span className={styles.ownerLabel}>Listed by</span>
            <span className={styles.ownerAddress}>{truncateAddress(listing.order.seller)}</span>
          </div>

          {/* Price Card */}
          <div className={styles.priceCard}>
            <div className={styles.priceHeader}>
              <span>{isFilled ? 'Sold Price' : 'Current Price'}</span>
              {isActive && <span className={styles.statusBadge}>For Sale</span>}
              {isFilled && <span className={styles.soldBadge}>Sold</span>}
              {isCancelled && <span className={styles.cancelledBadge}>Cancelled</span>}
              {isExpired && <span className={styles.expiredBadge}>Expired</span>}
            </div>

            <div className={styles.priceValue}>{priceNum.toFixed(4)} CTC</div>

            {isFilled && <div className={styles.soldNotice}>This item has been sold</div>}

            {isCancelled && (
              <div className={styles.cancelledNotice}>This listing has been cancelled</div>
            )}

            {isExpired && (
              <div className={styles.expiredNotice}>
                This listing expired on {expiryDate.toLocaleDateString()}
              </div>
            )}

            {isActive && !isOwner && (
              <>
                <div className={styles.breakdown}>
                  <div className={styles.breakdownRow}>
                    <span>You Pay</span>
                    <span>{priceNum.toFixed(4)} CTC</span>
                  </div>
                  <div className={styles.breakdownRow}>
                    <span>
                      Platform Fee{' '}
                      {isDiscounted ? (
                        <>
                          <span className={styles.originalFee}>(0.2%)</span>
                          <span className={styles.discountedFee}>
                            {feePercent === 0 ? 'FREE!' : `${feePercent}%`}
                          </span>
                        </>
                      ) : (
                        `(${feePercent}%)`
                      )}
                    </span>
                    <span>{feeAmount.toFixed(6)} CTC</span>
                  </div>
                  <div className={styles.breakdownRow}>
                    <span>Seller Receives</span>
                    <span>{sellerReceives.toFixed(4)} CTC</span>
                  </div>
                </div>

                <div className={styles.expiry}>
                  Expires: {expiryDate.toLocaleDateString()} {expiryDate.toLocaleTimeString()}
                </div>

                {error && <div className={styles.error}>{error}</div>}

                {isFulfillSuccess ? (
                  <div className={styles.success}>
                    Purchase successful! NFT transferred to your wallet.
                    {fulfillTxHash && (
                      <a
                        href={`https://creditcoin.blockscout.com/tx/${fulfillTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.txLink}
                      >
                        View Transaction
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    className={`btn btn-primary ${styles.buyBtn}`}
                    onClick={!isConnected ? () => open() : handleBuy}
                    disabled={isFulfilling}
                  >
                    {!isConnected
                      ? 'Connect Wallet'
                      : isFulfilling
                        ? 'Processing...'
                        : `Buy for ${priceNum.toFixed(2)} CTC`}
                  </button>
                )}
              </>
            )}

            {isOwner && isActive && (
              <div className={styles.ownerActions}>
                <div className={styles.ownerNotice}>This is your listing</div>

                {error && <div className={styles.error}>{error}</div>}

                {isCancelSuccess ? (
                  <div className={styles.success}>
                    Listing cancelled successfully!
                    {cancelTxHash && (
                      <a
                        href={`https://creditcoin.blockscout.com/tx/${cancelTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.txLink}
                      >
                        View Transaction
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    className={`btn btn-secondary ${styles.cancelBtn}`}
                    onClick={handleCancel}
                    disabled={isCancelling}
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel Listing'}
                  </button>
                )}
              </div>
            )}

            {isOwner && !isActive && (
              <div className={styles.ownerNotice}>This was your listing</div>
            )}
          </div>

          {/* Details */}
          <div className={styles.details}>
            <h3 className={styles.detailsTitle}>Details</h3>
            <div className={styles.detailRow}>
              <span>Contract</span>
              <a
                href={`https://creditcoin.blockscout.com/address/${listing.order.nftContract}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {truncateAddress(listing.order.nftContract)}
              </a>
            </div>
            <div className={styles.detailRow}>
              <span>Token ID</span>
              <span>{listing.order.tokenId}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Token Standard</span>
              <span>{isERC1155 ? 'ERC-1155' : 'ERC-721'}</span>
            </div>
            {isERC1155 && (
              <div className={styles.detailRow}>
                <span>Amount</span>
                <span>{listing.order.amount}</span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span>Order Hash</span>
              <a
                href={`https://creditcoin.blockscout.com/search-results?q=${listing.orderHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.orderHash}
              >
                {truncateAddress(listing.orderHash)}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
