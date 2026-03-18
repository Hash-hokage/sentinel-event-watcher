// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Sentinel} from "../src/Sentinel.sol";

contract SentinelScript is Script {
    function setUp() public {}

    function run() public {
        // Retrieve private key from environment or use a default anvil key for local dev
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        
        vm.startBroadcast(deployerPrivateKey);
        Sentinel sentinel = new Sentinel();
        console.log("Sentinel deployed at:", address(sentinel));
        vm.stopBroadcast();
    }
}
