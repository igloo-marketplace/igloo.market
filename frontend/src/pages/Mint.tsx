import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useMintInfo, useUserMintCount, useMint, getMintingStatus, formatTimeRemaining } from '../hooks/useCTC1Mint';
import styles from './Mint.module.css';

export function Mint() {
  const { isConnected } = useAccount();
  const { open } = useAppKit();

  const { data: mintInfo, isLoading: isLoadingInfo, refetch: refetchInfo } = useMintInfo();
  const { data: userMintCount = 0, refetch: refetchCount } = useUserMintCount();
  const { mint, txHash, isPending, isSuccess, isError, error, reset, invalidateQueries } = useMint();

  const [timeRemaining, setTimeRemaining] = useState('');
  const [mintingStatus, setMintingStatus] = useState<'before' | 'active' | 'ended'>('before');

  // Update countdown timer
  useEffect(() => {
    if (!mintInfo) return;

    const updateTimer = () => {
      const status = getMintingStatus(mintInfo.mintStart, mintInfo.mintEnd);
      setMintingStatus(status);

      if (status === 'before') {
        setTimeRemaining(formatTimeRemaining(mintInfo.mintStart));
      } else if (status === 'active') {
        setTimeRemaining(formatTimeRemaining(mintInfo.mintEnd));
      } else {
        setTimeRemaining('00:00:00');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [mintInfo]);

  // Refetch after successful mint
  useEffect(() => {
    if (isSuccess) {
      invalidateQueries();
      refetchInfo();
      refetchCount();
    }
  }, [isSuccess, invalidateQueries, refetchInfo, refetchCount]);

  const handleMint = useCallback(() => {
    if (!isConnected) {
      open();
      return;
    }
    reset();
    mint();
  }, [isConnected, open, reset, mint]);

  const canMint = mintingStatus === 'active' && userMintCount < (mintInfo?.mintLimit ?? 0);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoadingInfo) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Hero Section */}
        <div className={styles.hero}>
          <div className={styles.heroIcon}>&#128640;</div>
          <h1 className={styles.heroTitle}>CTC-1 Launch NFT</h1>
          <p className={styles.heroSubtitle}>
            Celebrate Creditcoin's satellite launch with a commemorative NFT
          </p>
        </div>

        {/* Status Card */}
        <div className={styles.statusCard}>
          <div className={styles.statusHeader}>
            {mintingStatus === 'before' && (
              <>
                <span className={styles.statusBadge} data-status="before">Coming Soon</span>
                <span className={styles.statusText}>Minting starts in</span>
              </>
            )}
            {mintingStatus === 'active' && (
              <>
                <span className={styles.statusBadge} data-status="active">Live Now</span>
                <span className={styles.statusText}>Minting ends in</span>
              </>
            )}
            {mintingStatus === 'ended' && (
              <>
                <span className={styles.statusBadge} data-status="ended">Ended</span>
                <span className={styles.statusText}>Minting has ended</span>
              </>
            )}
          </div>

          <div className={styles.countdown}>{timeRemaining}</div>

          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{mintInfo?.totalSupply ?? 0}</span>
              <span className={styles.statLabel}>Total Minted</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{mintInfo?.mintLimit ?? 0}</span>
              <span className={styles.statLabel}>Per Wallet</span>
            </div>
            {isConnected && (
              <div className={styles.statItem}>
                <span className={styles.statValue}>
                  {userMintCount}/{mintInfo?.mintLimit ?? 0}
                </span>
                <span className={styles.statLabel}>Your Mints</span>
              </div>
            )}
          </div>
        </div>

        {/* Mint Period Info */}
        {mintInfo && (
          <div className={styles.periodCard}>
            <div className={styles.periodRow}>
              <span className={styles.periodLabel}>Start</span>
              <span className={styles.periodValue}>{formatDate(mintInfo.mintStart)}</span>
            </div>
            <div className={styles.periodRow}>
              <span className={styles.periodLabel}>End</span>
              <span className={styles.periodValue}>{formatDate(mintInfo.mintEnd)}</span>
            </div>
          </div>
        )}

        {/* Mint Button */}
        <div className={styles.mintSection}>
          {isSuccess ? (
            <div className={styles.successMessage}>
              <span className={styles.successIcon}>&#10003;</span>
              <span>Successfully minted!</span>
              {txHash && (
                <a
                  href={`https://creditcoin.blockscout.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.txLink}
                >
                  View Transaction
                </a>
              )}
              <button className={styles.mintAgainBtn} onClick={reset}>
                Mint Another
              </button>
            </div>
          ) : (
            <>
              {isError && (
                <div className={styles.errorMessage}>
                  {error?.message?.includes('MintingNotStarted') && 'Minting has not started yet'}
                  {error?.message?.includes('MintingEnded') && 'Minting has ended'}
                  {error?.message?.includes('MintLimitExceeded') && 'You have reached your mint limit'}
                  {error?.message?.includes('rejected') && 'Transaction was rejected'}
                  {!error?.message?.includes('MintingNotStarted') &&
                    !error?.message?.includes('MintingEnded') &&
                    !error?.message?.includes('MintLimitExceeded') &&
                    !error?.message?.includes('rejected') &&
                    (error?.message ?? 'Mint failed')}
                </div>
              )}

              <button
                className={`btn btn-primary ${styles.mintBtn}`}
                onClick={handleMint}
                disabled={isPending || (isConnected && !canMint)}
              >
                {!isConnected
                  ? 'Connect Wallet'
                  : isPending
                    ? 'Minting...'
                    : mintingStatus === 'before'
                      ? 'Minting Not Started'
                      : mintingStatus === 'ended'
                        ? 'Minting Ended'
                        : userMintCount >= (mintInfo?.mintLimit ?? 0)
                          ? 'Limit Reached'
                          : 'Mint NFT (Free + Gas)'}
              </button>

              <p className={styles.mintHint}>
                {mintingStatus === 'active' && canMint && 'Free mint - only pay gas fees'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
