// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockPriceOracle
 * @notice A simple mock oracle for testing price-based reactive triggers on Somnia.
 */
contract MockPriceOracle {
    /// @notice Maps asset address to its current price.
    mapping(address => uint256) public prices;

    /// @notice The owner of the oracle.
    address public immutable owner;

    /// @notice Emitted when an asset price is updated.
    event PriceUpdated(address indexed asset, uint256 price);

    /// @notice Thrown when a non-owner attempts to update prices.
    error OnlyOwner();

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Updates the price of an asset.
     * @dev Only callable by the owner. Emits `PriceUpdated`.
     * @param asset The address of the asset (e.g. Token).
     * @param price The new price in numerical format.
     */
    function setPrice(address asset, uint256 price) external {
        if (msg.sender != owner) revert OnlyOwner();
        prices[asset] = price;
        emit PriceUpdated(asset, price);
    }

    /**
     * @notice Retrieves the current price of an asset.
     * @param asset The address of the asset.
     * @return The current price.
     */
    function getPrice(address asset) external view returns (uint256) {
        return prices[asset];
    }
}
