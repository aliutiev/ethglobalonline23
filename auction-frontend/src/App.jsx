import { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css";
import ContractABI from "./ContractABI.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [auctionContract, setAuctionContract] = useState(null);
  const [bidValue, setBidValue] = useState(0);
  const [latestBid, setLatestBid] = useState(null);
  const [newBidReceived, setNewBidReceived] = useState(false);

  const contractAddress = "0xef9A693cc523B56F0759B89C0bd25A4db991C5Da";
  const contractABI = ContractABI.abi;

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        const providerInstance = new ethers.providers.Web3Provider(
          window.ethereum
        );
        const signerInstance = providerInstance.getSigner();
        console.log("i'm signed in");

        const auctionContractInstance = new ethers.Contract(
          contractAddress,
          contractABI,
          signerInstance
        );

        setProvider(providerInstance);
        setSigner(signerInstance);
        setAuctionContract(auctionContractInstance);
      } else {
        alert("Please install MetaMask!");
      }
    };

    init();
  }, []);

  // place a bid
  const placeBid = async () => {
    try {
      if (!auctionContract) return;

      const weiValue = ethers.utils.parseEther(bidValue.toString());
      const tx = await auctionContract.placeBid({ value: weiValue });

      // Wait for the transaction to be confirmed
      await tx.wait();
      alert("Bid placed successfully!");
    } catch (error) {
      console.error("Error placing bid:", error);
    }
  };
  useEffect(() => {
    if (!auctionContract) return;

    const onBidPlaced = (bidder, amount) => {
      setLatestBid({ bidder, amount: ethers.utils.formatEther(amount) });
      setNewBidReceived(true);
    };

    // Listen for the BidPlaced event from the smart contract
    auctionContract.on("BidPlaced", onBidPlaced);

    // Cleanup the event listener when the component unmounts
    return () => auctionContract.off("BidPlaced", onBidPlaced);
  }, [auctionContract]);


  return (
    <>
      <div></div>
      <h1>WATERLOO AUCTION DAPP</h1>
      <div className="card">
        {newBidReceived && (
          <div className="notification">
            New bid received! Bidder: {latestBid.bidder} Amount:{" "}
            {latestBid.amount} ETH
            <button onClick={() => setNewBidReceived(false)}>Close</button>
          </div>
        )}
        <input
          type="text"
          placeholder="Bid amount in ETH"
          value={bidValue}
          onChange={(e) => setBidValue(e.target.value)}
        />
        <button onClick={placeBid}>Place Bid</button>
        {/* <button onClick={endTheAuction}>End Auction</button> */}
      </div>
      <button className="read-the-docs">Accept the end of Auction</button>
    </>
  );
}

export default App;
