// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import { SentinelRegistry } from "./SentinelRegistry.sol";
import { MockPriceOracle } from "./MockPriceOracle.sol";

/**
 * @title SentinelHandler
 * @notice Reactive handler with upgradeable monitoring targets and price oracle integration.
 */
contract SentinelHandler is SomniaEventHandler {
    address public owner;
    address public monitoredSentinel;
    SentinelRegistry public registry;
    MockPriceOracle public oracle;
    uint256 public reactiveCallCount;
    uint256 public priceAlertsProcessed;

    event ReactiveActionProcessed(address indexed sender, string alertType, uint256 timestamp);
    event MonitoredTargetUpdated(address oldTarget, address newTarget);
    event PriceThresholdAlert(address indexed asset, uint256 price, uint256 threshold);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _sentinel, address _registry, address _oracle) {
        owner = msg.sender;
        monitoredSentinel = _sentinel;
        registry = SentinelRegistry(_registry);
        oracle = MockPriceOracle(_oracle);
    }

    /**
     * @notice Update the address of the Sentinel contract being monitored.
     */
    function setMonitoredSentinel(address _newSentinel) external onlyOwner {
        emit MonitoredTargetUpdated(monitoredSentinel, _newSentinel);
        monitoredSentinel = _newSentinel;
    }

    /**
     * @notice Update the registry and oracle addresses.
     */
    function setExternalContracts(address _registry, address _oracle) external onlyOwner {
        registry = SentinelRegistry(_registry);
        oracle = MockPriceOracle(_oracle);
    }

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        // 1. Handle BlockTick from Somnia Precompile (0x0100)
        if (emitter == address(0x0100)) {
            _processPriceChecks();
            return;
        }

        // 2. Handle events from registered Sentinel targets OR the main monitored sentinel
        if (emitter != monitoredSentinel && !registry.isTargetRegistered(emitter)) return;

        reactiveCallCount++;

        // Identify the event type if possible (simplified for MVP)
        string memory alertType = "REACTIVE_SIGNAL";
        if (emitter == monitoredSentinel) {
            alertType = "SENTINEL_DIRECT_ALERT";
        }

        emit ReactiveActionProcessed(emitter, alertType, block.timestamp);
    }

    /**
     * @dev Process price checks for active sentinels in the registry.
     * Note: In a production environment, we might use a more efficient way to filter sentinels.
     */
    function _processPriceChecks() internal {
        uint256 totalSentinels = registry.nextSentinelId();
        
        for (uint256 i = 0; i < totalSentinels; i++) {
            (address sOwner, SentinelRegistry.SentinelType sType, address target, uint256 threshold, bool isActive, , ) = registry.sentinels(i);
            
            if (isActive && sType == SentinelRegistry.SentinelType.PRICE_ALERT) {
                uint256 currentPrice = oracle.getPrice(target);
                
                // Trigger if price >= threshold
                if (currentPrice >= threshold && currentPrice > 0) {
                    priceAlertsProcessed++;
                    emit PriceThresholdAlert(target, currentPrice, threshold);
                }
            }
        }
    }
}
