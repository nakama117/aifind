# AI Signal JP モデルランキング

AIHOT 上流 `cc66cce` に存在したモデルランキングを、4.0 のモジュール API に適合させた独立機能。ブランド、読者向け文章、日時表示は AI Signal JP 向け。元の著作権表示と MIT ライセンスは保持する。

## 復元範囲

- 総合・コーディング・推論・知識・専門業務の 5 ランキング。中国の開発元／重み公開の複合フィルター、表示内検索、スコア・料金・公開日・カバー率の並べ替え。
- モデル詳細、分野別成績、元の評価、実行設定、出典公開日／評価実施日／取得確認日、除外理由、未測定、近隣モデルとの比較。過去に公開したモデルの URL とその時点の日付を保持。
- 69 件の出典目録と個別説明、評価方法、公式リンク、許諾に関する記録。目録は上流の 2026-10-03 時点の調査に由来し、今回あらためてすべての条件を確認したという意味ではない。
- 固定の校正尺度、8 分野の等分予算、測定／タスク群／機関の分離、観測された共通証拠だけを使う Kemeny / HiGHS の順位と相対スコア。
- 旧版の 10 系列の取得器、内容ハッシュ付きスナップショット、代表設定選択、失敗時の以前の有効結果維持。日時は `timestamptz`／UTC、画面では JST。
- 公開 JSON、Agent Markdown、MCP、サイトマップ、1 日 4 回の自動更新用フック。閲覧時にモデル呼び出しや順位計算は行わない。

`seeds/` のモデル名・別名・校正尺度・有日付の公式価格は上流の記録であり、新たな実測値ではない。移行時に順位・スコア・モデル行を自動投入しない。初回の更新コマンドでモデルの識別情報と固定尺度を導入するが、順位の公開には取得した実測が必要。価格は 2026-09-26 / 2026-09-30 の原通貨記録で、現在の料金を保証しない。

## 接続

| ファイル | 登録 |
| --- | --- |
| `site/modules/index.ts` | `import leaderboard from "@aihot/model-leaderboard"` → `MODULES` |
| `site/modules/server.ts` | `import leaderboard from "@aihot/model-leaderboard/server"` → `SERVER_MODULES` |
| `site/modules/web.ts` | `import leaderboard from "@aihot/model-leaderboard/web"` → `WEB_MODULES` |
| `site/package.json` | `@aihot/model-leaderboard: "*"` |
| `Dockerfile` | npm install 前に `modules/model-leaderboard/package.json` を COPY |

追加依存は `highs@1.15.3` と `hyparquet@1.31.1`。ルートの workspace インストールと lock 更新が必要。独立移行 `modules/model-leaderboard/migrations/0057_model_leaderboard.sql` は標準 `scripts/migrate.ts` が検出する。公開済みの `0053` は変更しない。この移行は空の `lb_*` と価格用為替表を復元し、ニュースや学習データのテーブルに触れない。

ニュースを参照する機能は追加していない。ランキングの出口はすべてモジュールの `backend/read.ts` を読み、フロントエンドは HTTP 経由だけでアクセスする。フレームワークからモジュール実装を直接 import しない。

## アドレス

- `/leaderboard` と `/leaderboard/boards/{coding,reasoning,knowledge,professional}`
- `/leaderboard/:slug`、`/leaderboard/sources`、`/leaderboard/sources/:key`、`/leaderboard/rules`
- `/api/site/leaderboard/*` と `/api/v1/leaderboard/*` の `boards/:key`、`models/:slug`、`sources`、`sources/:key`、`rules`、`catalogue`
- `/api/v1/agent/leaderboard`、MCP のサイト接頭辞付き `get_model_leaderboard`（省略可能な `board` 引数）

公開済みの集計がなければ、ランキング API は HTTP 503 と `leaderboard_pending`。目録、評価方法、出典ページは利用可能で、`run: null` を返す。取得済みの本物の出典結果は初回の順位公開前でも閲覧できるが、架空の順位やモデル詳細リンクを生成しない。

