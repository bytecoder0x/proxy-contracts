import hre from "hardhat";

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const [signer] = await hre.ethers.getSigners();

    const adminAddress = signer.address;
    const ownerAddress = signer.address;

    const VaultV1Factory = await hre.ethers.getContractFactory("VaultV1", signer);
    const vaultV1 = await VaultV1Factory.deploy();

    await vaultV1.waitForDeployment();

    console.log("VaultV1 contract deployed to:", vaultV1.target);

    const initData = vaultV1.interface.encodeFunctionData("initialize", [ownerAddress]);

    const ProxyFactory = await hre.ethers.getContractFactory("Proxy", signer);
    const proxy = await ProxyFactory.deploy(vaultV1.target, adminAddress, initData);

    await proxy.waitForDeployment();

    console.log("Proxy contract deployed to:", proxy.target);

    console.log("Waiting for block confirmations...");
    await delay(30000); // Wait for 30 seconds before verifying the contracts

    await hre.run("verify:verify", {
        address: vaultV1.target,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: proxy.target,
        constructorArguments: [vaultV1.target, adminAddress, initData],
    });
}

main().then(res => res).catch(err => console.log(err));
