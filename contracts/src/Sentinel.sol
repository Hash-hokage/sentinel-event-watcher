// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Sentinel
 * @notice Core alert engine for the Sentinel Event Watcher.
 * @dev Emits AlertTriggered events that are monitored by the Reactive Layer.
 *      Includes security-hardened access control to prevent unauthorized spam.
 */
contract Sentinel {
    /// @notice Emitted when a validated alert is triggered.
    /// @param sender The address that triggered the alert.
    /// @param alertType A string identifying the category (e.g., "SECURITY", "WHALE").
    /// @param message A descriptive message about the event.
    /// @param timestamp The block timestamp when the alert occurred.
    event AlertTriggered(
        address indexed sender,
        string indexed alertType,
        string message,
        uint256 timestamp
    );

    /// @notice Thrown when an unauthorized address attempts to trigger an alert.
    error OnlyAuthorized();

    /// @notice Thrown when a non-owner address attempts a restricted action.
    error OnlyOwner();

    /// @notice The owner of the Sentinel contract.
    address public immutable owner;

    /// @notice Addresses authorized to emit global alerts.
    mapping(address => bool) public authorizedEmitters;

    /// @notice Total number of alerts ever triggered.
    uint256 public totalAlerts;

    /// @notice Number of alerts triggered by each address.
    mapping(address => uint256) public alertsByUser;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedEmitters[msg.sender] = true;
    }

    /**
     * @notice Authorizes or revokes an address's ability to trigger alerts.
     * @param emitter The address to update.
     * @param status True to authorize, false to revoke.
     */
    function authorizeEmitter(address emitter, bool status) external onlyOwner {
        authorizedEmitters[emitter] = status;
    }

    /**
     * @notice Triggers a new system-wide alert.
     * @dev Only authorized addresses can call this.
     *      Emits the `AlertTriggered` event which the Reactivity layer picks up.
     * @param alertType The category of the alert.
     * @param message Detailed information about the trigger.
     */
    function triggerAlert(string memory alertType, string memory message) external {
        if (!authorizedEmitters[msg.sender]) revert OnlyAuthorized();
        
        totalAlerts++;
        unchecked {
            alertsByUser[msg.sender]++;
        }

        emit AlertTriggered(msg.sender, alertType, message, block.timestamp);
    }
}
