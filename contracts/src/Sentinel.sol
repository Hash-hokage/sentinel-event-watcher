// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Sentinel
 * @notice Core contract for triggering alerts.
 * @dev Fixed: Added access control to prevent unauthorized event spamming.
 */
contract Sentinel {
    event AlertTriggered(
        address indexed sender,
        string indexed alertType,
        string message,
        uint256 timestamp
    );

    error OnlyAuthorized();

    address public owner;
    mapping(address => bool) public authorizedEmitters;

    uint256 public totalAlerts;
    mapping(address => uint256) public alertsByUser;

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedEmitters[msg.sender] = true;
    }

    /**
     * @notice Authorize an address to trigger alerts.
     */
    function authorizeEmitter(address emitter, bool status) external onlyOwner {
        authorizedEmitters[emitter] = status;
    }

    /**
     * @dev Trigger a new alert. Only authorized addresses can call this.
     */
    function triggerAlert(string memory alertType, string memory message) external {
        if (!authorizedEmitters[msg.sender]) revert OnlyAuthorized();
        
        totalAlerts++;
        alertsByUser[msg.sender]++;

        emit AlertTriggered(msg.sender, alertType, message, block.timestamp);
    }
}
