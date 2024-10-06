import { Proxy, VaultV1, VaultV2 } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployProxy, deployUpgradedVault } from "../utils";
import { DEPOSIT_AMOUNT, DEPOSIT_LIMIT } from "../constants";

describe("Vault", function () {
    let proxy: Proxy;
    let vault: VaultV1;
    let vaultV2: VaultV2;
    let upgradedVault: VaultV2;
    let admin: HardhatEthersSigner;
    let owner: HardhatEthersSigner;
    let user: HardhatEthersSigner;
    let otherUser: HardhatEthersSigner;

    describe("Upgrade from V1 to V2", function () {
        beforeEach(async () => {
            ({ admin, user, otherUser, vaultV2, proxy, vault } = await loadFixture(deployProxy));
        });

        it("Should keep balances after upgrade", async function () {
            const otherUserAmount = ethers.parseEther("0.7");

            await vault.connect(user).deposit({ value: DEPOSIT_AMOUNT });
            await vault.connect(otherUser).deposit({ value: otherUserAmount });

            await proxy.connect(admin).upgradeTo(vaultV2.target);
            upgradedVault = await ethers.getContractAt("VaultV2", proxy.target);

            expect(await upgradedVault.balances(user.address)).to.eq(DEPOSIT_AMOUNT);
            expect(await upgradedVault.balances(otherUser.address)).to.eq(otherUserAmount);
            expect(await upgradedVault.totalDeposits()).to.eq(DEPOSIT_AMOUNT + otherUserAmount);
            expect(await ethers.provider.getBalance(proxy.target)).to.eq(DEPOSIT_AMOUNT + otherUserAmount);
        });

        it("Should revert version call before upgrade", async function () {
            upgradedVault = await ethers.getContractAt("VaultV2", proxy.target);

            await expect(upgradedVault.version()).to.be.reverted;
        });

        it("Should initialize V2 on a new proxy", async function () {
            const ProxyFactory = await ethers.getContractFactory("Proxy");
            const newProxy = await ProxyFactory.deploy(vaultV2.target, admin.address, "0x");
            await newProxy.waitForDeployment();

            const newVault = await ethers.getContractAt("VaultV2", newProxy.target);

            await expect(newVault.initialize(ethers.ZeroAddress)).to.be.revertedWithCustomError(
                newVault,
                "OwnerIsZeroAddress"
            );

            await newVault.initialize(user.address);
            expect(await newVault.owner()).to.eq(user.address);
        });
    });

    describe("Vault V2", function () {
        beforeEach(async () => {
            ({ admin, owner, user, otherUser, proxy, upgradedVault } = await loadFixture(deployUpgradedVault));
        });

        it("Should keep the owner after upgrade", async function () {
            expect(await upgradedVault.owner()).to.eq(owner.address);
        });

        it("Should return version 2", async function () {
            expect(await upgradedVault.version()).to.eq(2);
        });

        it("Should withdraw the deposit made before upgrade", async function () {
            const tx = await upgradedVault.connect(user).withdraw(DEPOSIT_AMOUNT);

            await expect(tx).to.changeEtherBalances([proxy, user], [-DEPOSIT_AMOUNT, DEPOSIT_AMOUNT]);
            await expect(tx).to.emit(upgradedVault, "Withdrawn").withArgs(user.address, DEPOSIT_AMOUNT);
            expect(await upgradedVault.balances(user.address)).to.eq(0);
            expect(await upgradedVault.totalDeposits()).to.eq(0);
        });

        it("Should prevent withdraw more than balance", async function () {
            await expect(upgradedVault.connect(user).withdraw(DEPOSIT_AMOUNT + 1n)).to.be.revertedWithCustomError(
                upgradedVault,
                "InsufficientBalance"
            );
            await expect(upgradedVault.connect(otherUser).withdraw(DEPOSIT_AMOUNT)).to.be.revertedWithCustomError(
                upgradedVault,
                "InsufficientBalance"
            );
        });

        it("Should prevent deposit and withdraw of zero amount", async function () {
            await expect(upgradedVault.connect(user).deposit({ value: 0 })).to.be.revertedWithCustomError(
                upgradedVault,
                "AmountIsZero"
            );
            await expect(upgradedVault.connect(user).withdraw(0)).to.be.revertedWithCustomError(
                upgradedVault,
                "AmountIsZero"
            );
        });

        it("Should revert if the receiver does not accept ETH", async function () {
            const MockReceiverFactory = await ethers.getContractFactory("MockReceiver");
            const receiver = await MockReceiverFactory.deploy();
            await receiver.waitForDeployment();

            await receiver.deposit(proxy.target, { value: DEPOSIT_AMOUNT });

            await expect(receiver.withdraw(proxy.target, DEPOSIT_AMOUNT)).to.be.revertedWithCustomError(
                upgradedVault,
                "TransferFailed"
            );
        });

        it("Should set the deposit limit", async function () {
            const tx = await upgradedVault.connect(owner).setDepositLimit(DEPOSIT_LIMIT);

            await expect(tx).to.emit(upgradedVault, "DepositLimitSet").withArgs(DEPOSIT_LIMIT);
            expect(await upgradedVault.depositLimit()).to.eq(DEPOSIT_LIMIT);
        });

        it("Should prevent set deposit limit if it is not called by the owner", async function () {
            await expect(upgradedVault.connect(user).setDepositLimit(DEPOSIT_LIMIT)).to.be.revertedWithCustomError(
                upgradedVault,
                "OnlyOwnerAllowed"
            );
            await expect(upgradedVault.connect(admin).setDepositLimit(DEPOSIT_LIMIT)).to.be.revertedWithCustomError(
                upgradedVault,
                "OnlyOwnerAllowed"
            );
        });

        it("Should prevent deposit more than the limit", async function () {
            await upgradedVault.connect(owner).setDepositLimit(DEPOSIT_LIMIT);

            await expect(
                upgradedVault.connect(otherUser).deposit({ value: DEPOSIT_LIMIT + 1n })
            ).to.be.revertedWithCustomError(upgradedVault, "ExceedsDepositLimit");
        });

        it("Should count the deposit from V1 in the limit", async function () {
            await upgradedVault.connect(owner).setDepositLimit(DEPOSIT_LIMIT);

            await expect(upgradedVault.connect(user).deposit({ value: DEPOSIT_LIMIT })).to.be.revertedWithCustomError(
                upgradedVault,
                "ExceedsDepositLimit"
            );

            await upgradedVault.connect(user).deposit({ value: DEPOSIT_LIMIT - DEPOSIT_AMOUNT });
            expect(await upgradedVault.balances(user.address)).to.eq(DEPOSIT_LIMIT);
        });

        it("Should allow any deposit if the limit is zero", async function () {
            const amount = ethers.parseEther("100");

            await upgradedVault.connect(owner).setDepositLimit(DEPOSIT_LIMIT);
            await upgradedVault.connect(owner).setDepositLimit(0);
            await upgradedVault.connect(otherUser).deposit({ value: amount });

            expect(await upgradedVault.balances(otherUser.address)).to.eq(amount);
        });
    });
});
