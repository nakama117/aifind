import { useState, type ReactNode } from "react";
import { Link, data, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { SITE } from "@aihot/site";
import { edgeTtl, loadOr404 } from "@aihot/web/lib/api.server";
import { pageMeta, siteUrl } from "@aihot/web/lib/seo";
import { PhoneBar } from "../../../apps/web/app/components/shell/PhoneBar";
import type { Screen } from "../../../apps/web/app/components/shell/screens";
import type { LbBoardResponse, LbBrand, LbCatalogue, LbModelDetail, LbSourceDetail } from "../contracts.ts";
import { LB_SOURCE_STATUS_LABELS } from "../contracts.ts";
import { LEADERBOARD_BOARD_LABELS, LEADERBOARD_PUBLIC_BOARDS, type LeaderboardBoardKey } from "../taxonomy.ts";
import { boardHref, leaderboardSeo, modelHref, percent, price, score, selectEntries, sourceHref, stamp, type SortKey } from "./format";
import "./style.css";

interface PageData {
  kind:"board"|"model"|"source"|"sources"|"rules";
  title:string;
  path:string;
  key:string;
  catalogue:LbCatalogue;
  board:LbBoardResponse|null;
  model:LbModelDetail|null;
  source:LbSourceDetail|null;
}

export const handle: Screen = {tab:"me",name:"ランキング"};
export const headers = () => edgeTtl(120);

export async function loader({request,params}:LoaderFunctionArgs):Promise<PageData> {
  const path=new URL(request.url).pathname;
  const kind:PageData["kind"] = path.endsWith("/rules")?"rules":path.endsWith("/sources")?"sources":path.includes("/sources/")?"source":params.slug?"model":"board";
  const key=params.key ?? params.slug ?? "overall";
  const catalogue=await loadOr404<LbCatalogue>("/api/site/leaderboard/catalogue",{signal:request.signal});
  const result:PageData={kind,path,key,catalogue,title:"モデルランキング",board:null,model:null,source:null};
  const missing=()=>{throw data({message:"not_found"},{status:404});};
  if(kind==="board") {
    if(!(LEADERBOARD_PUBLIC_BOARDS as readonly string[]).includes(key)) missing();
    result.title=`${LEADERBOARD_BOARD_LABELS[key as LeaderboardBoardKey]}モデルランキング`;
    if(catalogue.run)result.board=await loadOr404<LbBoardResponse>(`/api/site/leaderboard/boards/${key}`,{signal:request.signal});
  } else if(kind==="model") {
    if(!catalogue.run)missing();
    result.model=await loadOr404<LbModelDetail>(`/api/site/leaderboard/models/${encodeURIComponent(key)}`,{signal:request.signal});
    result.title=result.model.model.name;
  } else if(kind==="source") {
    const source=catalogue.groups.flatMap(g=>g.sources).find(s=>s.key===key);
    if(!source)missing();
    result.title=source!.name;
    result.source=await loadOr404<LbSourceDetail>(`/api/site/leaderboard/sources/${encodeURIComponent(key)}`,{signal:request.signal});
  } else result.title=kind==="rules"?"評価方法と読み方":"評価データの出典";
  return result;
}

export function meta({loaderData}:{loaderData?:PageData}) {
  const value=loaderData;
  const title=value?.title??'モデルランキング';
  const seo=leaderboardSeo({kind:value?.kind??'board',key:value?.key??'overall',path:value?.path??'/leaderboard',title,base:siteUrl(),publishedAt:value?.board?.run.generatedAt??value?.model?.run.generatedAt??value?.source?.syncedAt??null,entries:value?.board?.entries});
  return pageMeta({title,...seo,description:"公開評価から AI モデルを比較。実測、欠測、出典と評価条件を分けて掲載します。"});
}

function Mark({brand}:{brand:LbBrand|null}) {
  return <span className={`lb-mark ${brand?.raster?"lb-raster":""}`}>{brand?.src?<img src={brand.src} alt="" width="26" height="26" loading="lazy"/>:brand?.monogram ?? "·"}</span>;
}
function External({href,children}:{href:string|null;children:ReactNode}) {return href?<a href={href} target="_blank" rel="noreferrer">{children} ↗</a>:<span>{children}</span>;}
function Panel({title,children}:{title:string;children:ReactNode}) {return <section className="lb-panel"><h2>{title}</h2>{children}</section>;}
function Pending() {return <div className="lb-empty"><span className="lb-eyebrow">EVIDENCE FIRST</span><h2>ランキングの初回集計を準備中です</h2><p>公開に必要な評価データがまだ揃っていません。実測データを取得し、比較条件と十分な証拠を確認した後に掲載します。</p><div className="lb-links"><Link to="/leaderboard/rules">評価方法を読む →</Link><Link to="/leaderboard/sources">出典を確認 →</Link></div></div>;}

function Board({value,boardKey}:{value:LbBoardResponse|null;boardKey:string}) {
  const [domestic,setDomestic]=useState(false),[open,setOpen]=useState(false),[sort,setSort]=useState<SortKey>("rank"),[query,setQuery]=useState("");
  const rows=value?selectEntries([...value.entries,...value.filterEntries],{domestic,open,sort,query}):[];
  return <>
    <nav className="lb-tabs" aria-label="ランキングの分野">{LEADERBOARD_PUBLIC_BOARDS.map(key=><Link key={key} to={boardHref(key)} aria-current={key===boardKey?"page":undefined}>{LEADERBOARD_BOARD_LABELS[key]}</Link>)}</nav>
    {!value?<Pending/>:<>
      <p className="lb-lead">{value.board.description}</p>
      <div className="lb-stats"><span><b>{value.board.sourceCount}</b> 出典</span><span><b>{value.board.operatorCount}</b> 評価機関</span><span>集計 <time dateTime={value.run.generatedAt}>{stamp(value.run.generatedAt)}</time></span></div>
      <div className="lb-controls"><label><input type="checkbox" checked={domestic} onChange={e=>setDomestic(e.target.checked)}/>中国の開発元</label><label><input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)}/>重み公開</label><label className="lb-search"><span className="sr-only">モデルを検索</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="表示内のモデルを検索"/></label><label><span className="sr-only">並び順</span><select value={sort} onChange={e=>setSort(e.target.value as SortKey)}><option value="rank">参考順位</option><option value="score">スコア順</option><option value="coverage">証拠のカバー率</option><option value="released">公開日の新しい順</option><option value="input">入力料金の低い順</option><option value="output">出力料金の低い順</option></select></label></div>
      <div className="lb-table-wrap"><table className="lb-table"><thead><tr><th>順位</th><th>モデル</th><th>スコア</th><th>証拠のカバー率</th><th>出典</th><th>入力 / 出力料金</th><th>公開日</th></tr></thead><tbody>{rows.map(e=><tr key={e.model.slug}><td className="lb-rank">{e.rank}</td><th scope="row"><Link className="lb-model" to={modelHref(e.model.slug)}><Mark brand={e.model.brand}/><span>{e.model.name}<small>{e.model.provider ?? "開発元未確認"}{e.access.weightsUrl?" · 重み公開":""}</small></span></Link></th><td className="lb-score">{score(e.score)}</td><td><span className="lb-meter"><i style={{width:percent(e.coverage)}}/></span>{percent(e.coverage)}</td><td>{e.sourceCount}</td><td>{price(e.price)}<small>{price(e.price,"output")}</small>{e.price&&<small>価格記録 {e.price.asOf??"日付未確認"}{e.price.origin==="seed"?" · 保存資料":""}</small>}</td><td>{e.model.releasedAt ?? "未確認"}</td></tr>)}</tbody></table></div>
      {!rows.length&&<p className="lb-note">条件に一致するモデルはありません。</p>}
      <p className="lb-note">{value.run.fx?`料金換算: ${value.run.fx.asOf} の ${value.run.fx.sourceName}、1 USD = ${value.run.fx.rate} CNY。`:"換算レートは未確認です。"}</p><p className="lb-note">{value.board.howToRead} 表示は各条件で最大 30 モデル。料金は 100 万トークンあたりの原通貨（USD または人民元 CNY）で、未確認は「未確認」。料金順は保存済みの人民元換算値を使い、欠測は末尾です。価格は能力の順位に影響しません。</p>
      {!!value.pending.length&&<Panel title="この分野では証拠が不足しているモデル"><p className="lb-note">他分野では掲載されていますが、このランキングの必要条件を満たしていません。</p><div className="lb-pills">{value.pending.map(m=><Link key={m.model.slug} to={modelHref(m.model.slug)}>{m.model.name} · {m.sources} 出典</Link>)}</div></Panel>}
    </>}
  </>;
}

