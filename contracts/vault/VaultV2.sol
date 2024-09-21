// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract VaultV2 is Initializable {
    error OwnerIsZeroAddress();
    error AmountIsZero();
    error InsufficientBalance();
    error TransferFailed();
    error OnlyOwnerAllowed();
    error ExceedsDepositLimit();

    uint256 public totalDeposits;
    address public owner;

    mapping(address => uint256) public balances;

    // new variables only in the end, otherwise they overwrite the storage of V1
    uint256 public depositLimit;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event DepositLimitSet(uint256 limit);

    constructor() {
        _disableInitializers();
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerAllowed();
        _;
    }

    function initialize(address _owner) external initializer {
        if (_owner == address(0)) revert OwnerIsZeroAddress();

        owner = _owner;
    }

    function deposit() external payable {
        if (msg.value == 0) revert AmountIsZero();
        if (depositLimit > 0 && balances[msg.sender] + msg.value > depositLimit) revert ExceedsDepositLimit();

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

    function setDepositLimit(uint256 _limit) external onlyOwner {
        depositLimit = _limit;

        emit DepositLimitSet(_limit);
    }

    function version() external pure returns (uint256) {
        return 2;
    }
}
