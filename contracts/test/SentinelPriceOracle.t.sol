// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {Sentinel} from "../src/Sentinel.sol";
import {SentinelHandler} from "../src/SentinelHandler.sol";
import {SentinelRegistry} from "../src/SentinelRegistry.sol";
import {MockPriceOracle} from "../src/MockPriceOracle.sol";

contract SentinelPriceOracleTest is Test {
    Sentinel public sentinel;
    SentinelHandler public handler;
    SentinelRegistry public registry;
    MockPriceOracle public oracle;

    address owner = address(0x1);
    address user = address(0x2);
    address token = address(0x3);
    address SOMNIA_PRECOMPILE = address(0x0100);

    function setUp() public {
        vm.startPrank(owner);
        sentinel = new Sentinel();
        registry = new SentinelRegistry();
        oracle = new MockPriceOracle();
        handler = new SentinelHandler(address(sentinel), address(registry), address(oracle));
        vm.stopPrank();
    }

    function test_PriceAlertTriggeredOnBlockTick() public {
        // 1. Setup Oracle Price
        vm.prank(owner);
        oracle.setPrice(token, 1500); // $1500

        // 2. Register a Sentinel for Price Alert
        vm.prank(user);
        registry.registerSentinel(
            SentinelRegistry.SentinelType.PRICE_ALERT,
            token,
            1400, // Threshold: $1400
            address(0),
            ""
        );

        // 3. Simulate BlockTick from Somnia Precompile
        bytes32[] memory topics = new bytes32[](2);
        topics[0] = keccak256("BlockTick(uint64)");
        topics[1] = bytes32(uint256(12345)); // Block number

        vm.prank(SOMNIA_PRECOMPILE);
        handler.onEvent(SOMNIA_PRECOMPILE, topics, "");

        // 4. Verify that the price alert was processed
        assertEq(handler.priceAlertsProcessed(), 1);
    }

    function test_PriceAlertNotTriggeredIfBelowThreshold() public {
        // 1. Setup Oracle Price
        vm.prank(owner);
        oracle.setPrice(token, 1300); // $1300

        // 2. Register a Sentinel for Price Alert
        vm.prank(user);
        registry.registerSentinel(
            SentinelRegistry.SentinelType.PRICE_ALERT,
            token,
            1400, // Threshold: $1400
            address(0),
            ""
        );

        // 3. Simulate BlockTick
        bytes32[] memory topics = new bytes32[](2);
        topics[0] = keccak256("BlockTick(uint64)");
        topics[1] = bytes32(uint256(12346));

        vm.prank(SOMNIA_PRECOMPILE);
        handler.onEvent(SOMNIA_PRECOMPILE, topics, "");

        // 4. Verify that no alert was processed
        assertEq(handler.priceAlertsProcessed(), 0);
    }
}
