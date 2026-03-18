// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

/**
 * @title SentinelHandler
 * @notice An on-chain handler that reacts to Sentinel events using Somnia Reactivity.
 * @dev This contract demonstrates Somnia's native pub/sub system where the validator
 *      invokes this handler in response to on-chain events.
 */
contract SentinelHandler is SomniaEventHandler {
    // Reference to the main Sentinel contract we are monitoring
    address public monitoredSentinel;
    
    // Track how many reactive processing steps we've completed
    uint256 public reactiveCallCount;

    event ReactiveActionProcessed(address indexed sender, string alertType, uint256 timestamp);

    constructor(address _sentinel) {
        monitoredSentinel = _sentinel;
    }

    /**
     * @inheritdoc SomniaEventHandler
     * @dev This is the internal hook called by the Somnia Reactivity precompile (0x0100).
     *      Somnia Gas Model Note: Cold SLOAD is expensive (~1M gas). We keep logic lean.
     */
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        // 1. Safety check: ensure the emitter is the contract we expect
        if (emitter != monitoredSentinel) return;

        // 2. Decode the event (AlertTriggered)
        // topic0: keccak256("AlertTriggered(address,string,string,uint256)")
        // topic1: sender (indexed)
        // topic2: alertType (indexed string hash)
        address sender = address(uint160(uint256(eventTopics[1])));
        
        // 3. Increment counter (warm SLOAD/SSTORE)
        reactiveCallCount++;

        // 4. Emit a confirmation event
        emit ReactiveActionProcessed(sender, "REACTIVE_VERIFIED", block.timestamp);
    }
}
