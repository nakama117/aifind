// The engine's ways in, one panel each: what it is for, the steps to connect, then the details folded away.
// Addresses are the site's configured public address (`base`); what visitors copy carries the site's tag
// (CopyTag) when it has one.
import { Fragment, useState } from "react";
import { Link } from "react-router";
import { PUBLIC_INTERFACE_VERSION } from "@aihot/contracts/http-policy";
import { MCP_TOOL_NAMES as T, MCP_TOOLS } from "@aihot/contracts/mcp";
import { feedCategoryLabel, PUBLIC_API_CATEGORY_KEYS } from "@aihot/contracts/taxonomy";
import { ACCESS, AGENT, POLICY, SITE, subjectAfter, withSubject } from "@aihot/site";
import { CodeBlock, CopyButton } from "./CodeBlock";
import { PillTabs } from "../../components/ui/Tabs";
import type { AgentPanelProps } from "../../modules";
import { AGENT_PARTS, GUIDE_CLIENTS, TAG } from "./module-parts";
import { Address, Ask, Block, Bullets, Details, Mono, PanelHead, Step, Steps, Table, Tips } from "./parts";

const V = PUBLIC_INTERFACE_VERSION;

/** Every MCP tool: the engine's and the modules'. */
export const mcpToolCount = () => MCP_TOOLS.length + AGENT_PARTS.reduce((n, a) => n + (a.tools?.length ?? 0), 0);
const link = "text-accent hover:underline";

/** An address on this site as the copy buttons copy it, with the tag. */
function addressOf({ base, tag }: AgentPanelProps, path: string): string {
  return TAG && tag ? `${base}${path}?${TAG.query}=${tag}` : `${base}${path}`;
}

const MCP_CLIENTS = [
  { key: "claude", label: "Claude Code" },
  { key: "codex", label: "Codex" },
  { key: "json", label: "JSON設定" },
  { key: "other", label: "その他のクライアント" },
] as const;

export function McpPanel(props: AgentPanelProps) {
  const url = addressOf(props, "/api/mcp");
  const name = SITE.mcpPrefix;
  const [client, setClient] = useState<string>("claude");
  return (
    <>
      <PanelHead label={`MCP · ${V}`} title={`URLを入力すると、Agentに${mcpToolCount()}個のツールが追加されます`}>
        標準のStreamable HTTPを使用します。匿名で読み取り専用、トークン不要で、ログイン状態も参照しません。Claudeデスクトップ版、Cursor、Cherry Studioなど、リモートMCP対応クライアントに適しています。
      </PanelHead>
      <Steps>
        <Step n={1} title="サービスURLをコピー">
          <Address url={url} />
          {TAG && <p className="mt-2 text-[13px] text-ink-3">{TAG.mcp}</p>}
        </Step>
        <Step n={2} title="クライアントに追加">
          <PillTabs className="mt-3" size="xs" layoutId="agent-mcp-client" label="クライアント" active={client} onSelect={setClient} items={MCP_CLIENTS.map((c) => ({ key: c.key, label: c.label }))} />
          {client === "claude" && <CodeBlock className="mb-0 mt-3" lang="bash" code={`claude mcp add --transport http ${name} '${url}'`} />}
          {client === "codex" && <CodeBlock className="mb-0 mt-3" lang="bash" code={`codex mcp add ${name} --url '${url}'`} />}
          {client === "json" && <CodeBlock className="mb-0 mt-3" title="Cursor、Cherry Studioなど、JSON設定を使うクライアント" lang="json" code={JSON.stringify({ mcpServers: { [name]: { type: "http", url } } }, null, 2)} />}
          {client === "other" && <p className="mt-3">{`クライアントのMCPまたはコネクター設定で新しい項目を作成し、名前に${name}、URLに上記のアドレスを入力して、認証は「なし」を選択してください。API Keyは入力しないでください。ローカルコマンドのみ対応しているクライアントでは、内蔵のリモートMCPプロキシを使用してください。`}</p>}
        </Step>
        <Step n={3} title="Agentに一度呼び出させる">
          <Ask text={`${T.latest}を呼び出して${subjectAfter(" 5件", "ニュース")}を取得し、過去24時間で最も重要な${SITE.name}へのリンクを付けます。`} />
          <p className="mt-2 text-[13px] text-ink-3">{`クライアントから${T.latest}を呼び出すと、回答に対象期間、中国語の要約、${new URL(props.base).host}が含まれます。`}</p>
        </Step>
      </Steps>

      <Block title={`${mcpToolCount()}個のツールが追加されます`}>
        <Table
          head={["ツール", "できること", "質問の例"]}
          minWidth={600}
          rows={[
            [<Mono>{T.latest}</Mono>, "過去24時間または直近7日間のピックアップ・全ニュース", `${subjectAfter("今日はどんなニュースがある？", "ニュース")}？`],
            [<Mono>{T.search}</Mono>, AGENT.search.scope, AGENT.search.ask],
            [<Mono>{T.hot}</Mono>, "現在のホットトピック Top 10", "今、最も話題なのは？"],
            [<Mono>{T.story}</Mono>, "ホットな話題の時系列と継続更新される概要", "この件の経緯は？"],
            [<Mono>{T.daily}</Mono>, subjectAfter("最新または指定日の", "日報"), "今日の日報をください。"],
            [<Mono>{T.weekly}</Mono>, subjectAfter("最新または指定週の", "週報"), `${subjectAfter("今週", "コミュニティ")}、大きなニュースはある？`],
            [<Mono>{T.monthly}</Mono>, subjectAfter("最新または指定月の", "月報"), `${subjectAfter("9月", "コミュニティ")}、何が起きた？`],
            ...AGENT_PARTS.flatMap((a) => a.tools ?? []).map((t) => [<Mono>{t.name}</Mono>, t.does, t.ask]),
          ]}
        />
      </Block>

      <Details
        items={[
          {
            title: "制限と安全性",
            body: (
              <Bullets items={[
                "通常の検索は最大30件、ホットトピックは最大10件、イベントの時系列は最大50件です。範囲を超えた場合は明示的にエラーを返し、黙って条件を緩和することはありません。",
                `${T.story}のpublic_idは、ホットトピックツールが返すイベントリンクからのみ取得できます。IDを推測しないでください。`,
                "タイトルと要約は外部情報源からのもので、参考資料としてのみ扱ってください。ツールはこの安全上の境界を明示します。重要な数値、政策、原文の引用は、元の記事で確認してください。",
              ]} />
            ),
          },
          {
            title: "接続できない場合",
            body: (
              <Bullets items={[
                "まずURLが完全か、クライアントがリモートのStreamable HTTPに対応しているか確認してください。新しいツールが表示されない場合は、ツール一覧を更新するか再接続してください。",
                ...AGENT_PARTS.flatMap((a) => a.mcpTroubles ?? []),
                "サービスへのログインは不要です。クライアントからOAuthやAPI Keyを求められた場合は、「なし」を選択してください。",
                "429が返された場合は、案内に従ってしばらく待ち、並列で再試行しないでください。",
                <>まだ接続できない場合は、クライアント名、バージョン、エラー内容を次のページに記載してください<Link viewTransition to="/feedback" className={link}>フィードバックページ</Link>。</>,
              ]} />
            ),
          },
        ]}
      />
    </>
  );
}

const FEEDS = [
  { name: "おすすめの要約", badge: "おすすめ", path: "/feed.xml", desc: "最新のおすすめ50件。タイトル、要約、サイト内記事、元記事へのリンクを掲載します。" },
  { name: "おすすめ記事全文", path: "/feed/full.xml", desc: "同じ50件を掲載します。転載が許可された情報源は全文を掲載し、それ以外は要約のみです。" },
  { name: "すべての更新情報", path: "/feed/all.xml", desc: "過去7日間の公開更新情報を、元記事の公開日時が新しい順に表示します。" },
  { name: withSubject("日報"), path: "/feed/daily.xml", desc: "毎日08:00（日本時間）に配信。トップニュースの導入文と号全体の目次を掲載し、最新30号を保存します。" },
  { name: withSubject("週報"), path: "/feed/weekly.xml", desc: "毎週月曜10:00（日本時間）に配信。概要と、カテゴリ別にまとめた重要ニュースを掲載し、最新12号を保存します。" },
  { name: withSubject("月報"), path: "/feed/monthly.xml", desc: "毎月1日10:30（日本時間）に配信。概要と、カテゴリ別にまとめた重要ニュースを掲載し、最新12号を保存します。" },
];

