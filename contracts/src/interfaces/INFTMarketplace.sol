// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INFTMarketplace {
    enum AssetType {
        ERC721,
        ERC1155
    }

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

    // Events
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

    // Errors
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

    // Core functions
    function fulfillOrder(Order calldata order, bytes calldata signature) external payable;
    function cancelOrder(Order calldata order) external;
    function incrementNonce() external;

    // View functions
    function getOrderHash(Order calldata order) external view returns (bytes32);
    function isOrderValid(Order calldata order, bytes calldata signature) external view returns (bool);
    function getDomainSeparator() external view returns (bytes32);

    // State getters
    function nonces(address user) external view returns (uint256);
    function cancelledOrders(bytes32 orderHash) external view returns (bool);
    function filledOrders(bytes32 orderHash) external view returns (bool);
    function platformFeeBps() external view returns (uint256);
    function feeRecipient() external view returns (address);

    // Admin functions
    function setPlatformFee(uint256 newFeeBps) external;
    function setFeeRecipient(address newRecipient) external;
}
