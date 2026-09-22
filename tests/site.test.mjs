import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, cp, access, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSite, markdown, safeUrl} from '../scripts/build.mjs';

test('正文多张图片保留地址和延迟加载，脚本与危险图片属性被过滤',()=>{
  const html=markdown('# 文章\n\n![图一](/uploads/photo.png)\n\n段落之间可以插图。\n\n![图二](https://example.com/photo.jpg)\n\n<img src="/uploads/third.webp" alt="图三" onerror="unsafeImage()">\n\n<script>unsafeScript()</script>\n\n<a href="javascript:alert(1)">unsafe</a>\n\n[正常链接](https://example.com/article)');
  assert.match(html, /<h1>文章<\/h1>/);
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(match=>match[0]);
  assert.equal(images.length,3);
  assert.deepEqual(images.map(image=>image.match(/\bsrc="([^"]+)"/)[1]),[
    '/uploads/photo.png','https://example.com/photo.jpg','/uploads/third.webp'
  ]);
  for (const image of images) {
    assert.match(image,/\bloading="lazy"/);
    assert.match(image,/\bdecoding="async"/);
    assert.match(image,/\balt="图[一二三]"/);
  }
  assert.match(html,/href="https:\/\/example.com\/article"/);
  assert.doesNotMatch(html, /<script|javascript:|onerror|unsafeScript|unsafeImage/);
  for (const bad of ['javascript:alert(1)','//evil.test','/\\evil.test','data:text/html,test']) assert.equal(safeUrl(bad),'');
  assert.equal(safeUrl('https://example.com/a'),'https://example.com/a');
});

