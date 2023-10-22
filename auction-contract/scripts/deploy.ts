import { ethers } from "hardhat";

async function main() {
  const Auction = await ethers.getContractFactory("Auction");
  const auction_time = 3600;
  const auction = await Auction.deploy(auction_time); // Deploying the Auction contract with a bidding time of 1 hour
  await auction.deployed();
  console.log(`Auction contract deployed to: ${auction.address} with unlocktime of ${auction_time/60} minutes`);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });





