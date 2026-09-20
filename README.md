# 彭文丽的个人主页

目标地址：https://pengwenli42.github.io/

GitHub Pages 免费托管，Pages CMS 网页管理。个人资料、成果和文章保存在本仓库，修改后由 GitHub Actions 自动生成并发布。无需自购域名或服务器。

## 网页维护

1. 打开 https://app.pagescms.org/ ，使用 **PengWenli42** 的 GitHub 账号登录。
2. 第一次按提示安装/授权 Pages CMS GitHub App，只选择 `pengwenli42.github.io` 仓库即可。
3. 选择该仓库的 `main` 分支。后台会读取根目录的 `.pages.yml`。
4. 在「个人介绍与主页」修改姓名、介绍、头像、公开邮箱和经历。
5. 在「博客与随笔」新建文章，填写标题、日期、分类、摘要，在正文编辑器中写作并插入图片（操作见下文）。打开「在网站发布」再保存。
6. 在「成果与引用」添加成果，可上传 PDF，填写 DOI、引用文本和 BibTeX。
7. 保存后等待 GitHub Actions 发布完成，再刷新主页。一般需几分钟，并非即时更新。

网站页脚始终提供「内容管理」入口。管理后台在 Pages CMS 网站，普通访客不能修改内容。

**公开仓库提醒：** 关闭「在网站发布」只能让文章不显示在网页；原稿和历史版本仍在公开仓库中。请勿上传私人草稿、密码或未获准公开的附件。

## 文章分类与正文插图

「文章分类」提供随笔、书评、田野笔记，以及已有文章使用的影评、乐评。网站的「博客与随笔」页可以点击分类标签阅读，也可点击「全部」返回所有文章。分类页有独立链接，可以收藏或分享。

插图可以放在正文任意段落之间，一篇文章可添加多张：

1. 在正文中另起一行，输入 `/`，选择 **Image**，打开媒体库。
2. 上传 JPG、PNG、WebP 或 GIF 图片，等待上传完成，再选中图片并点击 **Select**。也可以选择媒体库已有的图片。
3. 在下一段继续写作；需要更多插图时重复上述操作，或者在媒体库一次选择多张图片。封面图和正文插图分别设置。
4. 图片插入并加载完成后保存文章。若编辑器显示上传错误或保存时提示「临时预览」，删除该预览图，再从媒体库选取已上传的图片。

也可以切到正文的 **Source** 模式，用以下 Markdown 格式插图。把示例文件名替换为媒体库中的实际文件名，并填写图片说明：

```md
![图片说明](/uploads/实际图片文件名.jpg)
```

上传的图片保存在 `public/uploads/`，正文使用 `/uploads/` 开头的公开地址。`blob:` 开头的是当前浏览器中的临时预览地址，不能用于已发布文章；正文表单会检查这类图片地址并提示重新选择。

后台配置参考 Pages CMS 官方[分类选项说明](https://pagescms.org/docs/configuration/fields/select/)和[正文图片说明](https://pagescms.org/docs/configuration/fields/rich-text/)。

## 初次发布

创建公开仓库 `PengWenli42/pengwenli42.github.io`，将本项目推送到 `main`。在 GitHub 仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。本项目的 `.github/workflows/pages.yml` 会构建并发布 `dist`，不会发布测试和配置文件。

## 本地运行

需要 Node.js 22 或更新版本（发布使用 24）。

```sh
npm ci
npm test
npm run build
npm run preview
```

打开 http://127.0.0.1:4173/ 。更新内容后再次执行 `npm run build` 并刷新。

## 内容结构

- `content/profile.json`：个人介绍。
- `content/posts/*.md`：Markdown 博客，YAML 头包含 `title`、`date`、`published`、`category`、`summary`、`cover`。
- `content/publications/*.json`：成果条目。
- `public/uploads/`：公开图片和附件。
- `.pages.yml`：后台中文表单配置。
- `public/style.css`：网页样式。

文章和成果初始为空，不含虚构经历或论文。个人介绍中尚未提供的资料可在后台补充。文章链接由文件名生成，更改标题不会改变已有文件的链接；尽量不要重命名已发表文章文件。

引用次数自动同步未包含在本项目中，成果列表、DOI、复制引用和上传 BibTeX 均已支持。
