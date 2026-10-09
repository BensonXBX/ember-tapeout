# Architecture / 架构

## Execution boundaries / 执行边界

1. `public/engine.mjs` advances deterministic combat state. Client controls, the original AI and the circuit AI ultimately produce the same button-mask interface.
2. `public/campaign.mjs` builds acyclic NAND networks and evaluates `1 - (a & b)` in order. Comparisons support non-negative 16-bit integers and finite IEEE-754 double values. Logic and 13-bit action selection are also circuits. Sensors, time, state updates and seeded randomness stay in the game layer.
3. The panel samples circuits actually evaluated by the current decision. It shows real gate signals; it does not issue blockchain calls for each frame.
4. `legacyCampaignInput` remains separately executable. The next-match setting preserves progress and keeps the current opponent stable.
5. Multiplayer uses an authoritative Node server, SQLite and WebSocket/HTTP input transport. Static DeWeb hosting does not replace that server.
6. Wallet authentication requests a login signature on X Layer. It is distinct from token allowance or deposit payment. New deposit room creation is disabled in this release.

游戏规则、物理与输入接口保持独立。电路 AI 真实执行本地 NAND 网表，但不是把完整游戏变成硬件，也不是链上每帧计算。面板只绘制实际执行过的小电路。原版 AI 可切换恢复；设置在下一局生效。

## Contracts / 合约

`contracts/EmberEscrow.sol` is a server-refereed escrow, not the TapeOut processor. The processor and transistor contracts are identified separately in `chain-evidence.json`. The on-chain circuit #2 is a three-gate circuit and is not the locally generated AI network.

The game escrow sources and simulated tests are included for review. New deposits remain disabled. Tests do not establish an external security audit. Runtime signing keys, administrator authentication keys and finance state are intentionally absent.

`EmberEscrow.sol` 是服务端裁判托管合约，不是处理器合约；三者在材料中必须区分。此仓库包含实现和模拟测试，不包含任何生产密钥或财务配置。

## Regression coverage / 回归范围

The campaign tests compare twelve stages, two characters and seeded sequences between the local circuit and original AI; they also check comparison boundaries and whether changing a circuit output changes the decision. These are regression checks, not a formal proof across every possible game state.

钱包测试涵盖请求恢复、取消与应用链接校验；模拟测试不能代替真实 iPhone 与 OKX App 的系统跳转验收。复现测试：`npm test`。
