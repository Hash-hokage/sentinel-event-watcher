// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {Sentinel} from "../src/Sentinel.sol";

contract SentinelTest is Test {
    Sentinel public sentinel;
    address owner = address(0x1);
    address authorized = address(0x2);
    address unauthorized = address(0x3);

    function setUp() public {
        vm.startPrank(owner);
        sentinel = new Sentinel();
        sentinel.authorizeEmitter(authorized, true);
        vm.stopPrank();
    }

    // --- Happy Paths ---

    function test_OwnerCanTriggerAlert() public {
        vm.prank(owner);
        sentinel.triggerAlert("SYSTEM", "Owner alert");
        assertEq(sentinel.totalAlerts(), 1);
    }

    function test_AuthorizedUserCanTriggerAlert() public {
        vm.prank(authorized);
        sentinel.triggerAlert("SECURITY", "Authorized alert");
        assertEq(sentinel.totalAlerts(), 1);
        assertEq(sentinel.alertsByUser(authorized), 1);
    }

    function test_OwnerCanRevokeAuthorization() public {
        vm.startPrank(owner);
        sentinel.authorizeEmitter(authorized, false);
        vm.stopPrank();

        vm.prank(authorized);
        vm.expectRevert(Sentinel.OnlyAuthorized.selector);
        sentinel.triggerAlert("SECURITY", "Failed alert");
    }

    // --- Unhappy Paths ---

    function test_UnauthorizedUserCannotTriggerAlert() public {
        vm.prank(unauthorized);
        vm.expectRevert(Sentinel.OnlyAuthorized.selector);
        sentinel.triggerAlert("SECURITY", "Spam alert");
    }

    function test_NonOwnerCannotAuthorize() public {
        vm.prank(unauthorized);
        vm.expectRevert(Sentinel.OnlyOwner.selector);
        sentinel.authorizeEmitter(unauthorized, true);
    }
}
