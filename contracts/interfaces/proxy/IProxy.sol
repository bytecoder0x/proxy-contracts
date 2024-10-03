// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IProxy {
    error ImplementationIsNotContract();
    error AdminIsZeroAddress();
    error OnlyAdminAllowed();
    error DelegateCallFailed();

    event Upgraded(address indexed implementation);
    event AdminChanged(address previousAdmin, address newAdmin);

    function upgradeTo(address _implementation) external;
    function upgradeToAndCall(address _implementation, bytes calldata _data) external payable;
    function changeAdmin(address _admin) external;

    function implementation() external view returns (address);
    function admin() external view returns (address);
}
