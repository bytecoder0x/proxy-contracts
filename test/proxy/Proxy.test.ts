import { Proxy, VaultV1 } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployProxy } from "../utils";
import { ADMIN_SLOT, DEPOSIT_AMOUNT, IMPLEMENTATION_SLOT, WITHDRAW_AMOUNT } from "../constants";

describe("Proxy", function () {
	let proxy: Proxy;
	let vault: VaultV1;
	let vaultV1: VaultV1;
	let newVaultV1: VaultV1;
	let admin: HardhatEthersSigner;
	let owner: HardhatEthersSigner;
	let user: HardhatEthersSigner;
	let otherUser: HardhatEthersSigner;

	beforeEach(async () => {
		({ admin, owner, user, otherUser, vaultV1, newVaultV1, proxy, vault } = await loadFixture(deployProxy));
	});

	const getAddressFromSlot = async (slot: string) => {
		const value = await ethers.provider.getStorage(proxy.target, slot);
		return ethers.getAddress(ethers.dataSlice(value, 12));
	};

	describe("Deployment", function () {
		it("Should set the implementation", async function () {
			expect(await proxy.implementation()).to.eq(vaultV1.target);
		});

		it("Should set the admin", async function () {
			expect(await proxy.admin()).to.eq(admin.address);
		});

		it("Should store the implementation and the admin in eip1967 slots", async function () {
			expect(await getAddressFromSlot(IMPLEMENTATION_SLOT)).to.eq(vaultV1.target);
			expect(await getAddressFromSlot(ADMIN_SLOT)).to.eq(admin.address);
		});
	});

	describe("Calls through the proxy", function () {
		it("Should set the owner of the vault", async function () {
			expect(await vault.owner()).to.eq(owner.address);
			expect(await vaultV1.owner()).to.eq(ethers.ZeroAddress);
		});

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

	describe("Upgrade", function () {
		it("Should allow admin to change the implementation", async function () {
			const tx = await proxy.connect(admin).upgradeTo(newVaultV1.target);

			await expect(tx).to.emit(proxy, "Upgraded").withArgs(newVaultV1.target);
			expect(await proxy.implementation()).to.eq(newVaultV1.target);
		});

		it("Should prevent upgrade if it is not called by the admin", async function () {
			await expect(proxy.connect(user).upgradeTo(newVaultV1.target)).to.be.revertedWithCustomError(
				proxy,
				"OnlyAdminAllowed"
			);
		});

		it("Should allow the new admin to upgrade and prevent the old one", async function () {
			const tx = await proxy.connect(admin).changeAdmin(otherUser.address);

			await expect(tx).to.emit(proxy, "AdminChanged").withArgs(admin.address, otherUser.address);
			expect(await proxy.admin()).to.eq(otherUser.address);

			await expect(proxy.connect(admin).upgradeTo(newVaultV1.target)).to.be.revertedWithCustomError(
				proxy,
				"OnlyAdminAllowed"
			);

			await proxy.connect(otherUser).upgradeTo(newVaultV1.target);
			expect(await proxy.implementation()).to.eq(newVaultV1.target);
		});

		it("Should prevent change admin if it is not called by the admin", async function () {
			await expect(proxy.connect(user).changeAdmin(user.address)).to.be.revertedWithCustomError(
				proxy,
				"OnlyAdminAllowed"
			);
		});
	});
});