順位とモデル詳細の読み取りは `status = 'published'` の集計に限定する。後から作られた `failed` の集計は公開結果を置き換えず、過去のモデル詳細も最後の `published` の日時を保持する。出典ページの元データは順位とは別の実測記録で、公開集計に使ったスナップショットを優先する。未集計の実測に順位やモデル詳細の URL を補わない。

## 手動で少量の公開データを確認

`.env` や鍵を出力しない。実行するシェルに正しい `DATABASE_URL` が設定され、移行済みであることを確認する。Windows は PowerShell 7 を使う。

```powershell
$env:MODEL_CALLS_ENABLED = 'false'
$env:COLLECT_ENABLED = 'true'
$env:LEADERBOARD_REFRESH_ENABLED = 'true'
node modules/model-leaderboard/scripts/refresh-sources.ts --sources livebench-coding,livebench-reasoning,livebench-writing,epoch-simpleqa,epoch-gpqa
$env:COLLECT_ENABLED = 'false'
$env:LEADERBOARD_REFRESH_ENABLED = 'false'
```

このコマンドは明示した公開データを取得する。課金モデルを呼ばず、API キーが必要な Artificial Analysis は少量確認 CLI の対象外。評価元を跨ぐ通信は最大 2 系列、失敗時は 1 回再試行する。`--round` を付けた場合だけ完全な集計を試す。`LEADERBOARD_AUTO_PUBLISH` が未設定または false なら `shadow` の確認待ち候補として保存し、true のときだけ自動公開する。全ランキングの証拠が揃わない場合は `failed`（終了コード 1）となり、過去の公開結果があれば維持する。最新の証拠が不足していることを、成功に見せかけない。

使用条件を確認して全取得を有効にした後は `node modules/model-leaderboard/scripts/refresh.ts`。Artificial Analysis の無料 API に必要な資格情報は既存の backend credential 経路を使う。料金のある推論サービスは使用しない。

自動更新は `COLLECT_ENABLED=true` **かつ** `LEADERBOARD_REFRESH_ENABLED=true` のときのみ、JST 00:20 / 06:20 / 12:20 / 18:20。両方の既定値は false とする。取得元の利用条件やプロトコルが変わった場合は、有効化前に確認する。失敗した出典を空の結果や 0 点で上書きしない。

自動公開は追加の `LEADERBOARD_AUTO_PUBLISH=true` で明示する。この値が true なら、定時更新は従来どおりすべての品質条件を満たした集計を自動公開する。未設定または false なら、定時更新の集計は `shadow` の候補として保存し、管理画面で確認して公開する。手動の「计算待审核候选」はこの設定にかかわらず候補を作る。自動と手動は同じ排他キュー・同じ公開条件を使い、課金モデルは呼ばない。

## 管理画面と運用の補完

`/admin/model-leaderboard` は既存の管理者ログイン配下にある中国語の管理画面。管理 API は `/api/admin/model-leaderboard` 以下に置き、既存のセッションと CSRF 検証を使う。書き込みには理由が必要で、元の値・更新内容・操作者を既存の監査ログへ保存する。公開 API に書き込みは追加しない。

