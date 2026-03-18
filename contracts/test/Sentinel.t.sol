// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {Sentinel} from "../src/Sentinel.sol";

contract SentinelTest is Test {
    Sentinel public sentinel;
    
    // Define the event to test its emission
    event AlertTriggered(
        address indexed sender,
        string indexed alertType,
        string message,
        uint256 timestamp
    );

    function setUp() public {
        sentinel = new Sentinel();
    }

    function test_TriggerAlert() public {
        address user = address(0x123);
        vm.startPrank(user);

        // We expect the next call to emit the AlertTriggered event
        // topic1 (sender), topic2 (alertType), topic3 (none), data (message, timestamp)
        vm.expectEmit(true, true, false, true);
        emit AlertTriggered(user, "SECURITY", "Unauthorized access attempt", block.timestamp);
        
        sentinel.triggerAlert("SECURITY", "Unauthorized access attempt");
        
        assertEq(sentinel.totalAlerts(), 1);
        assertEq(sentinel.alertsByUser(user), 1);
        
        vm.stopPrank();
    }
    
    function testFuzz_TriggerAlert(address user, string memory alertType, string memory message) public {
        vm.assume(user != address(0));
        
        vm.startPrank(user);
        sentinel.triggerAlert(alertType, message);
        
        assertEq(sentinel.totalAlerts(), 1);
        assertEq(sentinel.alertsByUser(user), 1);
        
        vm.stopPrank();
    }
}
