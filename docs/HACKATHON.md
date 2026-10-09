# EMBER · TapeOut Genesis Transistor Hackathon

[Play / DeWeb Demo](https://2-2-300.deweb.tapeoutexplorer.com/) · [GitHub](https://github.com/BensonXBX/ember-tapeout) · [中文介绍](../README.md) · [English overview](README.en.md) · [Official campaign](https://ignix.bot/x_campaign)

## Project description / 项目介绍

**EMBER is a pixel fighting game combining an X Layer DeWeb frontend, visible local circuit AI, real-time multiplayer and optional mainnet escrow.** Players choose between two fighters, progress through twelve circuit challenges, practise hit-confirmed combo routes against a configurable dummy, or challenge a friend from a public room lobby. Free play requires no wallet. Escrow rooms support equal OKB or BEM deposits, player-confirmed wallet transactions and contract-based reward/refund claims.

The project's contribution is a playable application around TapeOut's container and circuit concepts. Its circuit panel visualizes signals from NAND networks actually evaluated by the local AI, while its DeWeb build uses compressed, content-addressed assets and an entry-last update process to reuse unchanged resources. Desktop keyboard controls, mobile landscape controls and a portrait handheld layout make the same game accessible across screen orientations. Home-screen installation, mobile wallet handoff and a separate login-signature flow help players move between the game and their wallet.

This repository contains the current frontend, multiplayer server, Solidity escrow source, exact compiler input, tests, gameplay screenshots, controls and a ready-to-upload DeWeb package. The on-chain processor and circuit evidence are disclosed below. Multiplayer is server-authoritative; the full combat simulation and AI do not run on-chain. The original AI remains available for comparison and rollback.

**《余烬》将 X Layer 的 DeWeb 网页、本地可视化电路 AI、实时联机和可选主网押金结合成一款像素格斗游戏。** 玩家可选择两名角色，挑战十二个电路关卡，在可配置木桩上练习实际命中的连段，或从公开大厅邀请朋友对战。免费玩法无需钱包；押金房支持等额 OKB / BEM，通过玩家确认的钱包交易和托管合约完成付款、奖励及退款领取。

项目的应用创新在于把 TapeOut 的容器与电路概念做成可直接体验的游戏：AI 面板显示当前实际执行的 NAND 网络信号；DeWeb 打包使用压缩、内容哈希资源与首页最后更新，减少重复上传。电脑键盘、手机横屏街机操作和竖屏掌机布局共用同一游戏；网页 App 安装、手机钱包跳转以及独立登录签名步骤帮助用户完成进入游戏的流程。

仓库公开当前前端、联机服务端、Solidity 合约、完整编译输入、测试、截图、操作指南与 DeWeb 上传包。处理器和流片证据如下。联机由服务器裁判，完整战斗与 AI 并非链上逐帧运行；原 AI 保留以便比较和回退。

## Public submission links / 公开评审入口

| Item / 项目 | Link / 内容 |
| --- | --- |
| Project name / 项目名 | EMBER · 余烬 — DeWeb Pixel Fighting on X Layer |
| Product demo / 产品 Demo | [X Layer DeWeb game](https://2-2-300.deweb.tapeoutexplorer.com/) |
| Hosted fallback / 备用入口 | [TapeOutScan game](https://tapeoutexplorer.com/games/ember/) |
| Public repository / 公开仓库 | [BensonXBX/ember-tapeout](https://github.com/BensonXBX/ember-tapeout) |
| Gameplay screenshots / 游戏画面 | [Overview gallery](../README.md#游戏画面) |
| Controls / 操作说明 | [Keyboard and mobile guide](CONTROLS.md) |
| Public launch introduction / 上线介绍 | [Bilingual announcement](ANNOUNCEMENT.md) |
| Creator / 作者 | [@benson_doge](https://x.com/benson_doge) |
| Escrow source / 押金合约源码 | [EmberEscrow.sol](../contracts/EmberEscrow.sol) |

The GitHub submission now includes the launch introduction and live demo link directly, so reviewers do not need a separate social-media post to understand or try the project. This does not replace any mandatory form field imposed by the organizers. No specific X post URL is asserted here because one has not been supplied for verification.

GitHub 内已完整补上上线介绍与实际游戏地址，评审无需先找到推文即可了解和体验项目；这不替代主办方要求填写的必填表单字段。当前没有附未经核对的具体推文链接。

## Deployment disclosure / 部署披露

The following historical chain evidence was observed on **2026-10-09 10:37:39 UTC+8**. Addresses identify different contracts; do not substitute one for another. [Machine-readable evidence](chain-evidence.json)

以下历史链上证据核验于 **2026-10-09 10:37:39（UTC+8）**。各地址对应不同对象，请勿混用。

| Field / 字段 | Value / 值 |
| --- | --- |
| Network / 网络 | X Layer mainnet · chain ID 196 |
| TapeOut processor / 处理器 | **#300** · [`0x9b826bd2984c2a041ee3b8f7168f2620fc5d3281`](https://www.oklink.com/x-layer/address/0x9b826bd2984c2a041ee3b8f7168f2620fc5d3281) |
| Transistor contract / 晶体管 | [`0x43ed51dc5bf22ea18ef002be474b94152fe66f0b`](https://www.oklink.com/x-layer/address/0x43ed51dc5bf22ea18ef002be474b94152fe66f0b) |
| TapeOut factory / 工厂 | [`0x1f09daefa827f02cbb40967cc91b259763760761`](https://www.oklink.com/x-layer/address/0x1f09daefa827f02cbb40967cc91b259763760761) |
| Deployment wallet / 部署钱包 | [`0xf2d7422470a7f1c6f37ac9285a54f4254c9b7a7e`](https://www.oklink.com/x-layer/address/0xf2d7422470a7f1c6f37ac9285a54f4254c9b7a7e) |
| Transistor supply cap at deployment / 部署时晶体管供应上限 | **1,000,000** |
| Unit mint price at deployment / 部署时单价 | **0.00066 OKB** = 660,000,000,000,000 wei |
| Processor deployment / 处理器部署 | [Transaction](https://www.oklink.com/x-layer/tx/0x3098e008479e19c1b8036fb2d259a4c8a3c970517a744da63c0b4fa2e30cda50) · block 72,611,527 · 2026-10-07 21:42:43 UTC+8 |
| Taped-out circuit / 已流片电路 | **Circuit #2**, three gates / 三门 · `2.2.300.tape` |
| Tapeout transaction / 流片交易 | [Transaction](https://www.oklink.com/x-layer/tx/0xf75fe9fe249a0152efa1ee342296d56249b03d962d18e8916b4f6ea415388632) · block 72,611,867 · 2026-10-07 21:48:23 UTC+8 |
| DeWeb container / 网页容器 | [`0x7e4d62673bb9894c5c62dd26495a0c0903a5a7e1`](https://www.oklink.com/x-layer/address/0x7e4d62673bb9894c5c62dd26495a0c0903a5a7e1) |
| Current published website / 已发布网页 | [2-2-300.deweb.tapeoutexplorer.com](https://2-2-300.deweb.tapeoutexplorer.com/) |

The supply figure is a cap, not a claim that all transistors have been minted. Processor issuance and game deposits are separate mechanisms. The three-gate on-chain circuit proves an existing tapeout; it is **not** the complete game-AI netlist. See [architecture](ARCHITECTURE.md) for execution boundaries and [X Layer](X-LAYER.md) for the separate game escrow.

供应数字为上限，不代表全部已铸造。处理器发行与游戏押金互相独立；三门链上电路用于披露已存在的流片，并非完整游戏 AI 网表。执行范围见 [架构说明](ARCHITECTURE.md)，独立的游戏押金合约见 [X Layer 说明](X-LAYER.md)。

## Review path / 建议评审顺序

1. Open the DeWeb demo and play one circuit challenge without a wallet. / 无需钱包，先打开 Demo 挑战一关。
2. Inspect the circuit panel and practise a combo in Training. / 观察电路面板，在训练场完成一套连段。
3. Open a free room in two browser sessions to try live selection and multiplayer. / 两个浏览器窗口体验免费建房、实时选角与对战。
4. Read the escrow source and local EVM tests before considering an optional deposit match. / 如需体验押金玩法，先查看合约及本地 EVM 测试。
5. Review processor deployment, issuance parameters and tapeout transactions above. / 核对上方处理器、发行参数及流片交易。

Final eligibility is determined by the organizers under the [official rules](https://ignix.bot/x_campaign). Source publication is not an independent security audit or a promise of rewards.

最终参赛资格以主办方按照 [正式规则](https://ignix.bot/x_campaign) 审核为准；源码公开不代表独立安全审计或奖励承诺。
