// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract ArenaTestBEMis ERC20 {
    mapping(address=>bool) public claimed;
    constructor() ERC20("Arena Test BEM (no value)","tBEM") {require(block.chainid==97||block.chainid==31337,"TESTNET_ONLY");}
    function decimals() public pure override returns(uint8){return 8;}
    function claim() external {require(!claimed[msg.sender],"ALREADY_CLAIMED");claimed[msg.sender]=true;_mint(msg.sender,100*10**8);}
}
