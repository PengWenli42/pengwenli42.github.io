import { readFile, readdir, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const escape = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeUrl(value = '') {
  const v = String(value).trim();
  if (/^\/(?!\/)/.test(v) && !/[\\\x00-\x20]/.test(v)) return v;
  try { const url = new URL(v); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function markdown(text = '') {
  return sanitizeHtml(marked.parse(String(text)), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'title', 'width', 'height'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: { img: (tagName, attribs) => ({ tagName, attribs: {...attribs, loading: 'lazy'} }) }
  });
}
export function dateText(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`无效的文章日期：${value}`);
  return d.toISOString().slice(0, 10);
}
const external = (url, label, cls = '') => safeUrl(url) ? `<a class="${cls}" href="${escape(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">↗</span></a>` : '';

export async function buildSite(root = process.cwd(), output = path.join(root, 'dist')) {
  root = path.resolve(root); output = path.resolve(output);
  // Only replace this project's designated generated output.
  if (output !== path.join(root, 'dist')) throw new Error('输出目录必须为项目内的 dist');
  const profile = JSON.parse(await readFile(path.join(root, 'content/profile.json'), 'utf8'));
  if (!profile.name?.trim()) throw new Error('个人介绍必须填写姓名');
  const files = async (dir, ext) => (await readdir(path.join(root, dir))).filter(f => f.endsWith(ext));
  const posts = [];
  for (const file of await files('content/posts', '.md')) {
    const {data, content} = matter(await readFile(path.join(root, 'content/posts', file), 'utf8'));
    if (data.published !== true) continue;
    if (!data.title?.trim()) throw new Error(`文章缺少标题：${file}`);
    const slug = path.basename(file, '.md');
    posts.push({...data, content, date: dateText(data.date), slug, href: `/blog/${encodeURIComponent(slug)}/`});
  }
  posts.sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const publications = [];
  for (const file of await files('content/publications', '.json')) {
    const data = JSON.parse(await readFile(path.join(root, 'content/publications', file), 'utf8'));
    if (data.published === false) continue;
    if (!data.title?.trim() || !data.authors?.trim() || !Number.isInteger(Number(data.year))) throw new Error(`成果信息不完整：${file}`);
    publications.push({...data, slug: path.basename(file, '.json')});
  }
  publications.sort((a,b) => Number(b.year) - Number(a.year));
  await rm(output, {recursive: true, force: true});
  await mkdir(output, {recursive: true});
  await cp(path.join(root, 'public'), output, {recursive: true, filter: src => !src.endsWith('.gitkeep')});
  const write = async (rel, text) => { const dest = path.join(output, rel); await mkdir(path.dirname(dest), {recursive: true}); await writeFile(dest, text); };
  const nav = [['/', '首页'], ['/about/', '关于我'], ['/publications/', '成果与引用'], ['/blog/', '博客与随笔']];
  const layout = (title, active, body, description = profile.intro) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · ${escape(profile.name)}</title><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#f8f7f2"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><script src="/site.js" defer></script></head>
<body><a class="skip" href="#main">跳到正文</a><div class="shell"><header class="header"><a href="/" class="brand" aria-label="${escape(profile.name)}的主页"><span class="brand-mark">彭</span><span>${escape(profile.name)}<small>${escape(profile.englishName)}</small></span></a><nav aria-label="主导航">${nav.map(([href,label]) => `<a href="${href}" ${active===href?'aria-current="page"':''}>${label}</a>`).join('')}</nav></header><main id="main">${body}</main><footer><span>© ${new Date().getFullYear()} ${escape(profile.name)}<span class="footer-dot"> · </span>个人主页</span><a href="https://app.pagescms.org/PengWenli42/pengwenli42.github.io/main" target="_blank" rel="noopener noreferrer">内容管理 <span aria-hidden="true">↗</span></a></footer></div><p class="toast" role="status" aria-live="polite"></p></body></html>`;
  const empty = (label, text) => `<div class="empty"><span class="empty-mark" aria-hidden="true">✳</span><div><h3>${label}</h3><p>${text}</p></div></div>`;
  const postCard = p => `<a class="post-card" href="${p.href}"><div class="post-meta"><span>${escape(p.category || '随笔')}</span><time datetime="${p.date}">${p.date.replaceAll('-', '.')}</time></div><h3>${escape(p.title)} <span aria-hidden="true">↗</span></h3>${p.summary?`<p>${escape(p.summary)}</p>`:''}<span class="read-link">阅读全文 <span aria-hidden="true">→</span></span></a>`;
  const pubCard = (p,i) => {
    const citation = p.citation || `${p.authors}. ${p.title}. ${p.venue ? p.venue + ', ' : ''}${p.year}.`;
    const doi = p.doi ? (/^https?:\/\//i.test(p.doi) ? safeUrl(p.doi) : `https://doi.org/${encodeURI(p.doi)}`) : '';
    return `<article class="publication"><span class="pub-number">${String(i+1).padStart(2,'0')}</span><div><div class="post-meta"><span>${escape(p.venue || '成果')}</span><span>${escape(p.year)}</span></div><h3>${escape(p.title)}</h3><p class="authors">${escape(p.authors)}</p>${p.description?`<p>${escape(p.description)}</p>`:''}<div class="pub-actions">${external(p.url, '查看成果')}${external(doi,'DOI')}${external(p.pdf,'PDF')}<button type="button" data-copy="${escape(citation)}">复制引用</button>${p.bibtex?`<a href="/citations/${encodeURIComponent(p.slug)}.bib" download>BibTeX ↓</a>`:''}</div></div></article>`;
  };
  const intro = `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="green-dot"></span> ${escape(profile.tagline)}</div><h1>${escape(profile.name)}<span>${escape(profile.englishName)}</span></h1><p class="intro">${escape(profile.intro)}</p><div class="hero-links"><a class="primary-link" href="/about/">认识我 <span aria-hidden="true">↗</span></a><a href="/blog/">读我的文字 <span aria-hidden="true">→</span></a></div></div><aside class="profile-note">${safeUrl(profile.avatar)?`<img class="avatar" src="${escape(safeUrl(profile.avatar))}" alt="${escape(profile.name)}的头像" width="140" height="140">`:`<div class="monogram" aria-hidden="true">文<span>丽</span></div>`}<span class="note-rule"></span><p>${escape(profile.location || '研究、记录，与生活。')}</p><div class="social-links">${external(profile.github,'GitHub')}${external(profile.scholar,'学术主页')}${profile.email?`<a href="mailto:${escape(profile.email)}">联系我 ↗</a>`:''}</div></aside></section>`;
  await write('index.html', layout('首页','/',`${intro}<div class="home-sections"><section><div class="section-heading"><div><span class="eyebrow">PUBLICATIONS</span><h2>成果与引用<span class="section-count">${String(publications.length).padStart(2,'0')}</span></h2></div><a href="/publications/">全部成果 ↗</a></div>${publications.length?publications.slice(0,2).map(pubCard).join(''):empty('成果整理中','论文、作品与相关引用，将在这里陆续收录。')}</section><section><div class="section-heading"><div><span class="eyebrow">JOURNAL</span><h2>最近的文字<span class="section-count">${String(posts.length).padStart(2,'0')}</span></h2></div><a href="/blog/">全部文章 ↗</a></div>${posts.length?posts.slice(0,2).map(postCard).join(''):empty('等待第一篇文字','一些观察，一些思考，慢慢写下来。')}</section></div>`));
  await write('about/index.html',layout('关于我','/about/',`<section class="page-heading"><span class="eyebrow">ABOUT</span><h1>关于我<span class="title-dot">.</span></h1><p>${escape(profile.intro)}</p></section><div class="about-layout"><article class="prose">${markdown(profile.about)}${profile.interests?.length?`<h2>研究方向与兴趣</h2><div class="tags">${profile.interests.map(x=>`<span>${escape(x)}</span>`).join('')}</div>`:''}${profile.experience?.length?`<h2>教育与工作经历</h2><div class="timeline">${profile.experience.map(x=>`<div><span>${escape(x.period)}</span><h3>${escape(x.title)}</h3><p>${escape(x.organization)}</p></div>`).join('')}</div>`:''}</article><aside class="about-aside"><span class="eyebrow">ELSEWHERE</span><h2>找到我</h2>${external(profile.github,'GitHub')}${external(profile.scholar,'学术主页')}${profile.email?`<a href="mailto:${escape(profile.email)}">${escape(profile.email)} ↗</a>`:''}${profile.location?`<p>${escape(profile.location)}</p>`:''}</aside></div>`));
  await write('publications/index.html',layout('成果与引用','/publications/',`<section class="page-heading"><span class="eyebrow">PUBLICATIONS & WORK</span><h1>成果与引用<span class="title-dot">.</span></h1><p>论文、作品，以及可供引用的记录。</p></section><section class="pub-list">${publications.length?publications.map(pubCard).join(''):empty('成果整理中','新的成果将陆续更新。')}</section>`));
  for (const p of publications) if (p.bibtex) await write(`citations/${p.slug}.bib`,p.bibtex);
  await write('blog/index.html',layout('博客与随笔','/blog/',`<section class="page-heading"><span class="eyebrow">JOURNAL</span><h1>博客与随笔<span class="title-dot">.</span></h1><p>把想法留在纸上，也留在这里。</p></section><section class="blog-grid">${posts.length?posts.map(postCard).join(''):empty('还没有公开的文章','第一篇文字，正在路上。')}</section>`));
  for (const p of posts) {
    await write(`blog/${p.slug}/index.html`,layout(p.title,'/blog/',`<article class="article"><a class="back" href="/blog/">← 所有文章</a><header class="article-heading"><div class="post-meta"><span>${escape(p.category||'随笔')}</span><time datetime="${p.date}">${p.date.replaceAll('-','.')}</time></div><h1>${escape(p.title)}</h1>${p.summary?`<p>${escape(p.summary)}</p>`:''}<span class="byline">文 / ${escape(profile.name)}</span></header>${safeUrl(p.cover)?`<img class="article-cover" src="${escape(safeUrl(p.cover))}" alt="${escape(p.title)}的封面">`:''}<div class="prose">${markdown(p.content)}</div><a class="back article-bottom" href="/blog/">← 返回博客与随笔</a></article>`, p.summary || p.title));
  }
  await write('admin/index.html',layout('内容管理','',`<section class="page-heading"><span class="eyebrow">EDITOR</span><h1>内容管理<span class="title-dot">.</span></h1><p>使用 GitHub 账号登录 Pages CMS，选择本网站的仓库，即可更新个人介绍、成果和文章。</p><a class="primary-link" href="https://app.pagescms.org/PengWenli42/pengwenli42.github.io/main" target="_blank" rel="noopener noreferrer">打开管理后台 ↗</a></section>`));
  await write('404.html',layout('页面未找到','',`<section class="page-heading"><span class="eyebrow">404</span><h1>这一页不在这里。</h1><p>链接可能已经变更，回到首页继续看看吧。</p><a class="primary-link" href="/">返回首页 →</a></section>`));
  await write('.nojekyll','');
  return { posts: posts.length, publications: publications.length, output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await buildSite());
