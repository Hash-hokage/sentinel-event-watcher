// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Sentinel {
    // The main event our frontend will watch for
    event AlertTriggered(
        address indexed sender,
        string indexed alertType,
        string message,
        uint256 timestamp
    );

    // Keep track of total alerts triggered across the system
    uint256 public totalAlerts;
    
    // Keep track of how many alerts each address has triggered
    mapping(address => uint256) public alertsByUser;

    /**
     * @dev Trigger a new alert which emits the AlertTriggered event
     * @param alertType A categorical string (e.g., "SECURITY", "SYSTEM")
     * @param message A detailed description of the alert
     */
    function triggerAlert(string memory alertType, string memory message) external {
        totalAlerts++;
        alertsByUser[msg.sender]++;

        emit AlertTriggered(msg.sender, alertType, message, block.timestamp);
    }
}
