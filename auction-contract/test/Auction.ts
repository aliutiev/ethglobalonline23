import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";


require('dotenv').config();


describe("Auction", function () {
  async function deployAuctionFixture() {
    const BIDDING_TIME = 60 * 60;  // 1 hour in seconds

    // Contracts are deployed using the first signer/account by default
    const [auctioneer, bidder1, bidder2] = await ethers.getSigners();

    const Auction = await ethers.getContractFactory("Auction");
    const auction = await Auction.deploy(BIDDING_TIME);

    return { auction, BIDDING_TIME, auctioneer, bidder1, bidder2 };
  }
  

  describe("Deployment", function () {
    it("Should set the right auctionEndTime", async function () {
      const { auction, BIDDING_TIME } = await loadFixture(deployAuctionFixture);

      expect(await auction.auctionEndTime()).to.be.closeTo(
        ethers.BigNumber.from((await ethers.provider.getBlock('latest')).timestamp + BIDDING_TIME), 
        5  // Adjust for potential delay
      );
    });

    it("Should set the auctioneer", async function () {
      const { auction, auctioneer } = await loadFixture(deployAuctionFixture);
      expect(await auction.auctioneer()).to.equal(auctioneer.address);
    });
  });

  describe("Bidding", function () {
    it("Should allow valid bids and update highestBid and highestBidder", async function () {
      const { auction, bidder1 } = await loadFixture(deployAuctionFixture);

      const bidAmount = ethers.utils.parseEther("1");

      await auction.connect(bidder1).placeBid({ value: bidAmount });

      expect(await auction.highestBid()).to.equal(bidAmount);
      expect(await auction.highestBidder()).to.equal(bidder1.address);
    });

    it("Should revert if bid is lower than the highest bid", async function () {
      const { auction, bidder1, bidder2 } = await loadFixture(deployAuctionFixture);

      const bidAmount1 = ethers.utils.parseEther("1");
      const bidAmount2 = ethers.utils.parseEther("0.5");

      await auction.connect(bidder1).placeBid({ value: bidAmount1 });
      await expect(auction.connect(bidder2).placeBid({ value: bidAmount2 })).to.be.revertedWith("There is already a higher bid.");
    });
  });

  describe("End Auction", function () {
    it("Should transfer the highest bid to the auctioneer and charity", async function () {
      const { auction, BIDDING_TIME, auctioneer, bidder1 } = await loadFixture(deployAuctionFixture);

      const bidAmount = ethers.utils.parseEther("1");
      const charityAmount = bidAmount.div(100);  // 1% for charity
      const auctioneerAmount = bidAmount.sub(charityAmount);

      await auction.connect(bidder1).placeBid({ value: bidAmount });

      // Simulate time passing to end the auction
      await ethers.provider.send("evm_increaseTime", [BIDDING_TIME]);

      await auction.endAuction();

    });
  });

  // ... Additional tests for other functionalities like withdrawals etc.
});
describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;

    const lockedAmount = ONE_GWEI;
    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const Lock = await ethers.getContractFactory("Lock");
    const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

    return { lock, unlockTime, lockedAmount, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.unlockTime()).to.equal(unlockTime);
    });

    it("Should set the right owner", async function () {
      const { lock, owner } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.owner()).to.equal(owner.address);
    });

    it("Should receive and store the funds to lock", async function () {
      const { lock, lockedAmount } = await loadFixture(
        deployOneYearLockFixture
      );

      expect(await ethers.provider.getBalance(lock.address)).to.equal(
        lockedAmount
      );
    });

    it("Should fail if the unlockTime is not in the future", async function () {
      // We don't use the fixture here because we want a different deployment
      const latestTime = await time.latest();
      const Lock = await ethers.getContractFactory("Lock");
      await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
        "Unlock time should be in the future"
      );
    });
  });

  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should revert with the right error if called too soon", async function () {
        const { lock } = await loadFixture(deployOneYearLockFixture);

        await expect(lock.withdraw()).to.be.revertedWith(
          "You can't withdraw yet"
        );
      });

      it("Should revert with the right error if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // We can increase the time in Hardhat Network
        await time.increaseTo(unlockTime);

        // We use lock.connect() to send a transaction from another account
        await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
          "You aren't the owner"
        );
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        );

        // Transactions are sent using the first signer by default
        await time.increaseTo(unlockTime);

        await expect(lock.withdraw()).not.to.be.reverted;
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { lock, unlockTime, lockedAmount } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
      });
    });

    describe("Transfers", function () {
      it("Should transfer the funds to the owner", async function () {
        const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw()).to.changeEtherBalances(
          [owner, lock],
          [lockedAmount, -lockedAmount]
        );
      });
    });
  });
});