- **取得状態**: 69 件を表示し、適合する取得器の有無、無料 API キーの要否、最後の試行・成功、失敗理由、原資料公開日時、保存したスナップショット日時と件数を区別する。資格情報そのものは返さない。
- **排隊実行**: 選んだ取得元だけの取得、候補集計、欠けたコンテキスト長の取得、公開為替の取得、日付付き価格資料の導入を worker へ渡す。HTTP リクエスト中にネットワーク取得や計算をしない。同時に待機・実行できる榜单タスクは一つで、重複時は今回の操作が入隊していないことを表示する。実行時にもネットワーク安全弁を再確認する。
- **候補と公開**: 候補の全順位、モデル数・参照数、元スナップショットと公開／取得日時を確認できる。手動公開できるのは現在の方法に適合し、5 ランキングが元の公開条件を満たし、保存した順位が欠けていない `shadow` だけ。`failed`、不完全な候補、後から既に新しい集計が公開された候補は公開できない。
- **価格・コンテキスト**: モデル検索から原通貨の公式価格、核验日、HTTPS 出典、説明、コンテキスト長を管理する。空白は未知、0 は確認されたゼロ。保存した価格資料を現在の価格として扱わない。入力価格が不明で説明があるだけでは「公式の有料 API なし」と断定しない。
- **為替**: USD/CNY の値、日付、來源名と HTTPS 出典を保存する。公開集計に採用するには新しい集計が必要で、過去の集計の換算日を変更しない。

追加移行 `modules/model-leaderboard/migrations/0060_model_leaderboard_admin.sql` は価格の観察日・記録由来、コンテキストの出典 URL・確認日時を追加する。API / worker の更新前に標準移行を実行する。既存の不明な日付を今日の日付で埋めず、既存の `0057` を書き換えない。既に登録済みのモジュール定義が管理ページ、API、キュー、ナビゲーションを追加するため、共有の三清单にもう一度登録する必要はない。

### 取得器の対応範囲

| 系列 | 対応指標数 | 条件 |
| --- | --- | --- |
| Artificial Analysis | 1 | 無料 API キーが必要。多言語指標はこの無料 API の対象外 |
| Arena | 4 | text / creative-writing / webdev / vision |
| LiveBench | 4 | general / writing / coding / reasoning |
| EQ-Bench | 2 | creative / longform |
| Epoch | 8 | FrontierMath、Tier 4、Chess、Mystery、SimpleQA、GPQA、MirrorCode、EBR |
| DeepSWE / TapTap / Mercor / Vals / Terminal-Bench | 各 1 | 公開される実測と各出典の条件に従う |

合計 24 指標。集計対象の 16 指標にはすべて取得器があり、残る 45 件は原版でも調査・観察・データ待ちの目録項目で、自動取得できると表示しない。2026-10-04 に取得済みの 14 指標と、取得器が実装された 24 指標は別の数である。この補完作業ではローカル偽データだけを使い、本番候補庫の実測を追加・変更していない。

EQ は公開 CSV と補助的な GitHub の日付照会を分離した。実際に起きた匿名 API の 403 で日付照会に失敗しても、取得できた CSV の実測を解析する。公開日・コミットは `null` / 未確認になり、取得日を公開日へ流用しない。この挙動は匿名配額失敗の偽 HTTP テストで確認した。実際の再取得は今回の変更では行っていない。

公開の出典詳細にも、未接入・未取得・成功・失敗、最後の確認と成功日時を載せる。内部のエラーメッセージやキーは公開しない。アクセス制限中は過去の実測とその日付を残し、最新だと見せかけない。

### SEO

総合の `/leaderboard/boards/overall` は canonical を `/leaderboard` に統一し、追跡クエリを canonical に含めない。公開済みの榜单には実際のモデル名・順位・詳細 URL による ItemList とパンくずを添える。相対スコアをレビュー評価や正答率の構造化データとして使わない。初回集計前の空榜は noindex、管理画面は noindex / nofollow。公開ページは既存のサイト URL、OG、Twitter メタ情報の共通実装を使う。

管理機能と CLI の公開制御を補完後のモジュール試験は **72 / 72 PASS**（終了コード 0）。`npx tsc -p modules` と `npx tsc -p tests` は PASS。実際のフレームワークのルートを使い、`/admin/model-leaderboard` がログイン layout の子として解決されることも検証した。実際の CLI 子プロセスでは、公開スイッチの未設定・false が `shadow`、true が `published` となることを独立テスト DB と仮の HTTP 応答で検証した。ログは `modules/model-leaderboard/verification/2026-10-04-cli-review-tests.txt`。全体の web ビルドとブラウザー検証は主タスクで実施する。価格は USD / CNY を文字で明示し、CNY は人民元として説明する。円記号による JPY との混同は避ける。

