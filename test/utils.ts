import { ethers } from "hardhat";
import { DEPOSIT_AMOUNT } from "./constants";

export const deployProxy = async () => {
    const [admin, owner, user, otherUser] = await ethers.getSigners();

    const VaultV1Factory = await ethers.getContractFactory("VaultV1");
    const vaultV1 = await VaultV1Factory.deploy();
    await vaultV1.waitForDeployment();

    const newVaultV1 = await VaultV1Factory.deploy();
    await newVaultV1.waitForDeployment();

    const VaultV2Factory = await ethers.getContractFactory("VaultV2");
    const vaultV2 = await VaultV2Factory.deploy();
    await vaultV2.waitForDeployment();

    const initData = vaultV1.interface.encodeFunctionData("initialize", [owner.address]);

    const ProxyFactory = await ethers.getContractFactory("Proxy");
    const proxy = await ProxyFactory.deploy(vaultV1.target, admin.address, initData);
    await proxy.waitForDeployment();

    const vault = await ethers.getContractAt("VaultV1", proxy.target);

    return { admin, owner, user, otherUser, vaultV1, newVaultV1, vaultV2, proxy, vault };
};

export const deployUpgradedVault = async () => {
    const { admin, owner, user, otherUser, vaultV2, proxy, vault } = await deployProxy();

    await vault.connect(user).deposit({ value: DEPOSIT_AMOUNT });
    await proxy.connect(admin).upgradeTo(vaultV2.target);

    const upgradedVault = await ethers.getContractAt("VaultV2", proxy.target);

    return { admin, owner, user, otherUser, vaultV2, proxy, upgradedVault };
};
