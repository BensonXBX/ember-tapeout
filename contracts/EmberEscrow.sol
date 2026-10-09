// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Ownable,Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20,IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
/// Server-authoritative game escrow. No automatic transaction signer or report flow.
/// Every player's entitlement is tracked per match, including after withdrawal.
contract EmberEscrow is Ownable2Step,ReentrancyGuard,EIP712 {
 using SafeERC20 for IERC20;
 address public immutable referee;
 IERC20 public immutable bem;
 uint256 public constant version=1;
 uint256 public constant feeBps=1000;
 uint256 public constant claimDelay=60;
 bool public paused;
 mapping(uint8=>uint256) public liability;
 bytes32 private constant TICKET=keccak256("Ticket(bytes32 id,address a,address b,uint8 asset,uint256 stake,uint256 fundUntil,bytes32 rulesHash)");
 bytes32 private constant RESULT=keccak256("Result(bytes32 id,uint8 winner,uint256 endedAt,bytes32 evidence)");
 bytes32 private constant CANCEL=keccak256("Cancel(bytes32 id)");
 struct Ticket {bytes32 id;address a;address b;uint8 asset;uint256 stake;uint256 fundUntil;bytes32 rulesHash;}
 struct Result {bytes32 id;uint8 winner;uint256 endedAt;bytes32 evidence;}
 // state: 0 absent, 1 funding, 2 funded, 3 settled, 4 refunded/cancelled.
 struct Match {address[2] players;uint8 asset;uint8 state;uint256 stake;uint256 fundUntil;uint256 fundedAt;bytes32 terms;bool[2] paid;uint256[2] payout;bool[2] withdrawn;}
 mapping(bytes32=>Match) private matches;
 event Funded(bytes32 indexed id,address indexed player,uint8 asset,uint256 amount);
 event Settled(bytes32 indexed id,uint8 winner,uint256[2] payouts,uint256 fee);
 event Refunded(bytes32 indexed id,uint256[2] payouts);
 event Withdrawn(bytes32 indexed id,address indexed player,uint8 asset,uint256 amount);
 event PlatformWithdrawn(uint8 indexed asset,address indexed to,uint256 amount);
 constructor(address referee_,address owner_,address token_) Ownable(owner_) EIP712("TapeOutEmber","1") {
  require(block.chainid==196||block.chainid==31337,"CHAIN");
  require(referee_!=address(0)&&token_.code.length>0&&IERC20Metadata(token_).decimals()==8,"CONFIG");
  if(block.chainid==196)require(token_==address(bytes20(hex"60e62efa9405d6873c5deabd4e6cc91c25363952")),"TOKEN");
  referee=referee_;bem=IERC20(token_);
 }
 receive() external payable {}
 function getMatch(bytes32 id) external view returns(Match memory){return matches[id];}
 function getMatches(bytes32[] calldata ids) external view returns(Match[] memory values){require(ids.length<=20,"BATCH");values=new Match[](ids.length);for(uint256 i;i<ids.length;i++)values[i]=matches[ids[i]];}
 function setPaused(bool value) external onlyOwner {paused=value;}
 function renounceOwnership() public override onlyOwner {revert("TWO_STEP_ONLY");}
 function verify(bytes32 h,bytes calldata sig) private view {require(ECDSA.recover(_hashTypedDataV4(h),sig)==referee,"SIGNATURE");}
 function seat(Match storage m) private view returns(uint8){if(msg.sender==m.players[0])return 0;if(msg.sender==m.players[1])return 1;revert("PARTICIPANT");}
 function fund(Ticket calldata t,bytes calldata sig) external payable nonReentrant {
  require(!paused&&t.id!=bytes32(0)&&t.rulesHash!=bytes32(0)&&t.a!=address(0)&&t.b!=address(0)&&t.a!=t.b&&t.asset<2&&t.stake>0&&t.stake%10000==0&&t.stake<=(t.asset==0?10 ether:100000*10**8),"TERMS");
  require(block.timestamp<t.fundUntil&&t.fundUntil<=block.timestamp+180,"DEADLINE");
  bytes32 h=keccak256(abi.encode(TICKET,t.id,t.a,t.b,t.asset,t.stake,t.fundUntil,t.rulesHash));verify(h,sig);
  Match storage m=matches[t.id];if(m.state==0){m.players=[t.a,t.b];m.asset=t.asset;m.stake=t.stake;m.fundUntil=t.fundUntil;m.terms=h;m.state=1;}
  require(m.state==1&&m.terms==h,"STATE");uint8 s=seat(m);require(!m.paid[s],"ALREADY_PAID");m.paid[s]=true;
  if(t.asset==0)require(msg.value==t.stake,"VALUE");else{require(msg.value==0,"VALUE");uint256 held=bem.balanceOf(address(this));bem.safeTransferFrom(msg.sender,address(this),t.stake);require(bem.balanceOf(address(this))-held==t.stake,"EXACT_TOKEN");}
  liability[t.asset]+=t.stake;if(m.paid[0]&&m.paid[1]){m.state=2;m.fundedAt=block.timestamp;}
  emit Funded(t.id,msg.sender,t.asset,t.stake);
 }
 function settle(Result calldata r,bytes calldata sig) private {
  Match storage m=matches[r.id];if(m.state==3||m.state==4)return;
  require(m.state==2&&r.winner<=2&&r.evidence!=bytes32(0)&&r.endedAt>=m.fundedAt&&r.endedAt<m.fundedAt+1 days&&block.timestamp>=r.endedAt+claimDelay,"RESULT");
  verify(keccak256(abi.encode(RESULT,r.id,r.winner,r.endedAt,r.evidence)),sig);
  uint256 fee;if(r.winner==2)m.payout=[m.stake,m.stake];else{fee=m.stake*2*feeBps/10000;m.payout[r.winner]=m.stake*2-fee;liability[m.asset]-=fee;}
  m.state=3;emit Settled(r.id,r.winner,m.payout,fee);
 }
 function claim(Result calldata r,bytes calldata sig) external nonReentrant {seat(matches[r.id]);settle(r,sig);withdraw(r.id);}
 function claimMany(Result[] calldata results,bytes[] calldata sigs) external nonReentrant {
  require(results.length>0&&results.length<=20&&results.length==sigs.length,"BATCH");
  for(uint256 i;i<results.length;i++){seat(matches[results[i].id]);settle(results[i],sigs[i]);withdraw(results[i].id);}
 }
 function collect(Result[] calldata results,bool[] calldata refunds,bytes[] calldata sigs) external nonReentrant {
  require(results.length>0&&results.length<=20&&results.length==sigs.length&&results.length==refunds.length,"BATCH");
  for(uint256 i;i<results.length;i++){
   bytes32 id=results[i].id;Match storage m=matches[id];seat(m);
   if(refunds[i]){if(m.state<3){verify(keccak256(abi.encode(CANCEL,id)),sigs[i]);refund(id);}}
   else settle(results[i],sigs[i]);withdraw(id);
  }
 }
 function cancel(bytes32 id,bytes calldata sig) external {verify(keccak256(abi.encode(CANCEL,id)),sig);refund(id);}
 // Fully funded games need the referee result/cancellation. An opponent must not
 // erase a winner's unclaimed award merely by waiting 24 hours.
 function refundExpired(bytes32 id) external {Match storage m=matches[id];require((m.state==1&&block.timestamp>=m.fundUntil),"DEADLINE");refund(id);}
 function refund(bytes32 id) private {Match storage m=matches[id];require(m.state<3,"STATE");m.state=4;for(uint8 i;i<2;i++)if(m.paid[i])m.payout[i]=m.stake;emit Refunded(id,m.payout);}
 function refundAndWithdraw(bytes32 id,bytes calldata sig) external nonReentrant {
  Match storage m=matches[id];seat(m);
  if(m.state<3){if(sig.length>0)verify(keccak256(abi.encode(CANCEL,id)),sig);else require((m.state==1&&block.timestamp>=m.fundUntil),"DEADLINE");refund(id);}
  withdraw(id);
 }
 function withdraw(bytes32 id) private {Match storage m=matches[id];uint8 s=seat(m);require(m.state==3||m.state==4,"STATE");if(m.withdrawn[s])return;m.withdrawn[s]=true;uint256 n=m.payout[s];if(n==0)return;liability[m.asset]-=n;send(m.asset,payable(msg.sender),n);emit Withdrawn(id,msg.sender,m.asset,n);}
 function surplus(uint8 asset) public view returns(uint256){require(asset<2,"ASSET");return(asset==0?address(this).balance:bem.balanceOf(address(this)))-liability[asset];}
 function withdrawPlatform(uint8 asset,address payable to,uint256 amount) external onlyOwner nonReentrant {require(to!=address(0)&&to!=address(this)&&amount>0&&amount<=surplus(asset),"SURPLUS");send(asset,to,amount);emit PlatformWithdrawn(asset,to,amount);}
 function rescueToken(address token,address to,uint256 amount) external onlyOwner nonReentrant {require(token!=address(bem)&&to!=address(0)&&to!=address(this),"TOKEN");IERC20(token).safeTransfer(to,amount);}
 function send(uint8 asset,address payable to,uint256 n) private {if(asset==0){(bool ok,)=to.call{value:n}("");require(ok,"TRANSFER");}else{uint256 beforeBalance=bem.balanceOf(to);bem.safeTransfer(to,n);require(bem.balanceOf(to)-beforeBalance==n,"EXACT_TOKEN");}}
}
