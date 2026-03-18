// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SentinelRegistry
 * @notice Manages user-defined monitoring configurations.
 * @dev Fixed: Added validation for action targets to prevent malformed automated actions.
 */
contract SentinelRegistry {
    enum SentinelType { WALLET_WATCH, PRICE_ALERT, SYSTEM_HEALTH }

    struct SentinelConfig {
        address owner;
        SentinelType sType;
        address target;
        uint256 threshold;
        bool isActive;
        address actionTarget;
        bytes actionData;
    }

    uint256 public nextSentinelId;
    mapping(uint256 => SentinelConfig) public sentinels;
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
     * @notice Register a new monitoring Sentinel with validation.
     * @param sType The category of the sentinel.
     * @param target The address to monitor.
     * @param threshold The value triggering the alert.
     * @param actionTarget The contract to call when triggered.
     * @param actionData The call data for the action.
     */
    function registerSentinel(
        SentinelType sType,
        address target,
        uint256 threshold,
        address actionTarget,
        bytes calldata actionData
    ) external returns (uint256 id) {
        // Validation: If actionTarget is provided, it must be a contract (or at least not the null address)
        // Note: target could be an EOA (Whale Watch), but actionTarget is for execution.
        if (actionTarget != address(0)) {
            require(actionTarget.code.length > 0, "INVALID_ACTION_TARGET");
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

        emit SentinelCreated(id, msg.sender, sType, target, threshold);
    }

    function toggleSentinel(uint256 id) external {
        require(sentinels[id].owner == msg.sender, "UNAUTHORIZED");
        sentinels[id].isActive = !sentinels[id].isActive;
        emit SentinelToggled(id, sentinels[id].isActive);
    }

    function getUserSentinels(address user) external view returns (uint256[] memory) {
        return userSentinelIds[user];
    }
}
