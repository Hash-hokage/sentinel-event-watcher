// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SentinelHandler} from "../src/SentinelHandler.sol";
import {SentinelRegistry} from "../src/SentinelRegistry.sol";

/**
 * @title DeploySomnia
 * @notice Redeployment script — deploys only SentinelRegistry and SentinelHandler.
 * @dev Reuses existing SentinelCore, MockPriceOracle, and MockBridge contracts.
 *      Precompile subscription calls (subscribeToBlockTick, subscribeToEmitter)
 *      must be done post-deploy via `cast send` because the Somnia Reactivity
 *      Precompile at 0x0100 does not exist in Forge's local VM.
 *
 *      Network: Somnia Testnet (Chain ID 50312)
 *      RPC: https://api.infra.testnet.somnia.network
 */
contract DeploySomnia is Script {
    // ─── Existing contracts (DO NOT REDEPLOY) ───
    address constant SENTINEL_CORE   = 0x9FeD00Dc284464e66C996dF0fc3ee24e440ED660;
    address constant MOCK_ORACLE     = 0xf586CdD8386e5692b8AB7ef04572700d69eE533C;
    address constant MOCK_BRIDGE     = 0x7f75521779Ae4CDD3c5eC9fd33221B1E07073dfc;

    function run() public {
        console.log("Starting Sentinel V3 Redeployment on Somnia...");
        console.log("Deployer Address:", msg.sender);
        console.log("Deployer Balance:", msg.sender.balance);

        vm.startBroadcast();

        // 1. Deploy the Sentinel Registry (Source of Truth)
        SentinelRegistry registry = new SentinelRegistry();
        console.log("SentinelRegistry deployed at:", address(registry));

        // 2. Deploy the Reactive Handler (constructor: sentinel, registry, oracle)
        SentinelHandler handler = new SentinelHandler(
            SENTINEL_CORE,
            address(registry),
            MOCK_ORACLE
        );
        console.log("SentinelHandler deployed at:", address(handler));

        // 3. Wire up: let the registry auto-subscribe via the handler
        registry.setHandler(address(handler));
        console.log("Registry -> Handler wired up.");

        vm.stopBroadcast();

        // NOTE: Precompile-dependent calls must be done post-deploy via cast send:
        //   cast send <HANDLER> "subscribeToBlockTick()" --rpc-url <RPC> --account somniaDeployer
        //   cast send <HANDLER> "subscribeToEmitter(address)" <MOCK_ORACLE> --rpc-url <RPC> --account somniaDeployer
        //   cast send <HANDLER> "subscribeToEmitter(address)" <MOCK_BRIDGE>  --rpc-url <RPC> --account somniaDeployer

        console.log("--------------------------------------------------");
        console.log("DEPLOYMENT_COMPLETE");
        console.log("SentinelRegistry:", address(registry));
        console.log("SentinelHandler:", address(handler));
        console.log("SentinelCore (reused):", SENTINEL_CORE);
        console.log("MockPriceOracle (reused):", MOCK_ORACLE);
        console.log("MockBridge (reused):", MOCK_BRIDGE);
        console.log("--------------------------------------------------");
        console.log("");
        console.log("POST-DEPLOY: Run these cast commands to subscribe:");
        console.log("  cast send <HANDLER> 'subscribeToBlockTick()' --rpc-url https://api.infra.testnet.somnia.network --account somniaDeployer");
        console.log("  cast send <HANDLER> 'subscribeToEmitter(address)' 0xf586CdD8386e5692b8AB7ef04572700d69eE533C --rpc-url https://api.infra.testnet.somnia.network --account somniaDeployer");
        console.log("  cast send <HANDLER> 'subscribeToEmitter(address)' 0x7f75521779Ae4CDD3c5eC9fd33221B1E07073dfc --rpc-url https://api.infra.testnet.somnia.network --account somniaDeployer");
    }
}
