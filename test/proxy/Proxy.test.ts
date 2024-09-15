import { Proxy, VaultV1 } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployProxy } from "../utils";
import { DEPOSIT_AMOUNT, IMPLEMENTATION_SLOT, WITHDRAW_AMOUNT } from "../constants";

describe("Proxy", function () {
	let proxy: Proxy;
	let vault: VaultV1;
	let vaultV1: VaultV1;
	let user: HardhatEthersSigner;

	beforeEach(async () => {
		({ user, vaultV1, proxy, vault } = await loadFixture(deployProxy));
	});

	const getAddressFromSlot = async (slot: string) => {
		const value = await ethers.provider.getStorage(proxy.target, slot);
		return ethers.getAddress(ethers.dataSlice(value, 12));
	};

	describe("Deployment", function () {
		it("Should set the implementation", async function () {
			expect(await proxy.implementation()).to.eq(vaultV1.target);
		});

		it("Should store the implementation in eip1967 slot", async function () {
			await vault.connect(user).deposit({ value: DEPOSIT_AMOUNT });

			expect(await getAddressFromSlot(IMPLEMENTATION_SLOT)).to.eq(vaultV1.target);
		});
	});

	describe("Calls through the proxy", function () {
		it("Should deposit through the proxy", async function () {
			const tx = await vault.connect(user).deposit({ value: DEPOSIT_AMOUNT });

			await expect(tx).to.emit(vault, "Deposited").withArgs(user.address, DEPOSIT_AMOUNT);
			expect(await vault.balances(user.address)).to.eq(DEPOSIT_AMOUNT);
			expect(await vault.totalDeposits()).to.eq(DEPOSIT_AMOUNT);
		});

		it("Should keep the state in the proxy, not in the implementation", async function () {
			await vault.connect(user).deposit({ value: DEPOSIT_AMOUNT });

			expect(await ethers.provider.getBalance(proxy.target)).to.eq(DEPOSIT_AMOUNT);
			expect(await ethers.provider.getBalance(vaultV1.target)).to.eq(0);
			expect(await vaultV1.balances(user.address)).to.eq(0);
			expect(await vaultV1.totalDeposits()).to.eq(0);
		});

		it("Should withdraw through the proxy", async function () {
			await vault.connect(user).deposit({ value: DEPOSIT_AMOUNT });

			await expect(vault.connect(user).withdraw(WITHDRAW_AMOUNT)).to.changeEtherBalances(
				[proxy, user],
				[-WITHDRAW_AMOUNT, WITHDRAW_AMOUNT]
			);
			expect(await vault.balances(user.address)).to.eq(DEPOSIT_AMOUNT - WITHDRAW_AMOUNT);
		});

		it("Should prevent deposit of zero amount", async function () {
			await expect(vault.connect(user).deposit({ value: 0 })).to.be.revertedWithCustomError(vault, "AmountIsZero");
		});
	});
});
