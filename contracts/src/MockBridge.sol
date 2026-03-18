// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockBridge
 * @notice Simulates a cross-chain bridge contract for testing Bridge Sentinels.
 */
contract MockBridge {
    event DepositInitiated(
        address indexed sender, 
        address indexed token, 
        uint256 amount, 
        uint256 destinationChainId
    );

    /**
     * @notice Simulate a deposit that would be picked up by a sentinel.
     */
    function deposit(address token, uint256 amount, uint256 destChainId) external {
        emit DepositInitiated(msg.sender, token, amount, destChainId);
    }
}
