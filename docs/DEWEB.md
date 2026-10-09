# DeWeb packaging / DeWeb 打包

```sh
python3 build-tools/package-deweb.py
```

The output `deweb-upload/` is frontend-only. Its resources have stable content hashes, compressed modules and SHA-256 integrity metadata. The small `index.html` selects a version. Upload resources first, read them back and replace the entry last. Keep old resources for rollback.

生成目录只包含公开前端。`DEWEB_MANIFEST.json` 和 `DEWEB_UPDATE_PLAN.json` 是本地核验资料，不必上传。提供上一版清单可识别资源复用：

```sh
python3 build-tools/package-deweb.py --previous-manifest /path/to/old/DEWEB_MANIFEST.json
```

The latest prepared circuit-AI bundle was approximately 1.07 MiB across 54 files; exact totals are printed by the build. Actual chain gas depends on existing reusable resources, container configuration and the network. No fixed gas estimate is promised.

当前准备版本约 1.07 MiB、54 个文件，以实际构建输出为准。链上网页字节公开且历史不能删除，因此不要上传服务端、数据库、密钥、个人素材或整个仓库。

The bundle currently points multiplayer/authentication requests at `https://tapeoutexplorer.com/games/ember/`. The backend must be reachable. Managed DeWeb gateway origins are checked in `server/network-policy.mjs`; other HTTPS origins need explicit backend configuration. Local circuits and training execute client-side, but this is not an offline-cached PWA or a fully on-chain multiplayer server.

前端上传 DeWeb 不会把实时联机服务一起上链。正式展示前，应从外部网络核对入口、资源、大厅 API、WSS 和钱包返回流程。本次整理仓库时，游戏源站可读取，但独立公网访问检查未通过；该限制尚未修复，不能当作已验收的公开 Demo。

No automatic deployment, mint, tapeout, container opening or paid upload is included in these build commands. Those operations require the holder's wallet confirmation.
