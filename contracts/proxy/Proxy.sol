// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {StorageSlot} from "@openzeppelin/contracts/utils/StorageSlot.sol";

contract Proxy {
    error ImplementationIsNotContract();

    bytes32 private constant IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    constructor(address _implementation) {
        if (_implementation.code.length == 0) revert ImplementationIsNotContract();

        StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value = _implementation;
    }

    fallback() external payable {
        _delegate(implementation());
    }

    receive() external payable {
        _delegate(implementation());
    }

    function implementation() public view returns (address) {
        return StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value;
    }

    function _delegate(address _implementation) private {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), _implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            // result is 0 if the implementation reverted, then revert with the same data
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
