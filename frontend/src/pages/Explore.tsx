import { useState } from 'react';
import { motion } from 'framer-motion';
import { useListings } from '../hooks/useListings';
import { NFTCard } from '../components/common/NFTCard';
import styles from './Explore.module.css';

export function Explore() {
    const [offset, setOffset] = useState(0);
    const limit = 20;
    const { data, isLoading, isFetching } = useListings(limit, offset);

    const loadMore = () => {
        setOffset(prev => prev + limit);
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Explore NFTs</h1>
                <p className={styles.subtitle}>
                    Discover unique digital collectibles on Creditcoin
                </p>
            </header>

            {isLoading ? (
                <div className={styles.grid}>
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className={styles.skeleton}>
                            <div className={styles.skeletonImage} />
                            <div className={styles.skeletonContent}>
                                <div className={styles.skeletonLine} />
                                <div className={styles.skeletonLine} style={{ width: '60%' }} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : data?.listings.length === 0 ? (
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>🐧</span>
                    <h2>No NFTs listed yet</h2>
                    <p>Be the first to list your NFT on igloo.market</p>
                </div>
            ) : (
                <>
                    <motion.div
                        className={styles.grid}
                        initial="hidden"
                        animate="visible"
                        variants={{
                            visible: {
                                transition: { staggerChildren: 0.05 }
                            }
                        }}
                    >
                        {data?.listings.map((listing) => (
                            <motion.div
                                key={listing.id}
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: { opacity: 1, y: 0 }
                                }}
                            >
                                <NFTCard listing={listing} />
                            </motion.div>
                        ))}
                    </motion.div>

                    {data && data.listings.length === limit && (
                        <div className={styles.loadMore}>
                            <button
                                className="btn btn-secondary"
                                onClick={loadMore}
                                disabled={isFetching}
                            >
                                {isFetching ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
