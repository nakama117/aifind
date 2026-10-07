import { Link } from 'react-router';
import type { PublicGuide } from '../editorial/public-contracts.ts';
import type { PublicProduct } from '../public-contracts.ts';
import { Status, VerifiedDate } from './public-view.tsx';
import { Plans, Evidence, FactList, EditorialCards } from './editorial-view.tsx';
function Markdown({html}:{html:string}){return <div className="prose min-w-0 max-w-none break-words text-sm leading-7 [&_a]:text-accent [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto" dangerouslySetInnerHTML={{__html:html}}/>;}
function Section({title,mark,children}:{title:string;mark:string;children:React.ReactNode}){return <section data-guide-section={mark} className="min-w-0 space-y-3 rounded-panel bg-surface p-4 ring-1 ring-line sm:p-5"><h2 className="text-lg font-semibold">{title}</h2>{children}</section>;}
function Facts({p}:{p:PublicProduct}){return <dl className="space-y-3 text-sm">
  <div><dt className="text-xs text-ink-3">Product / 提供元</dt><dd><Link to={'/products/'+p.slug} className="break-words text-accent underline">{p.displayName}</Link> · {p.vendor?.name??'未設定'}</dd></div>
  <div><dt className="text-xs text-ink-3">日本での利用</dt><dd><Status value={p.markets.find(m=>m.marketCode==='JP')?.availabilityStatus??'unknown'}/></dd></div>
  <div className="flex flex-wrap gap-3">{(['input','output','ui']as const).map(k=><div key={k}><dt className="text-xs text-ink-3">{{input:'日本語入力',output:'日本語出力',ui:'日本語 UI'}[k]}</dt><dd><Status value={p.japanese[`${k}Support`]}/></dd></div>)}</div>
  <div><dt className="text-xs text-ink-3">プラットフォーム</dt><dd><FactList p={p} kind="platforms"/></dd></div>
  <div><dt className="text-xs text-ink-3">機能</dt><dd><FactList p={p} kind="capabilities"/></dd></div>
  <div><dt className="text-xs text-ink-3">プラン・料金</dt><dd><Plans p={p}/></dd></div>
  <div><dt className="text-xs text-ink-3">Published / Last Verified</dt><dd>v{p.versionNo} · <VerifiedDate at={p.publishedAt}/> / <span data-last-verified><VerifiedDate at={p.lastVerifiedAt}/></span></dd></div>
</dl>;}
export function GuideView({document:d,preview=false}:{document:PublicGuide;preview?:boolean}){
  const md=(key:string)=><Markdown html={d.rendered[key]??''}/>,records=d.products.filter(p=>p.testRecord);
  const gallery=(role:'cover'|'step'|'result'|'reference')=>d.assets.filter(a=>a.role===role).map(a=><figure data-guide-image={a.assetId} key={a.assetId} className="min-w-0 space-y-2"><img src={a.url} width={a.width} height={a.height} alt={a.altJa} loading={role==='cover'?'eager':'lazy'} className="h-auto max-h-[700px] max-w-full rounded-control object-contain"/><figcaption className="break-words text-xs leading-5 text-ink-3">{a.captionJa}</figcaption></figure>);
  return <article lang="ja" data-public-editorial="guide" data-public-guide className="min-w-0 space-y-6 pb-8">
    {!preview&&<Link to="/howto" className="text-sm text-accent hover:underline">← AIを使う · 使い方</Link>}
    <header className="space-y-4"><h1 className="break-words text-2xl font-semibold leading-snug sm:text-3xl">{d.title}</h1>
      {d.title.includes('[SYNTHETIC]')&&<p data-synthetic-notice className="rounded-control border border-amber/30 bg-amber/10 p-3 text-sm">[PREVIEW] [SYNTHETIC] 表示・操作テスト用の合成データです。実在する製品を試した結果ではありません。</p>}
      <p className="break-words leading-7 text-ink-2">{d.excerpt}</p><p data-guide-mode className="text-sm font-medium">{d.guide.mode==='official_sources'?'公式資料に基づく解説 · AIFINDによる実測ではありません':'実測記録に基づく手順 · 条件と Test Record を参照'}</p>
      <p className="text-xs text-ink-3">{preview?'保存済み Preview':'Published'} Revision r{d.revisionNo} · 公開日：<VerifiedDate at={d.publishedAt}/></p>
      {d.needsRetest&&<p data-needs-retest role="status" className="rounded-control border border-amber/40 bg-amber/10 p-4 text-sm leading-6">主製品の情報が手順の参照時点から更新されています。現在の事実と参考版を分けて表示します。手順・結果は再テストが必要です（needs_retest）。</p>}{gallery('cover')}
    </header>
    <Section title="この手順でできること" mark="task"><p className="font-medium">{d.guide.task}</p>{md('taskResultMd')}</Section>
    <Section title="必要なアカウント・Plan" mark="prerequisites">{md('prerequisitesMd')}<p className="text-xs text-ink-3">料金未確認は無料を意味しません。現在の料金と手順の参照版は下で別々に確認できます。</p></Section>
    <Section title="環境・参照時点" mark="environment"><div className="space-y-3">{d.products.map(p=><div data-guide-reference key={p.facts.slug} className="min-w-0 rounded-control border border-line p-3 text-sm"><p className="break-words">{p.role==='primary'?'主製品':p.role==='alternative'?'代替製品':'前提製品'} · {p.referenceFacts.displayName}</p><p>参照版 v{p.referenceVersionNo} · <VerifiedDate at={p.referencePublishedAt}/></p><p className="text-xs text-ink-3">参照 Plan：{p.referencedPlanKey??'未指定'} · Price 参照：{p.hasReferencedPrice?'記録あり':'未指定'} · 現在の公開版 v{p.facts.versionNo}</p></div>)}</div>
      {d.guide.mode==='official_sources'?<p className="text-sm">公式資料の参照版を示しています。実測環境・testedAt はありません。</p>:records.map(p=><div data-test-record key={p.facts.slug} className="space-y-3 border-t border-line pt-3"><h3 className="font-semibold">Test Record · {p.referenceFacts.displayName}</h3><p className="text-sm">タスク：{p.testRecord!.task}</p>
        <p data-tested-at className="break-words text-xs">testedAt：<time dateTime={p.testRecord!.testedAt}>{new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'medium',timeStyle:'short'}).format(new Date(p.testRecord!.testedAt))} JST</time> · 担当者：{p.testRecord!.reviewer} · 反復回数：{p.testRecord!.repeatCount??'未記録'}</p><h4 className="text-sm font-medium">実測環境</h4>{md(`test:${p.facts.slug}:environmentMd`)}{p.testRecord!.errorCriteria&&<p className="text-sm">エラー判定基準：{p.testRecord!.errorCriteria}</p>}
      </div>)}
    </Section>
    <Section title="入力素材" mark="materials">{md('materialsMd')}</Section>
    <Section title="手順" mark="steps"><div data-guide-steps>{md('stepsMd')}</div>{gallery('step')}</Section>
    <Section title="結果" mark="result"><div data-guide-result>{md('resultMd')}</div>{gallery('result')}{records.map(p=><details key={p.facts.slug} className="space-y-3 rounded-control border border-line p-3"><summary className="cursor-pointer text-sm">Test Record の手順・結果・限界</summary><h4>手順</h4>{md(`test:${p.facts.slug}:procedureMd`)}<h4>結果</h4>{md(`test:${p.facts.slug}:resultMd`)}<h4>限界</h4>{md(`test:${p.facts.slug}:limitationsMd`)}</details>)}</Section>
    <Section title="失敗例と対処" mark="failures">{md('failuresMd')}</Section>
    <Section title="限界・費用・注意点" mark="limitations">{md('limitationsMd')}{md('costNotesMd')}</Section>
    <Section title="代替手段" mark="alternatives">{md('alternativesMd')}</Section>
    <Section title="現在の Product facts / 手順の参照版" mark="facts"><p className="text-xs leading-5 text-ink-3">現在の Published は更新されます。参照版の事実と手順は過去の時点を保持します。金額は元の通貨・課金周期を表示します。</p>{d.products.map(p=><div key={p.facts.slug} className="grid min-w-0 items-start gap-4 md:grid-cols-2">
      <section data-current-facts className="min-w-0 space-y-3 rounded-control border border-line p-4"><h3 className="font-semibold">Current Published · v{p.facts.versionNo}</h3><Facts p={p.facts}/></section><section data-reference-facts className="min-w-0 space-y-3 rounded-control border border-amber/30 p-4"><h3 className="font-semibold">手順の参照版 · v{p.referenceFacts.versionNo}</h3><Facts p={p.referenceFacts}/></section>
    </div>)}</Section>
    <Section title="資料・Revision" mark="sources">{md('bodyMd')}{gallery('reference')}{d.products.map(p=><div key={p.facts.slug} className="space-y-2"><h3 className="break-words text-sm font-medium">{p.referenceFacts.displayName} · 参照版の根拠</h3><Evidence p={p.referenceFacts}/></div>)}</Section>
    {d.related&&(d.related.comparisons.length>0||d.related.categories.length>0)&&<Section title="関連する比較・用途ページ" mark="related"><EditorialCards documents={[...d.related.comparisons,...d.related.categories]}/></Section>}
  </article>;
}
