import { useLoaderData } from "react-router";
import type { Route } from "./+types/report-latest";
import type { ReportLatestPage } from "@aihot/contracts/site";
import { SITE, subjectAfter, withSubject } from "@aihot/site";
import { edgeTtl, loadOr404 } from "../lib/api.server";
import { pageMeta, reportLd } from "../lib/seo";
import { tokyoDate } from "@aihot/contracts/time";
import { EmptyState } from "../components/ui/Page";
import { ReportLayout } from "../features/report/ReportLayout";
import { ReportPaper, reportOutline } from "../features/report/ReportPaper";
import { KIND_LABEL, feedLink, kindFromPath } from "../features/report/format";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { tab: "daily", name: "日報" };

export async function loader({ request }: Route.LoaderArgs) {
  const kind = kindFromPath(new URL(request.url).pathname);
  const { index, report } = await loadOr404<ReportLatestPage>(`/api/site/reports/${kind}/latest-page`, { signal: request.signal });
  return { kind, report, index, today: tokyoDate(Date.now()) };
}

export function meta({ loaderData, location }: Route.MetaArgs) {
  const kind = loaderData?.kind ?? "daily";
  const description = kind === "daily" ? `${SITE.name} ${subjectAfter("毎日08:00（日本時間）に公開される", "業界厳選デイリーレポート")}。` : kind === "weekly" ? `${subjectAfter("毎週", "業界総合レビュー")}。` : `${subjectAfter("毎月", "業界動向まとめ")}。`;
  const report = loaderData?.report;
  return [...pageMeta({
    title: withSubject(KIND_LABEL[kind]),
    description,
    path: location.pathname,
    image: `/og/pages/${kind}.png`,
    // The latest issue, described at this page's own address (its canonical).
    jsonLd: report ? reportLd(report, location.pathname, report.lead?.leadParagraph ?? description) : undefined,
  }), feedLink(kind)];
}

export function headers() {
  return edgeTtl(600);
}

export default function ReportLatestPage() {
  const { kind, report, index, today } = useLoaderData<typeof loader>();
  return (
    <ReportLayout kind={kind} index={index} current={report?.key ?? null} today={today} outline={report ? reportOutline(report) : []}>
      {report ? <ReportPaper report={report} index={index} /> : <EmptyState title={subjectAfter("まだ公開されていません", KIND_LABEL[kind])}>第1号が公開されると、ここに表示されます。</EmptyState>}
    </ReportLayout>
  );
}
