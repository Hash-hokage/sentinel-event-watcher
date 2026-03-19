// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Interface for the SentinelHandler's per-emitter subscription function.
interface ISentinelHandler {
    function subscribeToEmitter(address _emitter) external;
}

/**
 * @title SentinelRegistry
 * @notice Manages user-defined monitoring configurations for autonomous agents on Somnia.
 * @dev This contract acts as the "Source of Truth" for all Sentinels.
 *      Users register monitoring targets (Wallets, DEX Pairs, Bridges) here.
 *      The SentinelHandler queries this registry to perform reactive execution.
 *      When a handler is configured, new sentinel registrations automatically
 *      create a reactivity subscription for the monitored target.
 */
contract SentinelRegistry {
    /// @notice Categories of events that a Sentinel can monitor.
    enum SentinelType { WALLET_WATCH, PRICE_ALERT, SYSTEM_HEALTH, BRIDGE_WATCH }

    /// @notice Configuration for a single monitoring Sentinel.
    struct SentinelConfig {
        address owner;          // The user who created the sentinel
        SentinelType sType;     // The type of sentinel
        address target;         // The address being monitored (EOA or Contract)
        uint256 threshold;      // Trigger value (e.g. price limit or min transfer)
        bool isActive;          // Whether the sentinel is currently monitoring
        address actionTarget;   // (Optional) Contract to call when triggered
        bytes actionData;       // (Optional) Call data for the automated action
    }

    /// @notice Thrown when a non-owner address attempts a restricted action.
    error OnlyOwner();

    /// @notice Thrown when an unauthorized user attempts to modify a sentinel.
    error Unauthorized();

    /// @notice Thrown when the action target is not a valid contract.
    /// @param target The invalid address.
    error InvalidActionTarget(address target);

    /// @notice Thrown when a sentinel ID does not exist.
    /// @param id The missing ID.
    error SentinelNotFound(uint256 id);

    /// @notice The deployer and administrator of this registry.
    address public immutable owner;

    /// @notice The handler contract that manages reactivity subscriptions.
    ISentinelHandler public handler;

    /// @notice Total number of sentinels registered.
    uint256 public nextSentinelId;

    /// @notice Maps sentinel ID to its full configuration.
    mapping(uint256 => SentinelConfig) public sentinels;

    /// @notice Maps a user's address to their list of sentinel IDs.
    mapping(address => uint256[]) private userSentinelIds;

    /// @notice Quick lookup to check if an address is being monitored by ANY sentinel.
    mapping(address => bool) public isTargetRegistered;

    /// @notice Emitted when a new reactive sentinel is deployed.
    event SentinelCreated(
        uint256 indexed id,
        address indexed owner,
        SentinelType indexed sType,
        address target,
        uint256 threshold
    );

    /// @notice Emitted when a sentinel's active state is toggled.
    event SentinelToggled(uint256 indexed id, bool active);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Sets the handler contract for automatic subscription management.
     * @dev Reverts with `OnlyOwner` if the caller is not the deployer.
     * @param _handler The address of the SentinelHandler contract.
     */
    function setHandler(address _handler) external onlyOwner {
        handler = ISentinelHandler(_handler);
    }

    /**
     * @notice Registers a new autonomous monitoring Sentinel.
     * @dev Reverts with `InvalidActionTarget` if `actionTarget` is provided but is not a contract.
     *      If a handler is configured, automatically creates a reactivity subscription for the target.
     * @param sType The category of the sentinel.
     * @param target The address to monitor (can be EOA for wallet watch or contract for bridge/price).
     * @param threshold The numerical value triggering the reactive response.
     * @param actionTarget The contract to execute an automated action on (address(0) for notification only).
     * @param actionData The encoded function call for the automated action.
     * @return id The unique ID assigned to the new sentinel.
     */
    function registerSentinel(
        SentinelType sType,
        address target,
        uint256 threshold,
        address actionTarget,
        bytes calldata actionData
    ) external returns (uint256 id) {
        // Validation: Ensure action target is a contract if provided
        if (actionTarget != address(0)) {
            if (actionTarget.code.length == 0) revert InvalidActionTarget(actionTarget);
        }

        id = nextSentinelId++;
        
        sentinels[id] = SentinelConfig({
            owner: msg.sender,
            sType: sType,
            target: target,
            threshold: threshold,
            isActive: true,
            actionTarget: actionTarget,
            actionData: actionData
        });

        userSentinelIds[msg.sender].push(id);
        isTargetRegistered[target] = true;

        emit SentinelCreated(id, msg.sender, sType, target, threshold);

        // Auto-subscribe the handler to the new target's events
        if (address(handler) != address(0)) {
            handler.subscribeToEmitter(target);
        }
    }

    /**
     * @notice Toggles the active status of a sentinel.
     * @dev Reverts with `Unauthorized` if the caller is not the sentinel owner.
     * @param id The ID of the sentinel to toggle.
     */
    function toggleSentinel(uint256 id) external {
        if (id >= nextSentinelId) revert SentinelNotFound(id);
        if (sentinels[id].owner != msg.sender) revert Unauthorized();
        
        sentinels[id].isActive = !sentinels[id].isActive;
        emit SentinelToggled(id, sentinels[id].isActive);
    }

    /**
     * @notice Retrieves all sentinel IDs owned by a specific user.
     * @param user The address of the user to query.
     * @return An array of sentinel IDs.
     */
    function getUserSentinels(address user) external view returns (uint256[] memory) {
        return userSentinelIds[user];
    }
}
