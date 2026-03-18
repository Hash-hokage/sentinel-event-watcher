// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockPriceOracle
 * @notice A simple mock oracle for testing price-based triggers.
 */
contract MockPriceOracle {
    mapping(address => uint256) public prices;
    address public owner;

    event PriceUpdated(address indexed asset, uint256 price);

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Set the price of an asset (Only for testing).
     */
    function setPrice(address asset, uint256 price) external {
        require(msg.sender == owner, "ONLY_OWNER");
        prices[asset] = price;
        emit PriceUpdated(asset, price);
    }

    /**
     * @notice Get the current price of an asset.
     */
    function getPrice(address asset) external view returns (uint256) {
        return prices[asset];
    }
}