function Model({value}:{value:LbModelDetail}) {
  return <>
    <div className="lb-model-head"><Mark brand={value.model.brand}/><div><h1 data-page-title="">{value.model.name}</h1><p className="lb-note">{value.model.provider ?? "開発元未確認"} · 公開日 {value.model.releasedAt ?? "未確認"}</p></div></div>
    {value.historical&&<p className="lb-warning">これは最後に公開された履歴です。現在のランキングの条件は満たしていません。</p>}
    <p className="lb-note">集計 <time dateTime={value.run.generatedAt}>{stamp(value.run.generatedAt)}</time></p>
    <div className="lb-summary"><div><small>総合スコア</small><strong>{score(value.overall.score)}</strong></div><div><small>参考順位</small><strong>{value.overall.rank==null?"—":`#${value.overall.rank}`}</strong></div><div><small>証拠のカバー率</small><strong>{percent(value.overall.coverage)}</strong></div><div><small>個別評価</small><strong>{value.metricCount}</strong></div></div>
    <div className="lb-cards">{value.categories.map(c=><Link className="lb-card" key={c.key} to={boardHref(c.key)}><span>{c.name}</span><b>{score(c.score)}</b><small>{c.rank==null?"証拠不足":`参考順位 #${c.rank}${c.onBoard?"":" · 表示上位外"}`} · {c.sourceCount} 出典</small></Link>)}</div>
    <Panel title="利用条件と料金"><div className="lb-facts"><div><dt>コンテキスト長</dt><dd>{value.model.contextWindowTokens?.toLocaleString("ja-JP") ?? "未確認"} トークン</dd></div><div><dt>入力 / 出力</dt><dd>{price(value.price)} / {price(value.price,"output")}</dd></div><div><dt>キャッシュ入力</dt><dd>{price(value.price,"cached")}</dd></div></div><p className="lb-note">料金は 100 万トークンあたりの原通貨。保存された出典に基づく参考情報です。価格記録の日付は {value.price?.asOf??"未確認"}{value.price?.origin==="seed"?"（保存資料）":""}。現在の料金を自動確認したものではありません。最新の料金は <External href={value.price?.officialUrl ?? null}>公式料金</External> で確認してください。</p><p className="lb-note">コンテキスト仕様の確認: {stamp(value.model.contextVerifiedAt, 'day')} · <External href={value.model.contextSourceUrl}>仕様の出典</External>。未確認の日時は取得日で補いません。</p>{value.price?.note&&<p className="lb-note">{value.price.note}</p>}{value.model.weightsUrl&&<External href={value.model.weightsUrl}>公開されたモデルの重み</External>}</Panel>
    <Panel title="採用した評価と実行設定">
      {!value.evidence.length&&<p className="lb-note">表示できる個別評価がありません。</p>}
      {value.evidence.map(g=><div key={g.key} className="lb-evidence-group"><h3>{g.name}</h3>{g.items.map(e=><details className="lb-evidence" key={e.sourceKey}><summary><span className="lb-model"><Mark brand={e.brand}/><span>{e.sourceName}<small>{e.usage}{e.carriedForward?" · 以前の実測を継続採用":""}</small></span></span><b>{e.display}</b></summary><div className="lb-evidence-body"><p>{e.configurationLabel ?? "出典の設定は未確認"} · 元の順位 {e.sourceRank ?? "—"}</p><p>{e.selectionReason}</p>{!!e.components.length&&<p>{e.components.map(c=>`${c.label}: ${c.display}`).join(" / ")}</p>}<p>{e.componentsNote}</p><dl className="lb-facts"><div><dt>評価の実施日</dt><dd>{stamp(e.measuredAt, 'day')}</dd></div><div><dt>出典の公開日</dt><dd>{stamp(e.upstreamAt, 'day')}</dd></div><div><dt>取得の確認日時</dt><dd>{stamp(e.verifiedAt)}</dd></div><div><dt>出典のモデル名</dt><dd>{e.sourceModelName ?? "未確認"}</dd></div></dl><div className="lb-links"><Link to={sourceHref(e.sourceKey)}>出典の詳細</Link><External href={e.officialUrl}>公式評価</External></div></div></details>)}</div>)}
    </Panel>
    {(value.excluded.length>0||value.unmeasured.length>0)&&<Panel title="採用しない結果・未測定"><ul className="lb-list">{value.excluded.map(e=><li key={e.key}><Link to={sourceHref(e.key)}>{e.name}</Link> — {e.reason}</li>)}{value.unmeasured.map(e=><li key={e.key}><Link to={sourceHref(e.key)}>{e.name}</Link> — 採用可能な実測がありません</li>)}</ul><p className="lb-note">欠測の分野: {value.overall.missingDimensions.join("、")||"なし"}。公表誤差のない測定: {value.overall.unknownErrorCount} 件。欠測を 0 点にせず、未公表の誤差を推測しません。</p></Panel>}
    {!!value.comparisons.length&&<Panel title="近い順位のモデルと比較">{value.comparisons.map(c=><details key={c.model.slug} className="lb-evidence"><summary><span>{c.model.name} · #{c.rank}</span><small>{c.sharedCount} 共通測定</small></summary><div className="lb-evidence-body"><p className="lb-note">共通証拠の重み {percent(c.sharedWeight)} · 相対的な純支持差 {c.net.toFixed(3)}</p><div className="lb-table-wrap"><table className="lb-table"><thead><tr><th>出典</th><th>{value.model.name}</th><th>{c.model.name}</th><th>重み</th></tr></thead><tbody>{c.rows.map((r,i)=><tr key={`${r.sourceKey}-${i}`}><th><External href={r.officialUrl}>{r.sourceName}</External></th><td>{r.mine}</td><td>{r.theirs}</td><td>{percent(r.weight)}</td></tr>)}</tbody></table></div>{c.hasPage&&<Link to={modelHref(c.model.slug)}>モデルの詳細 →</Link>}</div></details>)}</Panel>}
  </>;
}

function Sources({catalogue}:{catalogue:LbCatalogue}) {
  const [filter,setFilter]=useState("all");
  const all=catalogue.groups.flatMap(g=>g.sources);
  return <><p className="lb-lead">{all.length} 件の評価元を、集計対象・参考・調査中に分けて公開しています。実際に使った証拠と重みは各集計に保存します。</p><div className="lb-controls"><label>表示 <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">すべて</option>{Object.entries(LB_SOURCE_STATUS_LABELS).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label></div>{catalogue.groups.map(g=>{const sources=g.sources.filter(s=>filter==="all"||s.status===filter);return sources.length?<Panel key={g.key} title={g.name}><p className="lb-note">{g.blurb}</p><div className="lb-source-grid">{sources.map(s=><Link key={s.key} className="lb-source-card" to={sourceHref(s.key)}><div className="lb-model"><Mark brand={s.brand}/><h3>{s.name}</h3></div><p>{s.description}</p><div><span className={`lb-status lb-${s.status}`}>{LB_SOURCE_STATUS_LABELS[s.status]}</span><small>{s.operator}{s.budget!=null?` · ${percent(s.budget)}`:""}</small></div></Link>)}</div></Panel>:null;})}</>;
}

function Source({value,catalogue,keyName}:{value:LbSourceDetail|null;catalogue:LbCatalogue;keyName:string}) {
  const s=value?.source ?? catalogue.groups.flatMap(g=>g.sources).find(s=>s.key===keyName)!;
  return <><div className="lb-model-head"><Mark brand={s.brand}/><div><h1 data-page-title="">{s.name}</h1><p className="lb-note">{s.fullName} · {s.operator}</p></div></div><span className={`lb-status lb-${s.status}`}>{LB_SOURCE_STATUS_LABELS[s.status]}</span><p className="lb-lead">{s.description}</p><div className="lb-links"><External href={s.officialUrl}>公式の出典</External><Link to="/leaderboard/rules">共通の評価方法</Link></div><div className="lb-source-method"><Panel title="何を測るか"><p>{s.what}</p></Panel><Panel title="ランキングでの扱い"><p>{s.usage}</p></Panel><Panel title="比較の限界"><p>{s.limits}</p></Panel><Panel title="出典・利用条件"><p>{s.license}</p><p className="lb-note">{s.attribution}</p></Panel></div><p className="lb-note">最終取得確認 {stamp(value?.collection.lastAttemptAt)} · 最後の成功 {stamp(value?.collection.lastSucceededAt)}。リアルタイムの成績ではありません。{value?.collection.requiresKey?"この出典の取得には提供者の無料 API キーが必要です。":""}{value?.collection.message}</p><Panel title={value?.systemRows?"システム別の元の結果":"元の評価結果"}>{!value?.collected?<p className="lb-note">この出典の公開可能な結果は、まだ掲載されていません。</p>:<><p className="lb-note">出典公開 {stamp(value.upstreamAt, 'day')} · 取得確認 {stamp(value.syncedAt)}</p><p className="lb-note">{value.rowsNote}</p><div className="lb-table-wrap"><table className="lb-table"><thead><tr><th>元の順位</th><th>モデル・設定</th><th>元のスコア</th><th>採否</th></tr></thead><tbody>{value.rows.map((r,i)=><tr key={i}><td>{r.sourceRank ?? "—"}</td><th>{r.modelSlug?<Link to={modelHref(r.modelSlug)}>{r.sourceModelName}</Link>:r.sourceModelName}<small>{r.configurationLabel}</small></th><td>{r.display}</td><td>{r.excluded ?? (s.status==="ranked"?"採用可能":"参考")}</td></tr>)}</tbody></table></div></>}</Panel></>;
}

function Rules({catalogue}:{catalogue:LbCatalogue}) {
  return <><p className="lb-lead">異なる尺度の公開評価を、観測された共通の証拠だけで比較します。{SITE.name} のスコアは相対指標で、正答率ではありません。</p><Panel title="何を比較するか"><p>公開された固定版の基礎モデルを対象とします。同一の評価条件が確認できる直接回答や共通ツールの実行結果を使い、匿名テスト、公開前の版、異なるモデルへのフォールバック、条件未確認の専用システムは除外します。構成を選ぶ優先順位は事前に固定し、最も高い点数を都合よく選びません。</p></Panel><Panel title="8 分野を同じ重みで扱う"><p>各分野に 12.5% を割り当て、分野内で独立したタスク群、さらに測定へ分配します。関連評価を追加しても、そのタスク群の総重量は増えません。データがない分野の重みを他へ移しません。</p><div className="lb-cards">{catalogue.method.budgets.map(b=><div key={b.key} className="lb-card"><span>{b.name}</span><b>{percent(b.weight)}</b><small>{b.sources.join("、")||"この集計で利用可能な測定なし"}</small></div>)}</div></Panel><Panel title="順位とスコアの求め方"><ol className="lb-list"><li>同じ測定を受けたモデルの組だけを比較します。原点数をそのまま足したり、未測定を 0 点にしたりしません。</li><li>固定の参照モデルで作った尺度を、評価手順の版ごとに保存します。新モデルの追加で既存の比較尺度を動かしません。</li><li>連続的な点差と固定重みから、観測された支持に最も矛盾しない順位を整数計画法（Kemeny / HiGHS）で求めます。</li><li>その順位と矛盾しないように、参照モデルを基準とした 0–100 の相対スコアを当てはめます。誤差が未公表なら不明のまま保持します。</li></ol></Panel><Panel title="証拠が不足したとき"><p>総合順位の候補は、3 出典・3 タスク群・3 機関・3 分野以上と、2 つ以上の参照モデルとの直接比較が必要です。集計全体にも、総合では少なくとも 10 モデルと 8 参照モデル、分類では 5 モデルと 4 参照モデルが必要です。比較ネットワークが分断された場合や最適解を確認できない場合は公開せず、直前の有効な集計を維持します。</p><p>原則として公開から 18 か月以内のモデルを対象にし、出典に実際の公開日がない場合は不明と表示します。最新データの省略は同一評価版の最近の実測で補える場合がありますが、後から明示された除外を覆したり、異なる評価版を混ぜたりしません。</p></Panel><Panel title="時刻と表示"><p>保存・API の日時は UTC、画面は日本時間 JST です。評価実施日、出典公開日、取得確認日、集計日時は別の情報として表示します。価格とコンテキスト長は補足で、能力の順位には加点しません。</p><p>過去に公開したモデルは、上位 30 位から外れても詳細を維持します。現在の条件から外れたモデルは、そのモデルの最後の公開結果と日時を示します。</p></Panel><Panel title="現在の方法と参照モデル"><p><code>{catalogue.method.version}</code></p><div className="lb-pills">{catalogue.method.anchors.map(a=><span key={a}>{a}</span>)}</div><p className="lb-note">{catalogue.run?`現在の集計: ${stamp(catalogue.run.generatedAt)}`:"公開済みの集計はまだありません。"}</p><Link to="/leaderboard/sources">すべての出典と制約を確認 →</Link></Panel></>;
}

export default function LeaderboardPage() {
  const value=useLoaderData<typeof loader>();
  const hasOwnTitle=value.kind==="model"||value.kind==="source";
  return <div className="lb-page"><PhoneBar title={value.title} back={value.kind==="board"?undefined:{to:"/leaderboard",label:"ランキング"}}/><header className="lb-header"><div><span className="lb-eyebrow">{SITE.name} / MODEL INTELLIGENCE</span>{!hasOwnTitle&&<h1 data-page-title="">{value.title}</h1>}</div><nav className="lb-links" aria-label="ランキングの案内"><Link to="/leaderboard">ランキング</Link><Link to="/leaderboard/sources">出典</Link><Link to="/leaderboard/rules">評価方法</Link></nav></header>{value.kind==="board"?<Board key={value.key} boardKey={value.key} value={value.board}/>:value.kind==="model"?<Model value={value.model!}/>:value.kind==="sources"?<Sources catalogue={value.catalogue}/>:value.kind==="source"?<Source value={value.source} catalogue={value.catalogue} keyName={value.key}/>:<Rules catalogue={value.catalogue}/>}<footer className="lb-footer">公開評価を、出典と条件とともに。<Link to="/api/v1/leaderboard/catalogue" reloadDocument>公開 API ↗</Link></footer></div>;
}
