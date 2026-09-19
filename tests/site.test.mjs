import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, cp, access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSite, markdown, safeUrl} from '../scripts/build.mjs';

test('网页内容过滤脚本，允许正文图片和正常链接',()=>{
  const html=markdown('# 文章\n\n![图](/uploads/photo.png)\n\n<script>alert(1)</script>\n\n<a href="javascript:alert(1)">unsafe</a>');
  assert.match(html, /<h1>文章<\/h1>/);
  assert.match(html, /src="\/uploads\/photo.png"/);
  assert.doesNotMatch(html, /<script|javascript:/);
  for (const bad of ['javascript:alert(1)','//evil.test','/\\evil.test','data:text/html,test']) assert.equal(safeUrl(bad),'');
  assert.equal(safeUrl('https://example.com/a'),'https://example.com/a');
});

test('后台内容生成真实文章、引用和附件；未发布原稿不进入网站；删除内容后不留旧页面',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'personal-homepage-test-'));
  for (const folder of ['content/posts','content/publications','public/uploads']) await mkdir(path.join(root,folder),{recursive:true});
  await cp('public',path.join(root,'public'),{recursive:true});
  await writeFile(path.join(root,'content/profile.json'),JSON.stringify({name:'测试作者',englishName:'Test',intro:'测试简介',about:'## 介绍\n\n可在后台编辑。',interests:['阅读'],experience:[{period:'2024',title:'研究',organization:'测试机构'}]}));
  const post=path.join(root,'content/posts/中文文章.md');
  await writeFile(post,'---\ntitle: 一篇测试文章\ndate: 2026-09-19\npublished: true\ncategory: 随笔\nsummary: 文章摘要\n---\n## 正文标题\n\n这是正文。\n\n![测试图](/uploads/test.svg)');
  await writeFile(path.join(root,'content/posts/draft.md'),'---\ntitle: 未发布原稿\ndate: 2026-09-19\npublished: false\n---\n不应出现在生成的网站');
  await writeFile(path.join(root,'content/publications/test.json'),JSON.stringify({title:'测试成果',authors:'测试作者',year:2026,venue:'测试期刊',doi:'10.1234/test',citation:'作者. 测试成果. 2026.',bibtex:'@article{test, title={测试成果}}',pdf:'/uploads/test.pdf',published:true}));
  await writeFile(path.join(root,'public/uploads/test.pdf'),'fixture');
  await writeFile(path.join(root,'public/uploads/test.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>');
  const result=await buildSite(root);
  assert.equal(result.posts,1);assert.equal(result.publications,1);
  const index=await readFile(path.join(root,'dist/index.html'),'utf8');
  assert.match(index,/一篇测试文章/);assert.doesNotMatch(index,/未发布原稿/);
  const article=await readFile(path.join(root,'dist/blog/中文文章/index.html'),'utf8');
  assert.match(article,/<h2>正文标题<\/h2>/);assert.match(article,/2026.09.19/);
  const pub=await readFile(path.join(root,'dist/publications/index.html'),'utf8');
  assert.match(pub,/data-copy="作者. 测试成果. 2026."/);assert.match(pub,/https:\/\/doi.org\/10.1234\/test/);
  assert.match(await readFile(path.join(root,'dist/citations/test.bib'),'utf8'),/@article/);
  await access(path.join(root,'dist/uploads/test.pdf'));
  await assert.rejects(access(path.join(root,'dist/blog/draft/index.html')));
  await writeFile(post,'---\ntitle: 一篇测试文章\npublished: false\n---\n已撤下');
  await buildSite(root);
  await assert.rejects(access(path.join(root,'dist/blog/中文文章/index.html')));
});
