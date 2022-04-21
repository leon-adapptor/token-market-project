const { expect } = require("chai");
const { ethers } = require("hardhat");
require("@nomiclabs/hardhat-waffle");

describe("TokenMarket", () => {
  const tokenId = 1;
  const quantity = 100;
  const data = "0x00";
  let tokenMarket, tokenController, ownerAddress, userAddress, owner, addr1;

  beforeEach(async () => {
    // get our users (signers)
    [owner, addr1] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    userAddress = await addr1.getAddress();

    // deploy TokenController contract
    const TokenController = await ethers.getContractFactory("TokenController");
    tokenController = await TokenController.deploy();
    await tokenController.deployed();

    // deploy TokenMarket contract
    const TokenMarket = await ethers.getContractFactory("TokenMarket");
    // pass in the address of the TokenController contract
    tokenMarket = await TokenMarket.deploy(tokenController.address);
    await tokenMarket.deployed();

    // give permissions to tokenMarket to operate the tokenController contract
    await tokenController.setApprovalForAll(tokenMarket.address, true);

    // mint 100 tokens with id 1
    await tokenController.mint(ownerAddress, tokenId, quantity, data);
  });

  it("should update orderbook", async () => {
    const sellQuantity = 1;
    const sellPrice = ethers.utils.parseEther("0.1");
    // post sellOrders
    await tokenMarket.postSellOrder(tokenId, sellQuantity, sellPrice);
    await tokenMarket.postSellOrder(tokenId, sellQuantity, sellPrice);
    await tokenMarket.postSellOrder(tokenId, sellQuantity, sellPrice);

    // get the current orderbook
    const orderBook = await tokenMarket.getOrderBook();

    // the orderbook should have 1 sellOrder
    expect(orderBook.length).to.equal(3);
  });

  it("should fail to update orderbook", async () => {
    const sellQuantity = 1;
    const sellPrice = ethers.utils.parseEther("0.1");

    // post a sellOrder for tokenId that we don't own
    const postBadSellOrder = async () =>
      await tokenMarket.postSellOrder(tokenId + 1, sellQuantity, sellPrice);

    // expect to throw an error as we dont have the tokens
    await expect(postBadSellOrder()).to.be.revertedWith(
      "ERC1155: insufficient balance for transfer"
    );
  });

  it("should transfer tokens to TokenMarket", async () => {
    const sellQuantity = 1;
    const sellPrice = ethers.utils.parseEther("0.1");
    // post a sellOrder
    await tokenMarket.postSellOrder(tokenId, sellQuantity, sellPrice);

    // balance of ownerAddress should be reduced by sellQuantity
    expect(await tokenController.balanceOf(ownerAddress, tokenId)).to.equal(
      quantity - sellQuantity
    );

    // balance of tokenMarket.address should be sellQuantity
    expect(
      await tokenController.balanceOf(tokenMarket.address, tokenId)
    ).to.equal(sellQuantity);
  });

  it("should transfer tokens to buyer and payment to seller", async () => {
    // get sellers ether account balance
    const sellerStartingBalance = ethers.utils.formatEther(
      await owner.getBalance()
    );

    const sellQuantity = 1;
    const sellPrice = ethers.utils.parseEther("0.1");
    // post a sellOrder
    await tokenMarket.postSellOrder(tokenId, sellQuantity, sellPrice);

    // include a payment with the call to postBuyOrder
    const options = { value: ethers.utils.parseEther("0.1") };

    // post buyOrder as addr1 user
    const orderId = 0;
    const buyQuantity = 1;
    await tokenMarket
      .connect(addr1)
      .postBuyOrder(orderId, buyQuantity, options);

    // get sellers ether account balance again
    const sellerEndingBalance = ethers.utils.formatEther(
      await owner.getBalance()
    );

    // calculate payment received, rounding to account for gas fees
    const paymentReceived =
      Math.round((sellerEndingBalance - sellerStartingBalance) * 100) / 100;

    // the seller should have received payment in ether
    expect(paymentReceived).to.equal(0.1);

    // the buyer should have received the correct amount of tokens
    expect(await tokenController.balanceOf(userAddress, tokenId)).to.equal(
      buyQuantity
    );
  });
});
