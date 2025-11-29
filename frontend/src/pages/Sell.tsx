import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { createListing } from '../hooks/useApi';
import {
  useNonce,
  useNFTApproval,
  useSignOrder,
  usePlatformFee,
  createOrder,
  orderToJSON,
} from '../hooks/useMarketplace';
import { useUserNFTs } from '../hooks/useUserNFTs';
import { NFTImage } from '../components/common/NFTImage';
import type { BlockscoutNFT } from '../services/blockscout';
import styles from './Sell.module.css';

const DEFAULT_FEE_BPS = 20; // 0.2% (기본값, 할인 비교용)

type Step = 'form' | 'approve' | 'sign' | 'submit' | 'done';

export function Sell() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { nfts, isLoading: isLoadingNFTs, refetch: refetchNFTs } = useUserNFTs();

  // Form state
  const [nftContract, setNftContract] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [price, setPrice] = useState('');
  const [isERC1155, setIsERC1155] = useState(false);
  const [amount, setAmount] = useState('1');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedNFT, setSelectedNFT] = useState<BlockscoutNFT | null>(null);
  const [expiryDays, setExpiryDays] = useState('30');

  // Transaction state
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const { data: nonce } = useNonce(address);
  const {
    isApproved,
    isLoading: isLoadingApproval,
    approve,
    isApproving,
    isApproveConfirmed,
    approveError,
    reset: resetApproval,
    refetch: refetchApproval,
  } = useNFTApproval(nftContract as `0x${string}` | undefined, isERC1155);
  const { signOrder, isPending: isSigning, error: signError, reset: resetSign } = useSignOrder();

  // Platform fee from contract
  const { data: platformFeeBps } = usePlatformFee();
  const currentFeeBps = platformFeeBps !== undefined ? Number(platformFeeBps) : DEFAULT_FEE_BPS;
  const feePercent = currentFeeBps / 100;
  const isDiscounted = currentFeeBps < DEFAULT_FEE_BPS;

  // Handle approval confirmation
  useEffect(() => {
    if (isApproveConfirmed && step === 'approve') {
      setStep('sign');
      refetchApproval();
    }
  }, [isApproveConfirmed, step, refetchApproval]);

  // Handle approval errors
  useEffect(() => {
    if (approveError && step === 'approve') {
      setError(approveError.message || 'Approval failed');
      setStep('form');
      resetApproval();
    }
  }, [approveError, step, resetApproval]);

  // Handle sign errors
  useEffect(() => {
    if (signError && step === 'sign') {
      setError(signError.message || 'Signing failed');
      setStep('form');
      resetSign();
    }
  }, [signError, step, resetSign]);

  const handleSelectNFT = (nft: BlockscoutNFT) => {
    setSelectedNFT(nft);
    setNftContract(nft.token.address_hash);
    setTokenId(nft.id);
    setIsERC1155(nft.token_type === 'ERC-1155');
    setAmount(nft.value);
    setName(nft.metadata?.name || '');
    setDescription(nft.metadata?.description || '');
    setImageUrl(nft.image_url || nft.metadata?.image || '');
  };

  const clearSelection = () => {
    setSelectedNFT(null);
    setNftContract('');
    setTokenId('');
    setIsERC1155(false);
    setAmount('1');
    setName('');
    setDescription('');
    setImageUrl('');
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!address || nonce === undefined) return;

      setError(null);

      try {
        // Validate inputs
        if (!nftContract.startsWith('0x') || nftContract.length !== 42) {
          throw new Error('Invalid contract address');
        }
        if (!tokenId || isNaN(Number(tokenId))) {
          throw new Error('Invalid token ID');
        }
        if (!price || parseFloat(price) <= 0) {
          throw new Error('Price must be greater than 0');
        }

        // Check if approval is needed
        if (!isApproved) {
          setStep('approve');
          approve();
          return;
        }

        // Create EIP-712 order
        const order = createOrder({
          seller: address,
          nftContract: nftContract as `0x${string}`,
          tokenId: BigInt(tokenId),
          price: parseEther(price),
          isERC1155,
          amount: isERC1155 ? BigInt(amount) : 1n,
          nonce: BigInt(nonce),
          durationDays: parseInt(expiryDays),
        });

        // Sign the order
        setStep('sign');
        const signature = await signOrder(order);

        // Submit to backend
        setStep('submit');
        const result = await createListing({
          order: orderToJSON(order),
          signature,
          metadata: {
            name: name || undefined,
            description: description || undefined,
            image_url: imageUrl || undefined,
          },
        });

        // Success - navigate to listing detail
        setStep('done');
        navigate(`/nft/${nftContract}/${tokenId}?listing=${result.id}`);
      } catch (err) {
        if (err instanceof Error) {
          // Check for user rejection
          if (
            err.message.includes('rejected') ||
            err.message.includes('denied') ||
            err.message.includes('cancelled')
          ) {
            setError('Transaction was rejected');
          } else {
            setError(err.message);
          }
        } else {
          setError('Failed to create listing');
        }
        setStep('form');
      }
    },
    [
      address,
      nonce,
      nftContract,
      tokenId,
      price,
      isERC1155,
      amount,
      isApproved,
      approve,
      signOrder,
      expiryDays,
      name,
      description,
      imageUrl,
      navigate,
    ]
  );

  // Continue after approval
  useEffect(() => {
    if (isApproved && step === 'sign' && !isSigning) {
      // Re-trigger the sign flow
      handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    }
  }, [isApproved, step, isSigning, handleSubmit]);

  const getButtonText = () => {
    switch (step) {
      case 'approve':
        return isApproving ? 'Approving...' : 'Approve NFT';
      case 'sign':
        return isSigning ? 'Sign in Wallet...' : 'Sign Order';
      case 'submit':
        return 'Creating Listing...';
      default:
        return isApproved ? 'Sign & List for Sale' : 'Approve & List for Sale';
    }
  };

  if (!isConnected) {
    return (
      <div className={styles.page}>
        <div className={styles.notConnected}>
          <span className={styles.icon}>🔒</span>
          <h2>Connect Your Wallet</h2>
          <p>Connect your wallet to start selling NFTs</p>
          <button className="btn btn-primary" onClick={() => open()}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Sell Your NFT</h1>
          <p>List your NFT on igloo.market</p>
        </header>

        {/* My NFTs Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            My NFTs
            <button
              className={styles.refreshBtn}
              onClick={() => refetchNFTs()}
              disabled={isLoadingNFTs}
              type="button"
            >
              ↻
            </button>
          </h2>

          {isLoadingNFTs ? (
            <div className={styles.loading}>Loading your NFTs...</div>
          ) : nfts.length === 0 ? (
            <div className={styles.emptyNFTs}>
              <p>No NFTs found in your wallet</p>
              <span className={styles.hint}>Or enter the details manually below</span>
            </div>
          ) : (
            <div className={styles.nftGrid}>
              {nfts.map((nft) => (
                <button
                  key={`${nft.token.address_hash}-${nft.id}`}
                  className={`${styles.nftItem} ${
                    selectedNFT?.token.address_hash === nft.token.address_hash &&
                    selectedNFT?.id === nft.id
                      ? styles.selected
                      : ''
                  }`}
                  onClick={() => handleSelectNFT(nft)}
                  type="button"
                >
                  <div className={styles.nftImage}>
                    <NFTImage
                      src={nft.image_url || nft.metadata?.image}
                      alt={nft.metadata?.name || `NFT #${nft.id}`}
                      fit="contain"
                    />
                  </div>
                  <div className={styles.nftInfo}>
                    <span className={styles.nftName}>
                      {nft.metadata?.name || `${nft.token.symbol} #${nft.id}`}
                    </span>
                    <span className={styles.nftContract}>
                      {nft.token.address_hash.slice(0, 6)}...{nft.token.address_hash.slice(-4)}
                    </span>
                    <span className={styles.nftTokenId}>Token ID: {nft.id}</span>
                    <div className={styles.nftMeta}>
                      <span className={styles.nftType}>{nft.token_type}</span>
                      {nft.token_type === 'ERC-1155' && parseInt(nft.value) > 1 && (
                        <span className={styles.nftAmount}>x{nft.value}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* NFT Info */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              NFT Information
              {selectedNFT && (
                <button type="button" className={styles.clearBtn} onClick={clearSelection}>
                  Clear Selection
                </button>
              )}
            </h2>

            <div className={styles.field}>
              <label className={styles.label}>Contract Address *</label>
              <input
                type="text"
                className={`input ${selectedNFT ? styles.inputDisabled : ''}`}
                placeholder="0x..."
                value={nftContract}
                onChange={(e) => setNftContract(e.target.value)}
                disabled={!!selectedNFT}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Token ID *</label>
              <input
                type="text"
                className={`input ${selectedNFT ? styles.inputDisabled : ''}`}
                placeholder="1"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                disabled={!!selectedNFT}
                required
              />
            </div>

            <div className={styles.field}>
              <label
                className={`${styles.checkbox} ${selectedNFT ? styles.checkboxDisabled : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isERC1155}
                  onChange={(e) => setIsERC1155(e.target.checked)}
                  disabled={!!selectedNFT}
                />
                <span>This is an ERC-1155 NFT</span>
              </label>
            </div>

            {isERC1155 && (
              <div className={styles.field}>
                <label className={styles.label}>Amount</label>
                <input
                  type="number"
                  className={`input ${selectedNFT ? styles.inputDisabled : ''}`}
                  placeholder="1"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={!!selectedNFT}
                />
              </div>
            )}

            {/* Approval Status */}
            {nftContract && (
              <div className={styles.approvalStatus}>
                {isLoadingApproval ? (
                  <span className={styles.statusLoading}>Checking approval...</span>
                ) : isApproved ? (
                  <span className={styles.statusApproved}>✓ Approved for marketplace</span>
                ) : (
                  <span className={styles.statusNotApproved}>
                    ⚠ Approval needed before listing
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Pricing</h2>

            <div className={styles.field}>
              <label className={styles.label}>Price (CTC) *</label>
              <input
                type="number"
                className={`input ${selectedNFT && !price ? styles.inputRequired : ''}`}
                placeholder="10"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              {selectedNFT && !price && (
                <span className={styles.priceWarning}>Please enter a price to list your NFT</span>
              )}
              <span className={styles.hint}>
                Platform fee:{' '}
                {isDiscounted ? (
                  <>
                    <span className={styles.originalFee}>0.2%</span>
                    <span className={styles.discountedFee}>
                      {feePercent === 0 ? 'FREE!' : `${feePercent}%`}
                    </span>
                  </>
                ) : (
                  `${feePercent}%`
                )}
                {' '}(deducted from sale proceeds)
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Listing Duration</label>
              <select
                className="input"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
          </div>

          {/* Optional Metadata */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Optional Details
              <span className={styles.optional}>(auto-fetched if empty)</span>
            </h2>

            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                type="text"
                className={`input ${selectedNFT ? styles.inputDisabled : ''}`}
                placeholder="My Awesome NFT"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!!selectedNFT}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea
                className={`input ${styles.textarea} ${selectedNFT ? styles.inputDisabled : ''}`}
                placeholder="Description of your NFT..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!!selectedNFT}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Image URL</label>
              <input
                type="text"
                className={`input ${selectedNFT ? styles.inputDisabled : ''}`}
                placeholder="https://... or ipfs://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={!!selectedNFT}
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={
              isApproving || isSigning || step === 'submit' || !nftContract || !price
            }
          >
            {getButtonText()}
          </button>

          <p className={styles.notice}>
            Your NFT stays in your wallet. The marketplace only needs approval to transfer it
            when someone buys. You can cancel your listing anytime.
          </p>
        </form>
      </div>
    </div>
  );
}
