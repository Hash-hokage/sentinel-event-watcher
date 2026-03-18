// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {SentinelRegistry} from "../src/SentinelRegistry.sol";

contract SentinelRegistryTest is Test {
    SentinelRegistry public registry;
    address user = address(0xDEAD);

    function setUp() public {
        registry = new SentinelRegistry();
    }

    function test_RegisterSentinel() public {
        vm.startPrank(user);
        
        uint256 id = registry.registerSentinel(
            SentinelRegistry.SentinelType.WALLET_WATCH,
            address(0x123),
            1000 ether
        );

        assertEq(id, 0);
        
        (address owner, SentinelRegistry.SentinelType sType, address target, uint256 threshold, bool active) = registry.sentinels(id);
        
        assertEq(owner, user);
        assertEq(uint(sType), uint(SentinelRegistry.SentinelType.WALLET_WATCH));
        assertEq(target, address(0x123));
        assertEq(threshold, 1000 ether);
        assertTrue(active);

        uint256[] memory userIds = registry.getUserSentinels(user);
        assertEq(userIds.length, 1);
        assertEq(userIds[0], 0);

        vm.stopPrank();
    }

    function test_ToggleSentinel() public {
        vm.startPrank(user);
        uint256 id = registry.registerSentinel(SentinelRegistry.SentinelType.PRICE_ALERT, address(0x456), 500);
        
        registry.toggleSentinel(id);
        (,,,, bool active) = registry.sentinels(id);
        assertFalse(active);

        registry.toggleSentinel(id);
        (,,,, active) = registry.sentinels(id);
        assertTrue(active);

        vm.stopPrank();
    }
}
