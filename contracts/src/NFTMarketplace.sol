// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NFTMarketplace
 * @notice EIP-712 signature-based NFT marketplace
 * @dev Off-chain order signing + on-chain settlement
 */
contract NFTMarketplace is EIP712, ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

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

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,uint8 assetType,address nftContract,uint256 tokenId,uint256 amount,uint256 price,uint256 expiry,uint256 salt,uint256 nonce)"
    );

    uint256 public constant MAX_FEE_BPS = 1000; // Max 10%
    uint256 public constant BPS_DENOMINATOR = 10000;

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

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

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error OrderExpired();
    error OrderIsCancelled();
    error OrderAlreadyFilled();
    error InvalidSignature();
    error InvalidNonce();
    error InsufficientPayment();
    error SellerNotOwner();
    error NotApproved();
    error TransferFailed();
    error InvalidFee();
    error ZeroAddress();
    error BuyerIsSeller();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        string memory name,
        string memory version,
        address _feeRecipient,
        uint256 _platformFeeBps
    ) EIP712(name, version) Ownable(msg.sender) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_platformFeeBps > MAX_FEE_BPS) revert InvalidFee();

        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
    }

    /*//////////////////////////////////////////////////////////////
                            CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Fulfill a signed order
     * @param order Order data
     * @param signature Seller's EIP-712 signature
     */
    function fulfillOrder(Order calldata order, bytes calldata signature) external payable nonReentrant {
        // Buyer cannot be the seller
        if (msg.sender == order.seller) revert BuyerIsSeller();

        // 1. Calculate order hash
        bytes32 orderHash = getOrderHash(order);

        // 2. Validate
        _validateOrder(order, orderHash, signature);

        // 3. Mark as filled (state change first - CEI pattern)
        filledOrders[orderHash] = true;

        // 4. Calculate fee
        uint256 fee = (order.price * platformFeeBps) / BPS_DENOMINATOR;
        uint256 sellerProceeds = order.price - fee;

        // 5. Transfer NFT (seller → buyer)
        _transferNFT(order, msg.sender);

        // 6. Settle payment (buyer → seller, platform)
        _transferPayment(order.seller, sellerProceeds, fee);

        emit OrderFulfilled(orderHash, order.seller, msg.sender, order.nftContract, order.tokenId, order.amount, order.price);
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
        // Time validation
        if (block.timestamp >= order.expiry) revert OrderExpired();

        // Cancellation validation
        if (cancelledOrders[orderHash]) revert OrderIsCancelled();

        // Fill validation
        if (filledOrders[orderHash]) revert OrderAlreadyFilled();

        // Nonce validation
        if (order.nonce != nonces[order.seller]) revert InvalidNonce();

        // Signature validation
        address signer = orderHash.recover(signature);
        if (signer != order.seller) revert InvalidSignature();

        // Payment validation
        if (msg.value < order.price) revert InsufficientPayment();

        // Ownership and approval validation
        if (!_checkOwnershipAndApproval(order)) revert NotApproved();
    }

    function _checkOwnershipAndApproval(Order calldata order) internal view returns (bool) {
        if (order.assetType == AssetType.ERC721) {
            IERC721 nft = IERC721(order.nftContract);

            // Check ownership
            if (nft.ownerOf(order.tokenId) != order.seller) return false;

            // Check approval
            if (!nft.isApprovedForAll(order.seller, address(this)) && nft.getApproved(order.tokenId) != address(this)) {
                return false;
            }
        } else {
            IERC1155 nft = IERC1155(order.nftContract);

            // Check balance
            if (nft.balanceOf(order.seller, order.tokenId) < order.amount) return false;

            // Check approval
            if (!nft.isApprovedForAll(order.seller, address(this))) return false;
        }

        return true;
    }

    function _transferNFT(Order calldata order, address buyer) internal {
        if (order.assetType == AssetType.ERC721) {
            IERC721(order.nftContract).safeTransferFrom(order.seller, buyer, order.tokenId);
        } else {
            IERC1155(order.nftContract).safeTransferFrom(order.seller, buyer, order.tokenId, order.amount, "");
        }
    }

    function _transferPayment(address seller, uint256 sellerAmount, uint256 feeAmount) internal {
        // Transfer payment to seller
        (bool successSeller,) = payable(seller).call{value: sellerAmount}("");
        if (!successSeller) revert TransferFailed();

        // Transfer fee to platform
        if (feeAmount > 0) {
            (bool successFee,) = payable(feeRecipient).call{value: feeAmount}("");
            if (!successFee) revert TransferFailed();
        }

        // Refund excess payment
        uint256 totalPaid = sellerAmount + feeAmount;
        if (msg.value > totalPaid) {
            uint256 refund = msg.value - totalPaid;
            (bool successRefund,) = payable(msg.sender).call{value: refund}("");
            if (!successRefund) revert TransferFailed();
        }
    }
}