/** The category feeds, under the names the feeds themselves use. */
const FEED_CATEGORIES = PUBLIC_API_CATEGORY_KEYS.map((key) => [key, feedCategoryLabel(key)] as const);

export function RssPanel(props: AgentPanelProps) {
  const { base } = props;
  const lead = `${["主要なRSS 2.0リーダーに対応し、n8nやZapierなどの自動化ツールにも接続できます。URLは変わりません", ...AGENT_PARTS.flatMap((a) => a.rssLead ?? [])].join("；")}。`;
  return (
    <>
      <PanelHead label="RSS" title="URLをコピーしてリーダーで購読">
        {lead}
      </PanelHead>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEEDS.map((f) => (
          <div key={f.path} className="card flex flex-col p-4">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-ink">{f.name}</span>
              {f.badge && <span className="inline-flex h-[18px] items-center rounded-full bg-accent-soft px-2 text-[11px] font-medium text-accent">{f.badge}</span>}
            </div>
            <p className="mt-1 flex-1 text-[13px] leading-[1.7] text-ink-3">{f.desc}</p>
            <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
              <code className="mono min-w-0 flex-1 truncate text-[12px] text-ink-4">{base}{f.path}</code>
              <CopyButton text={addressOf(props, f.path)} label="URLをコピー" className="shrink-0" />
            </div>
          </div>
        ))}
      </div>
      {TAG && <p className="mt-3 text-[12.5px] text-ink-4">{TAG.rss}</p>}

      <Block title="カテゴリ別に購読">
        <Table
          head={["カテゴリ", "要約", "全文"]}
          minWidth={420}
          rows={FEED_CATEGORIES.map(([slug, label]) => [
            <span className="font-medium text-ink">{label}</span>,
            <span className="inline-flex items-center gap-2"><Mono>{`/feed/category/${slug}.xml`}</Mono><CopyButton text={addressOf(props, `/feed/category/${slug}.xml`)} className="!h-6 !px-1.5" /></span>,
            <span className="inline-flex items-center gap-2"><Mono>{`/feed/full/category/${slug}.xml`}</Mono><CopyButton text={addressOf(props, `/feed/full/category/${slug}.xml`)} className="!h-6 !px-1.5" /></span>,
          ])}
        />
      </Block>

      <Block title="更新頻度の目安">
        <p>リーダーは前回の ETag を付けてリクエストします。内容に変更がなければ、小さな 304 のみが返され、再ダウンロードは不要です。30 分ごとの更新で十分です。それより頻繁に更新しても、新しい内容は取得できません。</p>
        <p className="mt-3 text-[13px] text-ink-3">{`各項目のリンク先はサイト内の閲覧ページで、元記事へのリンクは概要にあります。匿名で購読できても、あらゆる用途が許可されているわけではありません${POLICY.terms.notes ? `：${POLICY.terms.notes.rss}` : ""}。詳しくは`}<Link viewTransition to="/terms" className={link}>{POLICY.terms.name}</Link>。</p>
      </Block>
    </>
  );
}

const RECIPES = [
  { key: "latest", label: "最新情報をチェック" },
  { key: "sync", label: "おすすめをすべて同期" },
];

