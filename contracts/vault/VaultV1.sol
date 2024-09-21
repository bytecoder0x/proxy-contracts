// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract VaultV1 is Initializable {
    error OwnerIsZeroAddress();
    error AmountIsZero();
    error InsufficientBalance();
    error TransferFailed();

    uint256 public totalDeposits;
    address public owner;

    mapping(address => uint256) public balances;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) external initializer {
        if (_owner == address(0)) revert OwnerIsZeroAddress();

        owner = _owner;
    }

    function deposit() external payable {
        if (msg.value == 0) revert AmountIsZero();

        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 _amount) external {
        if (_amount == 0) revert AmountIsZero();
        if (balances[msg.sender] < _amount) revert InsufficientBalance();

        balances[msg.sender] -= _amount;
        totalDeposits -= _amount;

        (bool success, ) = msg.sender.call{value: _amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, _amount);
    }
}
