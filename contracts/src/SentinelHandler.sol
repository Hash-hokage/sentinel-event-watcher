// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { 
    SomniaEventHandler 
} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import { 
    ISomniaReactivityPrecompile, 
    SomniaExtensions 
} from "@somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol";
import { SentinelRegistry } from "./SentinelRegistry.sol";
import { MockPriceOracle } from "./MockPriceOracle.sol";

/**
 * @title SentinelHandler
 * @notice Native Somnia Reactive Handler that monitors events and triggers automated actions.
 * @dev This contract is invoked by the Somnia Reactivity Precompile (0x0100).
 *      Somnia Gas Note: Cold storage reads are expensive (~1M gas). Keep logic lean.
 *      Subscriptions are created per-emitter rather than as a single wildcard to comply
 *      with the Somnia precompile requirement that at least one filter field be non-wildcard.
 */
contract SentinelHandler is SomniaEventHandler {
    error OnlyOwner();
    error OnlyOwnerOrRegistry();
    error AlreadySubscribed();
    error NotSubscribed();

    ISomniaReactivityPrecompile private constant PRECOMPILE =
        ISomniaReactivityPrecompile(SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS);

    address public immutable owner;
    address public monitoredSentinel;
    SentinelRegistry public registry;
    MockPriceOracle public oracle;

    uint256 public reactiveCallCount;
    uint256 public priceAlertsProcessed;
    uint256 public blockTickSubId;

    /// @notice Maps an emitter address to its reactivity subscription ID.
    mapping(address => uint256) public emitterSubIds;

    event ReactiveActionProcessed(address indexed source, string alertType, uint256 timestamp);
    event MonitoredTargetUpdated(address oldTarget, address newTarget);
    event PriceThresholdAlert(address indexed asset, uint256 price, uint256 threshold);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /// @notice Allows the owner or the registry contract to call a function.
    modifier onlyOwnerOrRegistry() {
        if (msg.sender != owner && msg.sender != address(registry)) revert OnlyOwnerOrRegistry();
        _;
    }

    constructor(address _sentinel, address _registry, address _oracle) {
        owner = msg.sender;
        monitoredSentinel = _sentinel;
        registry = SentinelRegistry(_registry);
        oracle = MockPriceOracle(_oracle);
    }

    /**
     * @notice Allows the contract to receive STT to pay for its own subscriptions.
     */
    receive() external payable {}

    /**
     * @notice Creates the on-chain BlockTick subscription for automated price monitoring.
     * @dev Requires the contract balance to be >= 32 STT.
     */
    function subscribeToBlockTick() external onlyOwner {
        if (blockTickSubId != 0) revert AlreadySubscribed();

        ISomniaReactivityPrecompile.SubscriptionData memory subData =
            ISomniaReactivityPrecompile.SubscriptionData({
                eventTopics: [keccak256("BlockTick(uint64)"), bytes32(0), bytes32(0), bytes32(0)],
                origin: address(0),
                caller: address(0),
                emitter: SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS,
                handlerContractAddress: address(this),
                handlerFunctionSelector: this.onEvent.selector,
                priorityFeePerGas: 2_000_000_000,
                maxFeePerGas: 10_000_000_000,
                gasLimit: 3_000_000,
                isGuaranteed: true,
                isCoalesced: false
            });

        blockTickSubId = PRECOMPILE.subscribe(subData);
    }

    /**
     * @notice Creates a per-emitter reactivity subscription.
     * @dev Can be called by the owner or automatically by the registry when a new sentinel is registered.
     *      Reverts with `AlreadySubscribed` if a subscription for this emitter already exists.
     * @param _emitter The contract address to subscribe to events from.
     */
    function subscribeToEmitter(address _emitter) external onlyOwnerOrRegistry {
        if (emitterSubIds[_emitter] != 0) revert AlreadySubscribed();

        ISomniaReactivityPrecompile.SubscriptionData memory subData =
            ISomniaReactivityPrecompile.SubscriptionData({
                eventTopics: [bytes32(0), bytes32(0), bytes32(0), bytes32(0)],
                origin: address(0),
                caller: address(0),
                emitter: _emitter,
                handlerContractAddress: address(this),
                handlerFunctionSelector: this.onEvent.selector,
                priorityFeePerGas: 2_000_000_000,
                maxFeePerGas: 10_000_000_000,
                gasLimit: 1_000_000,
                isGuaranteed: true,
                isCoalesced: false
            });

        emitterSubIds[_emitter] = PRECOMPILE.subscribe(subData);
    }

    /**
     * @notice Cancels a per-emitter reactivity subscription.
     * @dev Reverts with `NotSubscribed` if no subscription exists for this emitter.
     * @param _emitter The contract address to unsubscribe from.
     */
    function unsubscribeFromEmitter(address _emitter) external onlyOwner {
        uint256 subId = emitterSubIds[_emitter];
        if (subId == 0) revert NotSubscribed();
        PRECOMPILE.unsubscribe(subId);
        emitterSubIds[_emitter] = 0;
    }

    function setMonitoredSentinel(address _newSentinel) external onlyOwner {
        emit MonitoredTargetUpdated(monitoredSentinel, _newSentinel);
        monitoredSentinel = _newSentinel;
    }

    function setExternalContracts(address _registry, address _oracle) external onlyOwner {
        registry = SentinelRegistry(_registry);
        oracle = MockPriceOracle(_oracle);
    }

    /**
     * @notice Core reactive callback invoked by the Somnia Reactivity Precompile.
     * @dev Routes incoming events based on the emitter address:
     *      - Precompile (0x0100) → BlockTick handler for periodic price checks.
     *      - monitoredSentinel / registered target → Reactive signal processing.
     *      All other emitters are silently ignored.
     * @param emitter The contract that emitted the original event.
     * @param eventTopics The indexed topics from the event log.
     * @param data The non-indexed ABI-encoded event data.
     */
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        if (emitter == SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS) {
            _processPriceChecks();
            return;
        }

        if (emitter != monitoredSentinel && !registry.isTargetRegistered(emitter)) return;

        reactiveCallCount++;
        string memory alertType = (emitter == monitoredSentinel) ? "SENTINEL_DIRECT_ALERT" : "REACTIVE_SIGNAL";
        emit ReactiveActionProcessed(emitter, alertType, block.timestamp);
    }

    /**
     * @notice Iterates all registered sentinels and fires price alerts when thresholds are exceeded.
     * @dev Called on every BlockTick from the Somnia Reactivity Precompile,
     *      enabling high-frequency autonomous price monitoring without external cron.
     *      Somnia Gas: caches `totalSentinels` in memory to avoid repeated cold SLOAD.
     */
    function _processPriceChecks() internal {
        uint256 totalSentinels = registry.nextSentinelId();
        for (uint256 i = 0; i < totalSentinels; i++) {
            (
                , SentinelRegistry.SentinelType sType, address target, uint256 threshold, bool isActive, , 
            ) = registry.sentinels(i);
            
            if (isActive && sType == SentinelRegistry.SentinelType.PRICE_ALERT) {
                uint256 currentPrice = oracle.getPrice(target);
                if (currentPrice >= threshold && currentPrice > 0) {
                    priceAlertsProcessed++;
                    emit PriceThresholdAlert(target, currentPrice, threshold);
                }
            }
        }
    }
}
