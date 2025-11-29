import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useListings, useStatistics } from '../hooks/useListings';
import { NFTCard } from '../components/common/NFTCard';
import { formatEther } from 'viem';
import styles from './Home.module.css';

export function Home() {
    const { data: listingsData, isLoading } = useListings(8);
    const { data: stats } = useStatistics();

    return (
        <div className={styles.page}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <motion.div
                    className={styles.heroContent}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h1 className={styles.heroTitle}>
                        <span className={styles.heroIcon}>🐧</span>
                        <span>Discover, Collect,</span>
                        <span className={styles.gradient}>and Trade NFTs</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        NFT marketplace on Creditcoin
                    </p>
                    <div className={styles.heroCta}>
                        <Link to="/explore" className="btn btn-primary">
                            Explore NFTs
                        </Link>
                        <Link to="/sell" className="btn btn-secondary">
                            Start Selling
                        </Link>
                    </div>
                </motion.div>
            </section>

            {/* Stats Section */}
            {stats && (
                <section className={styles.stats}>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{stats.activeListings}</span>
                        <span className={styles.statLabel}>Active Listings</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{stats.totalSales}</span>
                        <span className={styles.statLabel}>Total Sales</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>
                            {parseFloat(formatEther(BigInt(stats.totalVolumeWei || '0'))).toFixed(0)} CTC
                        </span>
                        <span className={styles.statLabel}>Total Volume</span>
                    </div>
                </section>
            )}

            {/* Latest Listings */}
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Latest Listings</h2>
                    <Link to="/explore" className={styles.viewAll}>
                        View All →
                    </Link>
                </div>

                {isLoading ? (
                    <div className={styles.grid}>
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className={styles.skeleton}>
                                <div className={styles.skeletonImage} />
                                <div className={styles.skeletonContent}>
                                    <div className={styles.skeletonLine} />
                                    <div className={styles.skeletonLine} style={{ width: '60%' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : listingsData?.listings.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No listings yet. Be the first to sell!</p>
                        <Link to="/sell" className="btn btn-primary">
                            Create Listing
                        </Link>
                    </div>
                ) : (
                    <motion.div
                        className={styles.grid}
                        initial="hidden"
                        animate="visible"
                        variants={{
                            visible: {
                                transition: {
                                    staggerChildren: 0.1
                                }
                            }
                        }}
                    >
                        {listingsData?.listings.map((listing) => (
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
                )}
            </section>
        </div>
    );
}
