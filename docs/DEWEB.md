# DeWeb 打包与更新 / Packaging and updates

**当前游戏 / Published game:** [2-2-300.deweb.tapeoutexplorer.com](https://2-2-300.deweb.tapeoutexplorer.com/)
**容器 / Container:** X Layer · `2.2.300.tape`
**[下载上传包 / Download upload ZIP](../downloads/ember-deweb-1.3-scan.5.zip)** · [Manifest](../downloads/deweb-manifest-1.3-scan.5.json) · [SHA-256](../downloads/SHA256SUMS)

## 本次包 / This package

| Item | Value |
| --- | --- |
| Source release / 源码版本 | `1.3-scan.5` |
| Files / 文件 | 54 |
| Site payload / 站点文件总大小 | 1,129,497 bytes · about 1.08 MiB |
| Upload ZIP / 压缩包 | 1,124,227 bytes |
| Chunks at 24,000 bytes / 按 24,000 字节分块 | 90 |
| Entry / 首页 | `index.html` · 1,103 bytes · uploaded last / 最后上传 |
| Escrow frontend / 押金前端入口 | Enabled / 已开放；真实资金服务依赖后端配置 / live finance also requires backend configuration |

ZIP 的每个文件均与本仓库源码构建输出逐字节哈希对应。截图、说明文档、测试、服务器、合约编译输入均不放入 DeWeb 上传包。Gas 取决于链上已有资源和当前链状态，90 块不是每次更新都必须重新支付的数量。

Every file in the ZIP was matched by SHA-256 to this source build. Screenshots, documentation, tests, servers and compiler inputs are excluded from the upload. Gas depends on existing resources and chain conditions; the 90-chunk total is not a requirement to repay for every chunk on every update.

## 构建 / Build

```sh
python3 build-tools/package-deweb.py
# 对比上一版 / Compare with a previous version:
python3 build-tools/package-deweb.py --previous-manifest /path/to/old/DEWEB_MANIFEST.json
```

输出 `deweb-upload/` 为公开前端；`DEWEB_MANIFEST.json` 保存大小与 SHA-256；指定上一版后生成 `DEWEB_UPDATE_PLAN.json`，指出可以复用和需要更新的资源。这两个清单用于本地核验，不必作为网站文件上传。

`deweb-upload/` contains the public frontend. `DEWEB_MANIFEST.json` records sizes and SHA-256 hashes; supplying a previous manifest also produces `DEWEB_UPDATE_PLAN.json` with reused and changed resources. These manifests are local verification records, not required website assets.

资源文件名带内容哈希，模块压缩后由加载器解压并校验。首页仅指定要加载的版本：**先上传资源 → 完整回读核验 → 最后替换小首页**。保留旧版资源，回退时重新选择旧版入口。上传器的复用判断以链上实际内容为准。

Asset names contain content hashes; compressed modules are decompressed and verified by the loader. The small entry page selects the release: **upload resources → verify readback → replace the entry last**. Preserve old resources for rollback. Actual reuse must be checked against the container contents.

## 上传边界 / Publishing boundary

只上传 ZIP 内的前端文件或 `deweb-upload/` 目录内容，**不要上传整个 GitHub 仓库**。链上历史字节不可撤销，不能包含私钥、服务器配置、玩家数据或私有素材。X Layer 上传 Gas 使用 OKB，钱包确认由持有人自行完成。

Upload only the frontend ZIP contents or `deweb-upload/`, **not the whole GitHub repository**. Historical on-chain bytes cannot be revoked: do not include keys, server configuration, player data or private media. X Layer upload gas is paid in OKB, with the holder confirming wallet operations.

默认联机、登录和资金 API 指向 `https://tapeoutexplorer.com/games/ember/`。DeWeb 托管不会把服务端一起上链。服务端对跨域请求进行来源验证；自建域名需要同步配置允许来源及 HTTPS 预检路由，而不只是修改前端网址。

Multiplayer, login and finance APIs point to `https://tapeoutexplorer.com/games/ember/` by default. DeWeb hosting does not publish the backend. Cross-origin requests are checked by the server; a custom domain needs matching allowed-origin configuration and HTTPS preflight routing, not just a changed frontend URL.

本包没有离线 Service Worker 缓存承诺。浏览器／网关缓存不等于断网仍可联机；首次加载和更新仍取决于网关、节点与网络。构建命令不会自动部署合约、开容器或发起付费上传。

This package does not promise offline Service Worker caching. Browser/gateway caching does not enable offline multiplayer; first loads and updates still depend on gateways, nodes and connectivity. Build commands never deploy contracts, open containers or initiate paid uploads.
