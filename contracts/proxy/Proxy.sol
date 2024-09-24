// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {StorageSlot} from "@openzeppelin/contracts/utils/StorageSlot.sol";

contract Proxy {
    error ImplementationIsNotContract();
    error AdminIsZeroAddress();
    error OnlyAdminAllowed();

    bytes32 private constant IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    bytes32 private constant ADMIN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);

    event Upgraded(address indexed implementation);
    event AdminChanged(address previousAdmin, address newAdmin);

    constructor(address _implementation, address _admin) {
        _setImplementation(_implementation);
        _setAdmin(_admin);
    }

    modifier onlyAdmin() {
        if (msg.sender != admin()) revert OnlyAdminAllowed();
        _;
    }

    fallback() external payable {
        _delegate(implementation());
    }

    receive() external payable {
        _delegate(implementation());
    }

    function upgradeTo(address _implementation) external onlyAdmin {
        _setImplementation(_implementation);
    }

    function changeAdmin(address _admin) external onlyAdmin {
        _setAdmin(_admin);
    }

    function implementation() public view returns (address) {
        return StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value;
    }

    function admin() public view returns (address) {
        return StorageSlot.getAddressSlot(ADMIN_SLOT).value;
    }

    function _setImplementation(address _implementation) private {
        if (_implementation.code.length == 0) revert ImplementationIsNotContract();

        StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value = _implementation;
        emit Upgraded(_implementation);
    }

    function _setAdmin(address _admin) private {
        if (_admin == address(0)) revert AdminIsZeroAddress();

        emit AdminChanged(admin(), _admin);
        StorageSlot.getAddressSlot(ADMIN_SLOT).value = _admin;
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