test('后台内容生成真实文章、引用和附件；未发布原稿不进入网站；删除内容后不留旧页面',async(t)=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'personal-homepage-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
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

async function createFixture(t, profile={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'personal-homepage-regression-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for (const folder of ['content/posts','content/publications','public/uploads']) {
    await mkdir(path.join(root,folder),{recursive:true});
  }
  await writeFile(path.join(root,'content/profile.json'),JSON.stringify({
    name:'测试作者',englishName:'Test',intro:'测试简介',about:'一段介绍。',...profile
  }));
  return root;
}

async function writePost(root, slug, data={}, body='文章正文。') {
  const fields={title:`文章-${slug}`,date:'2026-09-20',published:true,...data};
  const frontmatter=Object.entries(fields).map(([key,value])=>`${key}: ${JSON.stringify(value)}`).join('\n');
  await writeFile(path.join(root,'content/posts',`${slug}.md`),`---\n${frontmatter}\n---\n${body}`);
}

const readPage=(root, page)=>readFile(path.join(root,'dist',page),'utf8');
const articleLinks=html=>[...html.matchAll(/<a\b[^>]*\bhref="(\/blog\/(?!category\/)[^/]+\/)"/g)]
  .map(match=>match[1]).sort();

test('仅保留三个分类页，旧田野和评论分类归入随笔，各分类只列出对应文章',async(t)=>{
  const root=await createFixture(t);
  const fixtures=[
    {slug:'essay-one',category:'随笔',route:'essay'},
    {slug:'book-one',category:'书评',route:'book-review'},
    {slug:'story-one',category:'小故事',route:'story'},
    {slug:'field-one',category:'田野笔记',route:'essay'},
    {slug:'legacy-field',category:'田野日记',route:'essay'},
    {slug:'film-one',category:'影评',route:'essay'},
    {slug:'music-one',category:'乐评',route:'essay'}
  ];
  for (const fixture of fixtures) await writePost(root,fixture.slug,{category:fixture.category});
  await writePost(root,'draft',{category:'田野笔记',published:false});
  await buildSite(root);

  for (const route of new Set(fixtures.map(fixture=>fixture.route))) {
    const html=await readPage(root,`blog/category/${route}/index.html`);
    const expected=fixtures.filter(fixture=>fixture.route===route).map(fixture=>`/blog/${fixture.slug}/`).sort();
    assert.deepEqual(articleLinks(html),expected,`分类 ${route} 不应混入其他分类或未发布文章`);
    assert.match(html,new RegExp(`href="/blog/category/${route}/"[^>]*aria-current="page"`));
    assert.doesNotMatch(html,/href="\/blog\/category\/(?:field-notes|film-review|music-review)\//);
  }
  const all=await readPage(root,'blog/index.html');
  assert.deepEqual(articleLinks(all),fixtures.map(fixture=>`/blog/${fixture.slug}/`).sort());
  assert.deepEqual([...all.matchAll(/href="(\/blog\/category\/[^/]+\/)"/g)].map(match=>match[1]),[
    '/blog/category/essay/','/blog/category/book-review/','/blog/category/story/'
  ]);
  for (const slug of ['field-one','legacy-field','film-one','music-one']) {
    const article=await readPage(root,`blog/${slug}/index.html`);
    assert.match(article,/<span>随笔<\/span>/);
    assert.doesNotMatch(article,/田野笔记|田野日记|影评|乐评/);
  }
  for (const route of ['field-notes','film-review','music-review']) {
    await assert.rejects(access(path.join(root,`dist/blog/category/${route}/index.html`)));
  }
});

test('小故事没有文章时仍可访问，显示数量零并保留返回全部的入口',async(t)=>{
  const root=await createFixture(t);
  await writePost(root,'only-essay',{category:'随笔'});
  await buildSite(root);
  const html=await readPage(root,'blog/category/story/index.html');
  assert.deepEqual(articleLinks(html),[]);
  assert.match(html,/还没有小故事/);
  assert.match(html,/<a\b[^>]*href="\/blog\/"[^>]*>全部/);
  assert.match(html,/href="\/blog\/category\/story\/"[^>]*aria-current="page"[^>]*>小故事<span>0<\/span>/);
  const all=await readPage(root,'blog/index.html');
  assert.match(all,/href="\/blog\/category\/story\/"[^>]*>小故事<span>0<\/span>/);
  assert.doesNotMatch(all,/href="\/blog\/category\/(?:field-notes|film-review|music-review)\//);
});

test('首页每栏仅显示最新两条，查看全部入口在预览之后并链接完整列表',async(t)=>{
  const root=await createFixture(t);
  for (let index=1;index<=3;index++) {
    await writePost(root,`post-${index}`,{category:'随笔',date:`2026-09-${20-index}`});
    await writeFile(path.join(root,'content/publications',`pub-${index}.json`),JSON.stringify({
      title:`成果-${index}`,authors:'作者',year:2027-index,published:true
    }));
  }
  await buildSite(root);
  const html=await readPage(root,'index.html');
  assert.deepEqual(articleLinks(html),['/blog/post-1/','/blog/post-2/']);
  assert.match(html,/成果-1/);
  assert.match(html,/成果-2/);
  assert.doesNotMatch(html,/成果-3|文章-post-3/);
  assert.ok(html.indexOf('成果-1')<html.indexOf('成果-2'));
  assert.ok(html.indexOf('文章-post-1')<html.indexOf('文章-post-2'));

  const viewAll=[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>\s*查看全部[\s\S]*?<\/a>/g)];
  assert.deepEqual(viewAll.map(match=>match[1]),['/publications/','/blog/']);
  assert.ok(viewAll[0].index>html.indexOf('成果-2'),'全部成果入口应在成果预览之后');
  assert.ok(viewAll[1].index>html.indexOf('文章-post-2'),'全部文章入口应在文章预览之后');
  assert.match(await readPage(root,'publications/index.html'),/成果-3/);
  assert.deepEqual(articleLinks(await readPage(root,'blog/index.html')),[
    '/blog/post-1/','/blog/post-2/','/blog/post-3/'
  ]);
});

test('资料保留 GitHub 值时，首页和关于我仍不显示该链接，其他联系入口保留',async(t)=>{
  const github='https://github.com/fixture-person';
  const root=await createFixture(t,{
    github,scholar:'https://scholar.example.com/author',email:'author@example.com'
  });
  await buildSite(root);
  for (const page of ['index.html','about/index.html']) {
    const html=await readPage(root,page);
    assert.ok(!html.includes(github),`${page} 不应显示个人 GitHub 链接`);
    assert.match(html,/href="https:\/\/scholar.example.com\/author"/);
    assert.match(html,/href="mailto:author@example.com"/);
  }
  const profile=JSON.parse(await readFile(path.join(root,'content/profile.json'),'utf8'));
  assert.equal(profile.github,github);
});
