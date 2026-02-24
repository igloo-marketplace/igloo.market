// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IWCTC.sol";

/**
 * @title NFTMarketplaceV3
 * @notice EIP-712 signature-based NFT marketplace (WCTC settlement)
 * @dev Off-chain order signing + on-chain settlement
 */
contract NFTMarketplaceV3 is EIP712, ReentrancyGuard, Ownable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                  TYPES
    //////////////////////////////////////////////////////////////*/

    enum AssetType {
        ERC721,
        ERC1155
    }

    /**
     * @notice Order structure
     * @param seller Seller address
     * @param assetType NFT type (ERC721 or ERC1155)
     * @param nftContract NFT contract address
     * @param tokenId Token ID
     * @param amount Quantity for ERC1155 (always 1 for ERC721)
     * @param price Sale price (in wei)
     * @param expiry Expiration time (unix timestamp)
     * @param salt Random value to ensure order uniqueness
     * @param nonce Seller's current nonce (for batch cancellation)
     */
    struct Order {
        address seller;
        AssetType assetType;
        address nftContract;
        uint256 tokenId;
        uint256 amount;
        uint256 price;
        uint256 expiry;
        uint256 salt;
        uint256 nonce;
    }

    /**
     * @notice Offer structure
     * @param bidder Bidder address
     * @param assetType NFT type (ERC721 or ERC1155)
     * @param nftContract NFT contract address
     * @param tokenId Token ID
     * @param amount Quantity for ERC1155 (always 1 for ERC721)
     * @param price Offer price (in wei)
     * @param expiry Expiration time (unix timestamp)
     * @param salt Random value to ensure offer uniqueness
     */
    struct Offer {
        address bidder;
        AssetType assetType;
        address nftContract;
        uint256 tokenId;
        uint256 amount;
        uint256 price;
        uint256 expiry;
        uint256 salt;
    }

    /*//////////////////////////////////////////////////////////////
                                 CONSTANTS
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,uint8 assetType,address nftContract,uint256 tokenId,uint256 amount,uint256 price,uint256 expiry,uint256 salt,uint256 nonce)"
    );

    bytes32 public constant OFFER_TYPEHASH = keccak256(
        "Offer(address bidder,uint8 assetType,address nftContract,uint256 tokenId,uint256 amount,uint256 price,uint256 expiry,uint256 salt)"
    );

    uint256 public constant MAX_FEE_BPS = 1000; // Max 10%
    uint256 public constant BPS_DENOMINATOR = 10000;

    /*//////////////////////////////////////////////////////////////
                                  STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Wrapped CTC token
    IERC20 public immutable wctc;

    /// @notice Platform fee (basis points, 250 = 2.5%)
    uint256 public platformFeeBps;

    /// @notice Fee recipient address
    address public feeRecipient;

    /// @notice Per-user nonce (incrementNonce cancels all existing orders)
    mapping(address => uint256) public nonces;

    /// @notice Individual order cancellation tracking (orderHash => cancelled)
    mapping(bytes32 => bool) public cancelledOrders;

    /// @notice Filled order tracking (orderHash => filled)
    mapping(bytes32 => bool) public filledOrders;

    /// @notice Individual offer cancellation tracking (offerHash => cancelled)
    mapping(bytes32 => bool) public cancelledOffers;

    /// @notice Filled offer tracking (offerHash => filled)
    mapping(bytes32 => bool) public filledOffers;

    /// @notice Offer escrow tracking (offerHash => escrowed WCTC amount)
    mapping(bytes32 => uint256) public offerEscrow;

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event OrderFulfilled(
        bytes32 indexed orderHash,
        address indexed seller,
        address indexed buyer,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price
    );

    event OrderCancelled(bytes32 indexed orderHash, address indexed seller);

    event NonceIncremented(address indexed user, uint256 newNonce);

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    event OfferCreated(bytes32 indexed offerHash, address indexed bidder, address nftContract, uint256 tokenId, uint256 price);

    event OfferAccepted(
        bytes32 indexed offerHash,
        address indexed seller,
        address indexed bidder,
        address nftContract,
        uint256 tokenId,
        uint256 price
    );

    event OfferCancelled(bytes32 indexed offerHash, address indexed bidder);

    /*//////////////////////////////////////////////////////////////
                                  ERRORS
    //////////////////////////////////////////////////////////////*/

    error OrderExpired();
    error OrderIsCancelled();
    error OrderAlreadyFilled();
    error InvalidSignature();
    error InvalidNonce();
    error InsufficientPayment();
    error InsufficientAllowance();
    error SellerNotOwner();
    error NotApproved();
    error TransferFailed();
    error InvalidFee();
    error ZeroAddress();
    error BuyerIsSeller();
    error OfferExpired();
    error OfferIsCancelled();
    error OfferAlreadyFilled();
    error OfferAlreadyActive();
    error OfferNotActive();
    error NotOfferBidder();

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _wctc, address _feeRecipient, uint256 _platformFeeBps)
        EIP712("IglooMarket", "2")
        Ownable(msg.sender)
    {
        if (_wctc == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_platformFeeBps > MAX_FEE_BPS) revert InvalidFee();

        wctc = IERC20(_wctc);
        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
    }

    receive() external payable {}

    /*//////////////////////////////////////////////////////////////
                            CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Fulfill a signed order (WCTC payment)
     * @param order Order data
     * @param signature Seller's EIP-712 signature
     */
    function fulfillOrder(Order calldata order, bytes calldata signature) external nonReentrant {
        if (msg.sender == order.seller) revert BuyerIsSeller();

        bytes32 orderHash = getOrderHash(order);
        _validateOrder(order, orderHash, signature);

        if (wctc.allowance(msg.sender, address(this)) < order.price) revert InsufficientAllowance();

        filledOrders[orderHash] = true;

        uint256 fee = (order.price * platformFeeBps) / BPS_DENOMINATOR;
        uint256 sellerProceeds = order.price - fee;

        _transferNFT(order, msg.sender);

        wctc.safeTransferFrom(msg.sender, order.seller, sellerProceeds);
        if (fee > 0) {
            wctc.safeTransferFrom(msg.sender, feeRecipient, fee);
        }

        emit OrderFulfilled(orderHash, order.seller, msg.sender, order.nftContract, order.tokenId, order.amount, order.price);
    }

    /**
     * @notice Fulfill a signed order with native CTC (auto-wrap)
     * @param order Order data
     * @param signature Seller's EIP-712 signature
     */
    function buyWithNative(Order calldata order, bytes calldata signature) external payable nonReentrant {
        if (msg.sender == order.seller) revert BuyerIsSeller();
        if (msg.value < order.price) revert InsufficientPayment();

        bytes32 orderHash = getOrderHash(order);
        _validateOrder(order, orderHash, signature);

        filledOrders[orderHash] = true;

        uint256 fee = (order.price * platformFeeBps) / BPS_DENOMINATOR;
        uint256 sellerProceeds = order.price - fee;

        IWCTC(address(wctc)).deposit{value: order.price}();

        _transferNFT(order, msg.sender);

        wctc.safeTransfer(order.seller, sellerProceeds);
        if (fee > 0) {
            wctc.safeTransfer(feeRecipient, fee);
        }

        _refundExcessNative(order.price);

        emit OrderFulfilled(orderHash, order.seller, msg.sender, order.nftContract, order.tokenId, order.amount, order.price);
    }

    /**
     * @notice Create an offer with WCTC escrow
     * @param offer Offer data
     */
    function createOffer(Offer calldata offer) external nonReentrant {
        if (msg.sender != offer.bidder) revert NotOfferBidder();
        if (block.timestamp >= offer.expiry) revert OfferExpired();

        bytes32 offerHash = getOfferHash(offer);
        if (cancelledOffers[offerHash]) revert OfferIsCancelled();
        if (filledOffers[offerHash]) revert OfferAlreadyFilled();
        if (offerEscrow[offerHash] != 0) revert OfferAlreadyActive();

        if (wctc.allowance(msg.sender, address(this)) < offer.price) revert InsufficientAllowance();

        offerEscrow[offerHash] = offer.price;
        wctc.safeTransferFrom(msg.sender, address(this), offer.price);

        emit OfferCreated(offerHash, offer.bidder, offer.nftContract, offer.tokenId, offer.price);
    }

    /**
     * @notice Create an offer with native CTC (auto-wrap)
     * @param offer Offer data
     */
    function makeOfferWithNative(Offer calldata offer) external payable nonReentrant {
        if (msg.sender != offer.bidder) revert NotOfferBidder();
        if (block.timestamp >= offer.expiry) revert OfferExpired();
        if (msg.value < offer.price) revert InsufficientPayment();

        bytes32 offerHash = getOfferHash(offer);
        if (cancelledOffers[offerHash]) revert OfferIsCancelled();
        if (filledOffers[offerHash]) revert OfferAlreadyFilled();
        if (offerEscrow[offerHash] != 0) revert OfferAlreadyActive();

        offerEscrow[offerHash] = offer.price;

        IWCTC(address(wctc)).deposit{value: offer.price}();

        _refundExcessNative(offer.price);

        emit OfferCreated(offerHash, offer.bidder, offer.nftContract, offer.tokenId, offer.price);
    }

    /**
     * @notice Accept an offer and receive WCTC
     * @param offer Offer data
     */
    function acceptOffer(Offer calldata offer) external nonReentrant {
        bytes32 offerHash = getOfferHash(offer);

        if (cancelledOffers[offerHash]) revert OfferIsCancelled();
        if (filledOffers[offerHash]) revert OfferAlreadyFilled();
        if (block.timestamp >= offer.expiry) revert OfferExpired();

        uint256 escrowedAmount = offerEscrow[offerHash];
        if (escrowedAmount != offer.price) revert OfferNotActive();

        (bool isOwner, bool isApproved) = _checkOfferOwnershipAndApproval(offer, msg.sender);
        if (!isOwner) revert SellerNotOwner();
        if (!isApproved) revert NotApproved();

        filledOffers[offerHash] = true;
        offerEscrow[offerHash] = 0;

        uint256 fee = (escrowedAmount * platformFeeBps) / BPS_DENOMINATOR;
        uint256 sellerProceeds = escrowedAmount - fee;

        _transferOfferNFT(offer, msg.sender, offer.bidder);

        wctc.safeTransfer(msg.sender, sellerProceeds);
        if (fee > 0) {
            wctc.safeTransfer(feeRecipient, fee);
        }

        emit OfferAccepted(offerHash, msg.sender, offer.bidder, offer.nftContract, offer.tokenId, offer.price);
    }

    /**
     * @notice Cancel an offer and refund escrowed WCTC
     * @param offer Offer data
     */
    function cancelOffer(Offer calldata offer) external nonReentrant {
        if (msg.sender != offer.bidder) revert NotOfferBidder();

        bytes32 offerHash = getOfferHash(offer);
        if (filledOffers[offerHash]) revert OfferAlreadyFilled();
        if (cancelledOffers[offerHash]) revert OfferIsCancelled();

        uint256 escrowedAmount = offerEscrow[offerHash];
        if (escrowedAmount == 0) revert OfferNotActive();

        cancelledOffers[offerHash] = true;
        offerEscrow[offerHash] = 0;

        wctc.safeTransfer(offer.bidder, escrowedAmount);

        emit OfferCancelled(offerHash, offer.bidder);
    }

    /**
     * @notice Cancel a specific order
     * @param order Order to cancel
     */
    function cancelOrder(Order calldata order) external {
        if (msg.sender != order.seller) revert InvalidSignature();

        bytes32 orderHash = getOrderHash(order);
        if (filledOrders[orderHash]) revert OrderAlreadyFilled();

        cancelledOrders[orderHash] = true;

        emit OrderCancelled(orderHash, msg.sender);
    }

    /**
     * @notice Increment nonce to batch cancel all existing orders
     */
    function incrementNonce() external {
        uint256 newNonce = ++nonces[msg.sender];
        emit NonceIncremented(msg.sender, newNonce);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Calculate order hash
     */
    function getOrderHash(Order calldata order) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.seller,
                    uint8(order.assetType),
                    order.nftContract,
                    order.tokenId,
                    order.amount,
                    order.price,
                    order.expiry,
                    order.salt,
                    order.nonce
                )
            )
        );
    }

    /**
     * @notice Calculate offer hash
     */
    function getOfferHash(Offer calldata offer) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    OFFER_TYPEHASH,
                    offer.bidder,
                    uint8(offer.assetType),
                    offer.nftContract,
                    offer.tokenId,
                    offer.amount,
                    offer.price,
                    offer.expiry,
                    offer.salt
                )
            )
        );
    }

    /**
     * @notice Validate order
     */
    function isOrderValid(Order calldata order, bytes calldata signature) external view returns (bool) {
        bytes32 orderHash = getOrderHash(order);

        if (block.timestamp >= order.expiry) return false;
        if (cancelledOrders[orderHash]) return false;
        if (filledOrders[orderHash]) return false;
        if (order.nonce != nonces[order.seller]) return false;

        address signer = orderHash.recover(signature);
        if (signer != order.seller) return false;

        return _checkOwnershipAndApproval(order);
    }

    /**
     * @notice Return EIP-712 domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFee();

        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;

        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();

        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;

        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _validateOrder(Order calldata order, bytes32 orderHash, bytes calldata signature) internal view {
        if (block.timestamp >= order.expiry) revert OrderExpired();
        if (cancelledOrders[orderHash]) revert OrderIsCancelled();
        if (filledOrders[orderHash]) revert OrderAlreadyFilled();
        if (order.nonce != nonces[order.seller]) revert InvalidNonce();

        address signer = orderHash.recover(signature);
        if (signer != order.seller) revert InvalidSignature();

        if (!_checkOwnershipAndApproval(order)) revert NotApproved();
    }

    function _checkOwnershipAndApproval(Order calldata order) internal view returns (bool) {
        if (order.assetType == AssetType.ERC721) {
            IERC721 nft = IERC721(order.nftContract);

            if (nft.ownerOf(order.tokenId) != order.seller) return false;

            if (!nft.isApprovedForAll(order.seller, address(this)) && nft.getApproved(order.tokenId) != address(this)) {
                return false;
            }
        } else {
            IERC1155 nft = IERC1155(order.nftContract);

            if (nft.balanceOf(order.seller, order.tokenId) < order.amount) return false;

            if (!nft.isApprovedForAll(order.seller, address(this))) return false;
        }

        return true;
    }

    function _checkOfferOwnershipAndApproval(Offer calldata offer, address seller) internal view returns (bool, bool) {
        if (offer.assetType == AssetType.ERC721) {
            IERC721 nft = IERC721(offer.nftContract);

            if (nft.ownerOf(offer.tokenId) != seller) return (false, false);

            if (!nft.isApprovedForAll(seller, address(this)) && nft.getApproved(offer.tokenId) != address(this)) {
                return (true, false);
            }
        } else {
            IERC1155 nft = IERC1155(offer.nftContract);

            if (nft.balanceOf(seller, offer.tokenId) < offer.amount) return (false, false);

            if (!nft.isApprovedForAll(seller, address(this))) return (true, false);
        }

        return (true, true);
    }

    function _transferNFT(Order calldata order, address buyer) internal {
        if (order.assetType == AssetType.ERC721) {
            IERC721(order.nftContract).safeTransferFrom(order.seller, buyer, order.tokenId);
        } else {
            IERC1155(order.nftContract).safeTransferFrom(order.seller, buyer, order.tokenId, order.amount, "");
        }
    }

    function _transferOfferNFT(Offer calldata offer, address seller, address buyer) internal {
        if (offer.assetType == AssetType.ERC721) {
            IERC721(offer.nftContract).safeTransferFrom(seller, buyer, offer.tokenId);
        } else {
            IERC1155(offer.nftContract).safeTransferFrom(seller, buyer, offer.tokenId, offer.amount, "");
        }
    }

    function _refundExcessNative(uint256 requiredAmount) internal {
        if (msg.value > requiredAmount) {
            uint256 refund = msg.value - requiredAmount;
            (bool success,) = payable(msg.sender).call{value: refund}("");
            if (!success) revert TransferFailed();
        }
    }
}