## 検証

親プロセスの全体テストと並行で走らせず、独立した `*_test` データベースを使う。

```powershell
$env:DATABASE_URL = 'postgres://postgres@127.0.0.1:55432/aisignal_lb_test'
$env:MODEL_CALLS_ENABLED = 'false'
$env:COLLECT_ENABLED = 'false'
node --test-global-setup=tests/databases.ts --import ./tests/databases.ts --test --test-concurrency=3 --test-timeout=120000 "modules/model-leaderboard/tests/*.test.ts"
npx tsc -p modules
npx tsc -p apps/web
```

対象: 校正の不変性、共通証拠の欠測、循環した比較、匿名名、固定設定、履歴 URL、首榜前の実測、HTTP ETag、公開／サイトの同一結果、JST の日付繰越、複合フィルター、更新の安全弁。テストはローカルの偽サービスか固定データだけを使用する。実データ取得の成否と、運用全体の公開可能性は別途報告する。

## 2026-10-04 13:03 UTC の追加確認（現在のローカル公開集計）

EQ-Bench Creative Writing / Longform Writing の無料公開資料を取得し、16 指標・2,195 スコア・610 実測モデルへ更新した。総合は 80 モデル、他の 4 分野はそれぞれ 28 / 48 / 68 / 42 モデル。5 分野とも元の公開条件を満たし、候補 `vl03ikqhrcbxbu23mwifkees9` を管理用公開関数で検証してからローカルに公開した。課金モデル呼び出しはない。

GitHub による補助的な日付確認が利用できないときも、直接アクセスできる EQ 公開資料を取得できるよう修正した。上流公開日は null のまま保ち、13:03 UTC の取得日時を公開日として使っていない。HTTP 403 の認証回避は行っていない。証拠は `docs/verification/completion-20261004/eq-completion.json`。以下の 14 指標の記録は同日初回の履歴であり、現在値は本節を参照する。

管理・CLI を含むモジュール回帰は 72/72 PASS、退出コード 0。未設定/false の自動公開フラグで候補が公開されないことを実際の CLI 子プロセスでも確認した。

## 2026-10-04 初回の実データ確認（履歴）

ローカルの `aisignal_launch` で、鍵が不要な公開評価を実際に取得し、方法 `2026.10-observed-evidence-v17` の元の公開条件を満たした。判定は **5 ランキングとも published / optimal**。公開集計 ID は `bs64mal4z663ryufonwtn1etg`。順位、校正条件、必要な機関数、必要な参照モデル数は緩めていない。架空の結果や 0 点の代替値は投入していない。

| 確認対象 | 結果 |
| --- | --- |
| 取得成功 | 14 指標 / 6 評価機関 / 14 スナップショット |
| 実測 | 1,915 件の `lb_scores`、実測があるモデル 522 件 |
| 識別情報 | 942 モデル、4,264 別名、17 固定校正記録。これらの数は実測モデル数と異なる |
| 総合 | 61 モデル / 16 参照モデル（集計最低条件は 10 / 8） |
| コーディング | 28 モデル / 11 参照モデル |
| 推論 | 48 モデル / 15 参照モデル |
| 知識 | 68 モデル / 14 参照モデル |
| 専門業務 | 42 モデル / 11 参照モデル |
| 分類の集計最低条件 | 各 5 モデル / 4 参照モデル。ページ表示は条件ごとに最大 30 モデル |

成功した指標は LiveBench の coding / reasoning / writing、Epoch の SimpleQA / GPQA / FrontierMath / FrontierMath Tier 4 / Chess / Mystery、Arena の creative-writing / vision、DeepSWE v1.1、Mercor APEX Agents、Vals Finance Agent。69 件の目録全体を取得したという意味ではない。最初の 5 指標から段階的に取得を拡大した。今回確認したデータでは名前解決の失敗や取得形式の変化は検出されず、名前の捏造や推測による修正は行っていない。

