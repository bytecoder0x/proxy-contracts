import { ethers } from "hardhat";

export const IMPLEMENTATION_SLOT = ethers.toBeHex(BigInt(ethers.id("eip1967.proxy.implementation")) - 1n);
export const ADMIN_SLOT = ethers.toBeHex(BigInt(ethers.id("eip1967.proxy.admin")) - 1n);

export const DEPOSIT_AMOUNT = ethers.parseEther("1");
export const WITHDRAW_AMOUNT = ethers.parseEther("0.5");
