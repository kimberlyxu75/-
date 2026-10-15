# 发布「已老实记账」

## GitHub 源码

从 `github-release/` 的白名单源码候选目录创建仓库，不要直接上传当前开发目录。该目录由 `python3 scripts/package-public.py` 生成，排除云配置、后台截图、本机路径、历史压缩包和 Codex 工作文件。

## GitHub Pages

源码候选目录附带两个工作流：

- `checks.yml`：推送或 Pull Request 时构建并运行测试。
- `pages.yml`：仅手动触发，测试通过后将 `dist/` 发布到 GitHub Pages。

在仓库 Settings → Pages 中选择 GitHub Actions 作为发布来源，再从 Actions 手动运行 Deploy Pages。实际发布需要仓库权限；提交工作流本身不会发布网站。

页面资源和 PWA scope 使用相对路径，适配仓库子路径。首次发布后要在实际 HTTPS 地址验证安装、刷新、离线与备份恢复。

## 其他静态托管

运行 `npm run package` 后只上传 `dist/` 中的文件。使用 HTTPS，并为 `index.html` 与 `sw.js` 设置及时重新验证缓存的策略。不要覆盖或清除用户浏览器存储。

## 更新

修改静态资源时，同步更新 HTML 查询版本与 `sw.js` 的资源列表和缓存版本，然后重新打包。当前资源版本 v39。

升级前备份旧账本；使用测试账本验证旧版本升级、新标签页并发编辑、断网写入与重新联网。不要宣称未验证的浏览器或平台已受支持。