EQ creative / longform の 2 指標は GitHub の匿名 API が HTTP 403（利用上限到達）を返したため取得できなかった。認証キーの利用、上限回避、推測値の補充は行っていない。現在の 14 指標で全ランキングの元の公開条件を満たしており、EQ の不足は今回の集計を阻止する条件ではない。

### 日時の意味

| 種類 | UTC の記録 | 画面上の JST |
| --- | --- | --- |
| 今回使った出典の最新公開日 | Arena: 2026-10-02 00:00:00 | 2026-10-02 09:00 |
| 取得日時の範囲 | 2026-10-04 11:00:47–11:02:07 | 2026-10-04 20:00–20:02 |
| 公開集計の生成日時 | 2026-10-04 11:04:04.794 | 2026-10-04 20:04 |

出典公開日時は取得した公開資料の更新情報に由来する。個別試行の評価実施日時が公表されていない場合は `measuredAt: null` / 「未確認」を保ち、取得日を評価日として代入しない。出典ごとの公開日時には差があり、Mercor は 2026-09-08、DeepSWE は 2026-09-22、LiveBench / Epoch は 2026-09-29、Vals は 2026-10-01、Arena は 2026-10-02。最新公開日だけを全測定の日付として表示しない。

### 出典の利用条件と公開範囲

この確認は、データの取得成功とアルゴリズム上の公開条件を確認したもの。全出典の再表示・再配布許諾を今回新たに確認したという意味ではない。目録にある LiveBench の Apache 2.0、Epoch / Arena の CC BY 4.0 は上流から引き継いだ記録で、出典リンク、評価機関名、集約による変更の説明を保持する。問題文や評価データセットの全文を掲載する機能は追加していない。

DeepSWE の記録は公開前の許諾再確認を求め、Mercor APEX は評価結果の再表示・再配布条件を未確認としている。Vals も提供者の利用条件に従う必要がある。この 3 系列について、無料でアクセスできたことを転載許諾の確認に置き換えない。外部向けの公開判断には実際の利用条件の確認が残る。コードや問題集のライセンスを評価結果の許諾として流用しない。現段階ではローカルの公開 API / プレビューで確認し、外部配備は行っていない。

公式料金、コンテキスト長、為替の更新は今回の少量取得に含めていない。未確認値はそのまま表示し、順位には影響しない。自動更新の安全弁は既定で閉じ、今回の取得だけをプロセス単位で許可した。課金モデルは呼び出していない。

### 検証記録

- モジュールテスト: 59 / 59 PASS。`npx tsc -p modules` と `npx tsc -p apps/web`: PASS。
- 実測と集計: `modules/model-leaderboard/verification/2026-10-04-live-run.json`。
- 公開 API / 日本語 HTML / リンクの読み取り確認: `modules/model-leaderboard/verification/2026-10-04-api.json`。同ディレクトリの `check-publication.mjs` は既存の 3101 API / 3100 ページを読むだけで、共有サービスを再起動しない。
- 5 ランキングのサイト用 / 公開 API は同一の published 集計を返し、モデル詳細とスコアが一致。ETag の再問い合わせはすべて 304。25 ページの日本語 HTML、150 件の内部リンク・画像、12 件の重複を除いた公式引用先はすべて HTTP 200。Arena の出典公開日時と取得日時が別々に JST へ変換されることも確認した。
- このモジュール担当時点では CUA 初期化が sandbox helper のエラーになり視覚確認を実行できなかった。その後、統合担当が既存の Playwright / Edge でデスクトップとモバイルのランキング画面を実際に表示し、全体の34ページ確認およびスクリーンショット確認を完了した。記録は `docs/verification/launch-20261004/browser-launch.json`。
