import { ethers } from "hardhat";

export const deployProxy = async () => {
    const [admin, owner, user] = await ethers.getSigners();

    const VaultV1Factory = await ethers.getContractFactory("VaultV1");
    const vaultV1 = await VaultV1Factory.deploy(owner.address);
    await vaultV1.waitForDeployment();

    const ProxyFactory = await ethers.getContractFactory("Proxy");
    const proxy = await ProxyFactory.deploy(vaultV1.target, admin.address);
    await proxy.waitForDeployment();

    const vault = await ethers.getContractAt("VaultV1", proxy.target);

    return { user, vaultV1, proxy, vault };
};
