// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "hardhat/console.sol";

contract TokenMarket {

    // reference to our TokenController contract
    IERC1155 private tokenController;

    uint256 private orderId;

    struct Order {
        uint256 orderId;
        uint256 tokenId;
        uint256 quantity;
        uint256 limitPrice;
        address orderOwner;
    }

    // array of all sellOrders
    Order[] private sellOrders;

    constructor(address _tokenControllerAddress) {
        orderId = 0;        
        // create a reference to TokenController contract
        tokenController = IERC1155(address(_tokenControllerAddress));
    }

    function postSellOrder(uint256 _tokenId, uint256 _quantity, uint256 _limitPrice) public {
        
        // transfer the tokens to this contract from the caller
        tokenController.safeTransferFrom(msg.sender, address(this), _tokenId, _quantity, "0x00");

        // store the sell order
        sellOrders.push(Order(orderId, _tokenId, _quantity, _limitPrice, msg.sender));

        // increment orderId
        orderId += 1;
    }

    // todo: implement cancel order
    // function cancelSellOrder(uint256 _tokenId) public {}

    function getOrderBook() public view returns (Order[] memory) {
        return sellOrders;
    }

    function postBuyOrder(uint256 _orderId, uint256 _quantity) public payable {

        // cacluate the total price
        uint256 totalPrice = sellOrders[_orderId].limitPrice * _quantity;        

        // validate payment is correct
        require(msg.value >= totalPrice, "Payment is less than price");
        // validate quantity is available
        require(_quantity <= sellOrders[_orderId].quantity, "Quantity is greater than available quantity");

        // transfer the payment to the seller
        payable(sellOrders[_orderId].orderOwner).transfer(msg.value);

        // transfer the tokens to the buyer
        tokenController.safeTransferFrom(address(this), msg.sender, sellOrders[_orderId].tokenId, _quantity, "0x00");

        // update the remaining sellOrder
        sellOrders[_orderId].quantity -= _quantity;
    }

    // this function is required to implement the ERC1155Receiver contract interface
    function onERC1155Received(
        address, // operator,
        address, // from,
        uint256, // id,
        uint256, // value,
        bytes calldata //  data
    ) external pure returns (bytes4) {
        // return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
        return this.onERC1155Received.selector;
    }
}

