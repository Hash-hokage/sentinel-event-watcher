// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockBridge
 * @notice Simulates a cross-chain bridge contract for testing Bridge Sentinels on Somnia.
 * @dev Emits a standard `DepositInitiated` event that reactive handlers can intercept.
 */
contract MockBridge {
    /// @notice Emitted when a deposit is initiated for cross-chain transfer.
    event DepositInitiated(
        address indexed sender, 
        address indexed token, 
        uint256 amount, 
        uint256 destinationChainId
    );

    /**
     * @notice Simulates a deposit action.
     * @dev Emits `DepositInitiated` event.
     * @param token The address of the token being bridged.
     * @param amount The amount of tokens.
     * @param destChainId The ID of the destination chain.
     */
    function deposit(address token, uint256 amount, uint256 destChainId) external {
        emit DepositInitiated(msg.sender, token, amount, destChainId);
    }
}
