# X Layer · 钱包与合约 / Wallets and contracts

[游戏 / Game](https://2-2-300.deweb.tapeoutexplorer.com/) · [中文首页](../README.md) · [English overview](README.en.md)

## 主网对象 / Mainnet objects

| 项目 / Item | 地址或参数 / Address or setting |
| --- | --- |
| 网络 / Network | X Layer mainnet · chain ID **196 / 0xc4** |
| 原生币与 Gas / Native asset and gas | **OKB** |
| 游戏押金合约 / Game escrow | [`0xB3C977f6ec80429f619eC0Eac315D540Ed8919e2`](https://www.oklink.com/x-layer/address/0xB3C977f6ec80429f619eC0Eac315D540Ed8919e2) |
| 支持的 BEM / Supported BEM | [`0x60e62efa9405d6873c5deabd4e6cc91c25363952`](https://www.oklink.com/x-layer/address/0x60e62efa9405d6873c5deabd4e6cc91c25363952) · 8 decimals |
| DeWeb 容器 / Container | `2.2.300.tape` · [`0x7e4d62673bb9894c5c62dd26495a0c0903a5a7e1`](https://www.oklink.com/x-layer/address/0x7e4d62673bb9894c5c62dd26495a0c0903a5a7e1) |
| 正常胜负平台费 / Fee on decisive matches | 奖池的 / of the pool **10%** |
| 奖励等待 / Claim delay | 赛后 / after match **60 seconds**，且完成结算与链上核验 / subject to settlement and chain verification |
| 付款期限 / Funding window | **180 seconds** |

此表反映本次公开版本及最近已核验的部署信息，游戏实际入口仍会查询当前配置。处理器与晶体管地址见 [黑客松披露](HACKATHON.md)，不要把它们当成押金合约。BEM 是 TapeOut 生态代币，并非《余烬》发行的游戏代币；仅用作可选押金资产。

These entries describe this release and the most recently verified deployment; the game checks its current runtime configuration. Processor and transistor addresses are in the [hackathon disclosure](HACKATHON.md); they are not the escrow. BEM is a TapeOut ecosystem token, not a token issued by EMBER, and is supported only as an optional deposit asset.

## 从免费到押金对战 / From free to escrow play

1. **免费无需钱包。** 浏览电路挑战、训练和免费大厅时，不要求连接。
   **Free play needs no wallet.** Challenges, training and the free lobby are accessible directly.
2. **连接并登录。** 电脑使用钱包扩展；手机浏览器／主屏幕 App 可打开 OKX，确认连接后完成登录签名，再返回原游戏。有效登录会话会尝试恢复；过期、断开或账户变化时可能重新要求登录。
   **Connect and sign in.** Use an extension on desktop, or open OKX from a mobile browser/home-screen app. Confirm connection, complete the login signature and return to the original game. Valid sessions are restored when possible; expiry, disconnection or account changes can require another login.
3. **选择资产和每人押金。** OKB 使用原生币付款；BEM 需要时先确认代币额度授权，再确认押金。登录签名、额度授权、押金交易是不同请求，不能用一个含糊的“授权”代替。
   **Choose the asset and per-player amount.** OKB is paid natively; BEM may require a token allowance before the deposit. Login signatures, allowances and payments are separate requests.
4. **等待双方付款与选角。** 已付款时不应再次支付同一笔；保持房间，由状态恢复核对原交易。双方满足入场条件后显示双方角色选择，倒计时进入战斗。
   **Wait for both deposits, then select.** Do not pay the same deposit twice. Let transaction recovery reconcile the existing payment. Once entry conditions are met, both selections appear before combat.
5. **奖励和退款。** 赛后等待合约规定时间及结算；已到期未提取的项目留在历史列表。未完成双方付款的房间按合约超时条件退款；符合条件后仍需主动领取并确认钱包交易。
   **Rewards and refunds.** Wait for the contract delay and settlement. Unclaimed items remain in history. Incompletely funded rooms follow contract expiry rules; eligible refunds still require a claim and wallet confirmation.

若钱包未打开，先回到原游戏，使用当前弹窗的打开钱包／继续按钮。拒绝签名后需要重新明确发起；不要把登录签名误认为付款。网络核验失败时保留原交易哈希，通过原记录恢复，避免重复付款。

If the wallet does not open, return to the original game and use the current dialog's Open wallet / Continue button. A rejected signature needs a fresh explicit request; a login signature is not a payment. Retain the original transaction hash when network checks fail and recover that transaction rather than paying again.

## 公开源码与验证材料 / Public source and verification materials

- [EmberEscrow.sol](../contracts/EmberEscrow.sol)
- [完整 Solidity Standard JSON Input / Full compiler input](../contracts/standard-input.json)
- [编译产物与 ABI / Artifact and ABI](../contracts/artifact.json)
- [编译脚本 / Compiler script](../build-tools/compile-escrow.mjs)
- [托管合约本地 EVM 测试 / Local EVM tests](../tests/escrow.test.mjs)

编译器为 Solidity **0.8.30**；完整输入包含依赖及 optimizer、viaIR、EVM 配置，可据原部署交易核对构造参数。公开源码与可复编译材料不代表已经通过区块浏览器验证，也不代表独立安全审计。

Solidity **0.8.30** is used. The complete input includes dependencies, optimizer, viaIR and EVM settings. Constructor arguments must be checked against the original deployment transaction. Published source and reproducible compiler input do not by themselves establish explorer verification or an independent audit.

游戏采用服务端裁判签名结算，链上合约校验授权与资金规则，并非无信任地在链上重算整场战斗。生产裁判密钥、管理凭据、玩家数据库和财务配置不在仓库中。

The game uses signed server-referee results; the contract checks authorization and funds rules rather than trustlessly replaying every fight on-chain. Production referee keys, administrator credentials, player databases and finance configuration are not included.
