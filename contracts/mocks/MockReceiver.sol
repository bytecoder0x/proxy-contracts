// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {IVault} from "../interfaces/vault/IVault.sol";

// has no receive function, so it can not get ETH back from the vault
contract MockReceiver {
    function deposit(address _vault) external payable {
        IVault(_vault).deposit{value: msg.value}();
    }

    function withdraw(address _vault, uint256 _amount) external {
        IVault(_vault).withdraw(_amount);
    }
}
