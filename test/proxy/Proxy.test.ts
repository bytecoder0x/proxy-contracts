import { Proxy, VaultV1, VaultV2 } from "../../typechain-types";
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
	let vaultV2: VaultV2;
	let admin: HardhatEthersSigner;
	let owner: HardhatEthersSigner;
	let user: HardhatEthersSigner;
	let otherUser: HardhatEthersSigner;

	beforeEach(async () => {
		({ admin, owner, user, otherUser, vaultV1, newVaultV1, vaultV2, proxy, vault } = await loadFixture(deployProxy));
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

		it("Should prevent deploy if implementation is not a contract", async function () {
			const ProxyFactory = await ethers.getContractFactory("Proxy");

			await expect(ProxyFactory.deploy(user.address, admin.address, "0x")).to.be.revertedWithCustomError(
				ProxyFactory,
				"ImplementationIsNotContract"
			);
		});

		it("Should prevent deploy with zero admin address", async function () {
			const ProxyFactory = await ethers.getContractFactory("Proxy");

			await expect(ProxyFactory.deploy(vaultV1.target, ethers.ZeroAddress, "0x")).to.be.revertedWithCustomError(
				ProxyFactory,
				"AdminIsZeroAddress"
			);
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

		it("Should prevent withdraw of zero amount or more than balance", async function () {
			await vault.connect(user).deposit({ value: DEPOSIT_AMOUNT });

			await expect(vault.connect(user).withdraw(0)).to.be.revertedWithCustomError(vault, "AmountIsZero");
			await expect(vault.connect(user).withdraw(DEPOSIT_AMOUNT + 1n)).to.be.revertedWithCustomError(
				vault,
				"InsufficientBalance"
			);
		});

		it("Should revert if the receiver does not accept ETH", async function () {
			const MockReceiverFactory = await ethers.getContractFactory("MockReceiver");
			const receiver = await MockReceiverFactory.deploy();
			await receiver.waitForDeployment();

			await receiver.deposit(proxy.target, { value: DEPOSIT_AMOUNT });

			await expect(receiver.withdraw(proxy.target, DEPOSIT_AMOUNT)).to.be.revertedWithCustomError(
				vault,
				"TransferFailed"
			);
		});

		it("Should prevent initialize twice", async function () {
			await expect(vault.connect(user).initialize(user.address)).to.be.revertedWithCustomError(
				vault,
				"InvalidInitialization"
			);
			await expect(vaultV1.initialize(user.address)).to.be.revertedWithCustomError(vaultV1, "InvalidInitialization");
		});

		it("Should prevent initialize with zero owner", async function () {
			const ProxyFactory = await ethers.getContractFactory("Proxy");
			const newProxy = await ProxyFactory.deploy(vaultV1.target, admin.address, "0x");
			await newProxy.waitForDeployment();

			const newVault = await ethers.getContractAt("VaultV1", newProxy.target);

			await expect(newVault.initialize(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				newVault,
				"OwnerIsZeroAddress"
			);
		});

		it("Should prevent send ETH to the proxy without deposit", async function () {
			await expect(user.sendTransaction({ to: proxy.target, value: DEPOSIT_AMOUNT })).to.be.reverted;
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

		it("Should prevent upgrade to non-contract address", async function () {
			await expect(proxy.upgradeTo(user.address)).to.be.revertedWithCustomError(proxy, "ImplementationIsNotContract");
			await expect(proxy.upgradeTo(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				proxy,
				"ImplementationIsNotContract"
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

		it("Should prevent change admin to zero address", async function () {
			await expect(proxy.changeAdmin(ethers.ZeroAddress)).to.be.revertedWithCustomError(proxy, "AdminIsZeroAddress");
		});
	});

	describe("Upgrade with call", function () {
		it("Should upgrade and call the new implementation", async function () {
			const data = vaultV2.interface.encodeFunctionData("deposit");

			await proxy.connect(admin).upgradeToAndCall(vaultV2.target, data, { value: DEPOSIT_AMOUNT });

			const upgradedVault = await ethers.getContractAt("VaultV2", proxy.target);

			expect(await proxy.implementation()).to.eq(vaultV2.target);
			expect(await upgradedVault.balances(admin.address)).to.eq(DEPOSIT_AMOUNT);
			expect(await upgradedVault.version()).to.eq(2);
		});

		it("Should prevent upgrade with call if it is not called by the admin", async function () {
			const data = vaultV2.interface.encodeFunctionData("deposit");

			await expect(proxy.connect(user).upgradeToAndCall(vaultV2.target, data)).to.be.revertedWithCustomError(
				proxy,
				"OnlyAdminAllowed"
			);
		});

		it("Should revert if the call to the new implementation fails", async function () {
			// vault is already initialized in the fixture
			const data = vaultV2.interface.encodeFunctionData("initialize", [owner.address]);

			await expect(proxy.upgradeToAndCall(vaultV2.target, data)).to.be.revertedWithCustomError(
				proxy,
				"DelegateCallFailed"
			);
			expect(await proxy.implementation()).to.eq(vaultV1.target);
		});
	});
});
