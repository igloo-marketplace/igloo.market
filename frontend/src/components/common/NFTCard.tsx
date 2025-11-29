import { Link } from 'react-router-dom';
import { formatEther } from 'viem';
import { NFTImage } from './NFTImage';
import type { ListingWithOrder } from '../../types';
import styles from './NFTCard.module.css';

interface Props {
  listing: ListingWithOrder;
}

export function NFTCard({ listing }: Props) {
  const price = formatEther(BigInt(listing.order.price));
  const isERC1155 = listing.order.assetType === 1;
  const amount = Number(listing.order.amount);

  return (
    <Link
      to={`/nft/${listing.order.nftContract}/${listing.order.tokenId}?listing=${listing.id}`}
      className={styles.card}
    >
      <div className={styles.imageWrapper}>
        <NFTImage
          src={listing.metadata.imageUrl}
          alt={listing.metadata.name || `NFT #${listing.order.tokenId}`}
          fit="contain"
        />
        {listing.status === 'filled' && <span className={styles.soldBadge}>SOLD</span>}
        {isERC1155 && amount > 1 && <span className={styles.badge}>x{amount}</span>}
      </div>

      <div className={styles.content}>
        <div className={styles.info}>
          <span className={styles.collection}>{truncateAddress(listing.order.nftContract)}</span>
          <h3 className={styles.name}>{listing.metadata.name || `#${listing.order.tokenId}`}</h3>
        </div>

        <div className={styles.priceRow}>
          <span className={styles.priceLabel}>Price</span>
          <span className={styles.price}>{parseFloat(price).toFixed(2)} CTC</span>
        </div>
      </div>
    </Link>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
