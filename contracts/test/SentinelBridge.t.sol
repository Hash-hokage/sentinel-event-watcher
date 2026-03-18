// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {Sentinel} from "../src/Sentinel.sol";
import {SentinelHandler} from "../src/SentinelHandler.sol";
import {SentinelRegistry} from "../src/SentinelRegistry.sol";
import {MockPriceOracle} from "../src/MockPriceOracle.sol";
import {MockBridge} from "../src/MockBridge.sol";

contract SentinelBridgeTest is Test {
    Sentinel public sentinel;
    SentinelHandler public handler;
    SentinelRegistry public registry;
    MockPriceOracle public oracle;
    MockBridge public bridge;

    address owner = address(0x1);
    address user = address(0x2);
    address token = address(0x3);

    function setUp() public {
        vm.startPrank(owner);
        sentinel = new Sentinel();
        registry = new SentinelRegistry();
        oracle = new MockPriceOracle();
        bridge = new MockBridge();
        handler = new SentinelHandler(address(sentinel), address(registry), address(oracle));
        vm.stopPrank();
    }

    function test_BridgeEventIntercepted() public {
        // 1. Register the Bridge as a Sentinel Target
        vm.prank(user);
        registry.registerSentinel(
            SentinelRegistry.SentinelType.BRIDGE_WATCH,
            address(bridge),
            0,
            address(0),
            ""
        );

        // 2. Simulate Bridge Event
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = keccak256("DepositInitiated(address,address,uint256,uint256)");
        topics[1] = bytes32(uint256(uint160(user))); // indexed sender
        topics[2] = bytes32(uint256(uint160(token))); // indexed token

        // Somnia Reactivity would call handler.onEvent when bridge emits this
        vm.prank(address(0x0100)); // Simulating call from Somnia Precompile
        handler.onEvent(address(bridge), topics, abi.encode(1000, 1)); // amount=1000, destChain=1

        // 3. Verify
        assertEq(handler.reactiveCallCount(), 1);
    }
}
