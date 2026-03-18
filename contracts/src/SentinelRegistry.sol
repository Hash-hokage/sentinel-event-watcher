// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SentinelRegistry
 * @notice A central registry for users to manage their "Sentinels" (monitoring filters).
 * @dev Optimized for Somnia's gas model. Cold SLOADs are 1M gas, so we use
 *      event-driven architectures to minimize storage lookups where possible.
 */
contract SentinelRegistry {
    enum SentinelType { WALLET_WATCH, PRICE_ALERT, SYSTEM_HEALTH }

    struct SentinelConfig {
        address owner;
        SentinelType sType;
        address target;      // E.g., a whale address or a pair contract
        uint256 threshold;   // E.g., transfer amount or price point
        bool isActive;
    }

    // Keep track of total sentinels created
    uint256 public nextSentinelId;

    // Registry of all sentinels
    mapping(uint256 => SentinelConfig) public sentinels;
    
    // Quick lookup for a user's sentinels (stores IDs)
    mapping(address => uint256[]) private userSentinelIds;

    event SentinelCreated(
        uint256 indexed id,
        address indexed owner,
        SentinelType indexed sType,
        address target,
        uint256 threshold
    );

    event SentinelToggled(uint256 indexed id, bool active);

    /**
     * @notice Register a new monitoring Sentinel.
     * @param sType The category of the sentinel (Whale, Price, etc.)
     * @param target The address to monitor.
     * @param threshold The value triggering the alert.
     */
    function registerSentinel(
        SentinelType sType,
        address target,
        uint256 threshold
    ) external returns (uint256 id) {
        id = nextSentinelId++;
        
        sentinels[id] = SentinelConfig({
            owner: msg.sender,
            sType: sType,
            target: target,
            threshold: threshold,
            isActive: true
        });

        userSentinelIds[msg.sender].push(id);

        emit SentinelCreated(id, msg.sender, sType, target, threshold);
    }

    /**
     * @notice Toggle a sentinel's active status.
     */
    function toggleSentinel(uint256 id) external {
        require(sentinels[id].owner == msg.sender, "UNAUTHORIZED");
        sentinels[id].isActive = !sentinels[id].isActive;
        emit SentinelToggled(id, sentinels[id].isActive);
    }

    /**
     * @notice Get all sentinel IDs for a specific user.
     * @dev Somnia Gas Note: Reading arrays is cheaper if slots are warm.
     */
    function getUserSentinels(address user) external view returns (uint256[] memory) {
        return userSentinelIds[user];
    }
}
