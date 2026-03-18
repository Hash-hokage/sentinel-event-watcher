// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {SentinelRegistry} from "../src/SentinelRegistry.sol";

contract SentinelRegistryTest is Test {
    SentinelRegistry public registry;
    address user = address(0xDEAD);
    address mockContract;

    function setUp() public {
        registry = new SentinelRegistry();
        // Deploy a simple mock contract to satisfy the code length check
        mockContract = address(new MockContract());
    }

    // --- Happy Paths ---

    function test_RegisterSentinel_NoAction() public {
        vm.prank(user);
        uint256 id = registry.registerSentinel(
            SentinelRegistry.SentinelType.WALLET_WATCH,
            address(0x123),
            100,
            address(0),
            ""
        );
        assertEq(id, 0);
    }

    function test_RegisterSentinel_WithAction() public {
        vm.prank(user);
        uint256 id = registry.registerSentinel(
            SentinelRegistry.SentinelType.PRICE_ALERT,
            address(0x123),
            500,
            mockContract,
            abi.encodeWithSignature("ping()")
        );
        assertEq(id, 0);
        
        (,,,,,, bytes memory data) = registry.sentinels(id);
        assertEq(data, abi.encodeWithSignature("ping()"));
    }

    function test_ToggleSentinel() public {
        vm.startPrank(user);
        uint256 id = registry.registerSentinel(
            SentinelRegistry.SentinelType.SYSTEM_HEALTH,
            address(0x123),
            0,
            address(0),
            ""
        );
        
        registry.toggleSentinel(id);
        (,,,, bool active,,) = registry.sentinels(id);
        assertFalse(active);
        vm.stopPrank();
    }

    // --- Unhappy Paths ---

    function test_CannotRegisterInvalidActionTarget() public {
        vm.prank(user);
        // address(0x789) is an EOA (no code), should fail
        vm.expectRevert("INVALID_ACTION_TARGET");
        registry.registerSentinel(
            SentinelRegistry.SentinelType.WALLET_WATCH,
            address(0x123),
            100,
            address(0x789),
            ""
        );
    }

    function test_UnauthorizedToggle() public {
        vm.prank(user);
        uint256 id = registry.registerSentinel(
            SentinelRegistry.SentinelType.WALLET_WATCH,
            address(0x123),
            100,
            address(0),
            ""
        );

        vm.prank(address(0xBAD));
        vm.expectRevert("UNAUTHORIZED");
        registry.toggleSentinel(id);
    }
}

contract MockContract {
    function ping() external pure {}
}
