import hre from "hardhat";

const PROXY_ADDRESS = "ProxyAddress";

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const [signer] = await hre.ethers.getSigners();

    const VaultV2Factory = await hre.ethers.getContractFactory("VaultV2", signer);
    const vaultV2 = await VaultV2Factory.deploy();

    await vaultV2.waitForDeployment();

    console.log("VaultV2 contract deployed to:", vaultV2.target);

    const proxy = await hre.ethers.getContractAt("Proxy", PROXY_ADDRESS, signer);
    const tx = await proxy.upgradeTo(vaultV2.target);
    await tx.wait();

    console.log("Proxy implementation:", await proxy.implementation());

    console.log("Waiting for block confirmations...");
    await delay(30000); // Wait for 30 seconds before verifying the contract

    await hre.run("verify:verify", {
        address: vaultV2.target,
        constructorArguments: [],
    });
}

main().then(res => res).catch(err => console.log(err));
