// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IVault {
    error OwnerIsZeroAddress();
    error AmountIsZero();
    error InsufficientBalance();
    error TransferFailed();

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function totalDeposits() external view returns (uint256);
    function owner() external view returns (address);
    function balances(address _user) external view returns (uint256);

    function initialize(address _owner) external;
    function deposit() external payable;
    function withdraw(uint256 _amount) external;
}

interface IVaultV2 is IVault {
    error OnlyOwnerAllowed();
    error ExceedsDepositLimit();

    event DepositLimitSet(uint256 limit);

    function depositLimit() external view returns (uint256);

    function setDepositLimit(uint256 _limit) external;
    function version() external pure returns (uint256);
}