export function ApiPanel(props: AgentPanelProps) {
  const { base, tag } = props;
  const userAgent = [ACCESS.userAgent, TAG && tag ? TAG.userAgent(tag) : null].filter(Boolean).join(" ");
  const curl = `curl --compressed${userAgent ? ` -A '${userAgent}'` : ""}`;
  let pace = "更新頻度：最新情報は随時追加され、おすすめは毎日数回から数十回更新されます。日報は毎日 08:00、週報は毎週月曜日 10:00、月報は毎月 1 日 10:30（日本時間）に発行されます。";
  if (ACCESS.ratePerMinute) pace += `同一 IP から 1 分間に約 ${ACCESS.ratePerMinute} 回を超えるリクエストがあると、429 が返されます。Retry-After に従って待機し、並列で再試行しないでください。`;
  const [recipe, setRecipe] = useState<string>("latest");
  const recipes = AGENT_PARTS.flatMap((a) => a.recipes ?? []);
  const items = `${base}/api/v1/items?mode=selected&window=24h&limit=20`;
  return (
    <>
      <PanelHead label={`REST API · ${V}`} title="認証不要の GET、すぐに使えます">
        トークンは不要です。ブラウザーからのクロスオリジン通信、curl、各言語の標準 HTTP クライアントから直接呼び出せます。パスは /api/v1 です。フィールドとエラーコードは <a href="/openapi-v1.json" className={link}>OpenAPI</a> に準拠します。
      </PanelHead>
      <CodeBlock className="mt-6" title="最初のリクエスト" lang="bash" code={`${curl} '${items}'`} />

      <Block title="通信量を抑えて、より高速に">
        <Tips
          items={[
            { title: "圧縮を有効化", text: <>curl に <Mono>--compressed</Mono>を追加し、ほかのクライアントでは gzip または br を有効にします。JSON は圧縮すると元の 1/4～1/8 のサイズになります。</> },
            { title: "ETag を付ける", text: <>レスポンスの ETag を保存し、次回は <Mono>If-None-Match</Mono>を付けます。内容に変更がなければ本文なしの 304 が返されます。</> },
            { title: "適切な間隔で取得", text: "最新情報と話題は最短 1 分に 1 回取得できます。日報は毎日 08:00 以降に 1 回、週報と月報は発行後に 1 回取得します。過去のページは、既に取得した項目が見つかったらそこで終了してください。" },
          ]}
        />
        <p className="mt-3 text-[13px] leading-[1.75] text-ink-3">{pace}</p>
      </Block>

      <Block title="API 一覧">
        <Table
          head={["パス", "用途", "取得頻度"]}
          minWidth={640}
          rows={[
            { group: "ニュース" },
            [<Mono>/api/v1/items</Mono>, "注目記事または直近7日間の全動向。カテゴリ、期間、キーワードで絞り込み可能", "最短1分間隔"],
            { group: "注目トピックとイベント" },
            [<Mono>/api/v1/hot-topics</Mono>, "現在のホットトピック Top 10", "最短1分間隔"],
            [<Mono>{"/api/v1/stories/{publicId}"}</Mono>, "イベントの報道タイムライン、AIによる概要、関連イベント", "必要に応じて"],
            { group: "日報" },
            [<Mono>/api/v1/dailies/latest</Mono>, "最新の日報", "毎日08:00以降に1回"],
            [<Mono>{"/api/v1/dailies/{date}"}</Mono>, "指定日の報告。記事の撤回に伴い引用も削除", "キャッシュの有効期限が切れた後、使用前にETagを検証"],
            [<Mono>/api/v1/dailies</Mono>, "日報の日付インデックス", "1日1回"],
            { group: "週報・月報" },
            [<Mono>/api/v1/weeklies/latest</Mono>, "最新の週報：見出し、概要、今週の注目情報をカテゴリ別に掲載", "毎週月曜10:00以降に1回"],
            [<Mono>{"/api/v1/weeklies/{week}"}</Mono>, "週を指定（ISO週形式：2026-W39など）。記事の撤回に伴い引用も削除", "キャッシュの有効期限が切れた後、使用前にETagを検証"],
            [<Mono>/api/v1/weeklies</Mono>, "週報インデックス", "週1回"],
            [<Mono>/api/v1/monthlies/latest</Mono>, "最新の月報", "毎月1日10:30以降に1回"],
            [<Mono>{"/api/v1/monthlies/{month}"}</Mono>, "月を指定（例：2026-09）", "キャッシュの有効期限が切れた後、使用前にETagを検証"],
            [<Mono>/api/v1/monthlies</Mono>, "月報インデックス", "月1回"],
            ...AGENT_PARTS.flatMap((a) => (a.api ? [{ group: a.api.group }, ...a.api.rows.map(([path, does, often]) => [<Mono>{path}</Mono>, does, often])] : [])),
            { group: "AIアシスタント向け" },
            [<Mono>/api/v1/agent</Mono>, `Agent向け利用ガイド。記載のURLから、整理済みの中国語版Markdownを取得できます${GUIDE_CLIENTS ? `；${GUIDE_CLIENTS} 実際に使うのはこれらです` : ""}`, "必要に応じて"],
            { group: "選定済みデータをすべて同期" },
            [<Mono>/api/v1/selected/snapshot</Mono>, "現在の選定済みデータをすべて取得（ページネーション）", "初回のみ"],
            [<Mono>/api/v1/selected/changes</Mono>, "以降の追加・変更・選定解除", "数分に1回"],
          ]}
        />
      </Block>

      <Block title="よくある使い方">
        <PillTabs size="xs" layoutId="agent-api-recipe" label="使い方" active={recipe} onSelect={setRecipe} items={[...RECIPES, ...recipes].map((r) => ({ key: r.key, label: r.label }))} />
        {recipe === "latest" && (
          <>
            <CodeBlock className="mb-3 mt-3" lang="bash" code={`# 初回：レスポンスヘッダーのETagを保存
${curl} -i '${items}'
# 以降：最短1分間隔でETagを付けてリクエスト。304が返された場合、変更はありません
${curl} -i -H 'If-None-Match: <前回のETag>' '${items}'`} />
            <p>前のページに戻る必要がある場合は、 <Mono>page.nextCursor</Mono> をcursorとして渡し、既に取得済みの項目に到達したら停止します。毎回7日分を取得し直さないでください。</p>
          </>
        )}
        {recipe === "sync" && (
          <>
            <CodeBlock className="mb-3 mt-3" lang="bash" code={`# 初回：ページネーションですべて取得します。最初のページのレスポンスに含まれるcursorを保存してください（全ページ共通）
${curl} '${base}/api/v1/selected/snapshot?fields=minimal&limit=500'
# hasMoreがtrueの場合、nextPageを付けて最後のページまで進みます
${curl} '${base}/api/v1/selected/snapshot?fields=minimal&limit=500&page=<前ページのnextPage>'
# 以降：cursorをそのまま渡すと、追加・変更・選定解除された項目のみ取得できます
${curl} '${base}/api/v1/selected/changes?cursor=<最初のページのcursor>&limit=100'`} />
            <p>各ページをローカルに正常に保存してから、新しいcursorを保存します。cursorは変更履歴のチェックポイントで、有効期限はありません。409が返った場合 <Mono>snapshot_required</Mono> は、スナップショットを再取得してください。データが気づかないうちに漏れることはありません。</p>
          </>
        )}
        {recipes.map((r) => recipe === r.key && <r.Body key={r.key} base={base} curl={curl} />)}
      </Block>

      <Block title="エラーが発生した場合" id="agent-api-recovery">
        <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
          <dt className="mono text-[13px] text-ink">400</dt>
          <dd>パラメーターが不正な場合：OpenAPIとレスポンスのcodeに従って修正し、より広いクエリに自動で切り替えないでください。cursorが無効または有効期間外の場合はinvalid_cursorが返るため、最初のページからやり直してください。</dd>
          <dt className="mono text-[13px] text-ink">409</dt>
          <dd>snapshot_required：差分から安全に再開できません。完全なスナップショットを再取得してください。</dd>
          <dt className="mono text-[13px] text-ink">429</dt>
          <dd>リクエスト過多：Retry-Afterに従って待機し、同時に再試行しないでください。</dd>
          <dt className="mono text-[13px] text-ink">5xx</dt>
          <dd>指数バックオフを適用し、まず前回成功した結果を使用してください。公開サービスのSLAは保証されません。</dd>
          {AGENT_PARTS.flatMap((a) => a.apiErrors ?? []).map(([status, what]) => (
            <Fragment key={status}>
              <dt className="mono text-[13px] text-ink">{status}</dt>
              <dd>{what}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-ink-3">{`匿名で呼び出せる場合でも、すべての用途が許可されているわけではありません${POLICY.terms.notes ? `：${POLICY.terms.notes.api}` : ""}。詳しくは`}<Link viewTransition to="/terms" className={link}>{POLICY.terms.name}</Link>。</p>
      </Block>

    </>
  );
}
