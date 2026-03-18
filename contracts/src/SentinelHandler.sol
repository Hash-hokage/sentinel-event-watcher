// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

/**
 * @title SentinelHandler
 * @notice Reactive handler with upgradeable monitoring targets.
 * @dev Fixed: Added setter for monitoredSentinel to avoid full redeployment on contract upgrades.
 */
contract SentinelHandler is SomniaEventHandler {
    address public owner;
    address public monitoredSentinel;
    uint256 public reactiveCallCount;

    event ReactiveActionProcessed(address indexed sender, string alertType, uint256 timestamp);
    event MonitoredTargetUpdated(address oldTarget, address newTarget);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _sentinel) {
        owner = msg.sender;
        monitoredSentinel = _sentinel;
    }

    /**
     * @notice Update the address of the Sentinel contract being monitored.
     */
    function setMonitoredSentinel(address _newSentinel) external onlyOwner {
        emit MonitoredTargetUpdated(monitoredSentinel, _newSentinel);
        monitoredSentinel = _newSentinel;
    }

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        if (emitter != monitoredSentinel) return;

        address sender = address(uint160(uint256(eventTopics[1])));
        reactiveCallCount++;

        emit ReactiveActionProcessed(sender, "REACTIVE_VERIFIED", block.timestamp);
    }
}
