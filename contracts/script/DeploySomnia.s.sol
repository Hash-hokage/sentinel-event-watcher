// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Sentinel} from "../src/Sentinel.sol";
import {SentinelHandler} from "../src/SentinelHandler.sol";

/**
 * @title DeploySomnia
 * @notice Deployment script for Somnia Testnet.
 * @dev Somnia Network Info:
 *      Chain ID: 50312
 *      RPC: https://api.infra.testnet.somnia.network
 *      
 *      Foundry Deployment Note: 
 *      Must use --gas-estimate-multiplier 200 due to Somnia's unique gas model.
 */
contract DeploySomnia is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy the main Sentinel contract
        Sentinel sentinel = new Sentinel();
        console.log("Sentinel deployed to Somnia at:", address(sentinel));

        // 2. Deploy the Reactive Handler
        SentinelHandler handler = new SentinelHandler(address(sentinel));
        console.log("SentinelHandler deployed to Somnia at:", address(handler));

        vm.stopBroadcast();

        console.log("--------------------------------------------------");
        console.log("DEPLOYMENT_COMPLETE");
        console.log("NETWORK: SOMNIA_TESTNET (50312)");
        console.log("NEXT_STEP: Create a Solidity Subscription via the Somnia SDK");
        console.log("--------------------------------------------------");
    }
}
