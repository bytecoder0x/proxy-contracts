import { ethers } from "hardhat";

export const deployProxy = async () => {
    const [admin, owner, user, otherUser] = await ethers.getSigners();

    const VaultV1Factory = await ethers.getContractFactory("VaultV1");
    const vaultV1 = await VaultV1Factory.deploy();
    await vaultV1.waitForDeployment();

    const newVaultV1 = await VaultV1Factory.deploy();
    await newVaultV1.waitForDeployment();

    const ProxyFactory = await ethers.getContractFactory("Proxy");
    const proxy = await ProxyFactory.deploy(vaultV1.target, admin.address);
    await proxy.waitForDeployment();

    const vault = await ethers.getContractAt("VaultV1", proxy.target);
    await vault.initialize(owner.address);

    return { admin, owner, user, otherUser, vaultV1, newVaultV1, proxy, vault };
};
