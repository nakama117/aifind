import { readFile } from "node:fs/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { applyPublicHeaders, sendJsonWithEtag, sendProblem } from "@aihot/api/http/respond";
import { LEADERBOARD_PUBLIC_BOARDS, type LeaderboardBoardKey } from "../taxonomy.ts";
import { loadBoard, loadCatalogue, loadModel, loadRulesData, loadSource, loadSources, NoLeaderboardRun } from "../backend/read.ts";
import { registerLeaderboardAdmin } from './admin.ts';

const CACHE = "public, max-age=120, s-maxage=300, stale-while-revalidate=600";
type Handler = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

export function registerLeaderboard(app: FastifyInstance): void {
  registerLeaderboardAdmin(app);
  const notFound = (req: FastifyRequest, reply: FastifyReply) => sendProblem(req, reply, {status:404,code:"not_found",detail:"見つかりません。",cacheControl:"public, max-age=60"});
  const guard = (read: Handler, publicApi: boolean): Handler => async (req, reply) => {
    if (publicApi) applyPublicHeaders(reply);
    try { return await read(req, reply); }
    catch (error) {
      if (error instanceof NoLeaderboardRun) return sendProblem(req, reply, {status:503,code:"leaderboard_pending",detail:"公開に必要な評価データを準備中です。未確認の順位は掲載しません。",retryAfter:300});
      req.log.error({err:error}, "leaderboard read failed");
      return sendProblem(req, reply, {status:503,code:"temporarily_unavailable",detail:"ランキングを読み込めません。",retryAfter:30});
    }
  };
  for (const prefix of ["/api/site/leaderboard", "/api/v1/leaderboard"]) {
    const register = (path: string, read: Handler) => app.get(prefix + path, guard(read, prefix.includes("/v1/")));
    const json = (req: FastifyRequest, reply: FastifyReply, body: unknown, key: string) => sendJsonWithEtag(req,reply,body,{etagPrefix:`lb-${key}`,cacheControl:CACHE});
    register("/catalogue", async (req,reply) => json(req,reply,await loadCatalogue(),"catalogue"));
    register("/boards/:key", async (req,reply) => {
      const key = (req.params as {key:string}).key;
      if (!(LEADERBOARD_PUBLIC_BOARDS as readonly string[]).includes(key)) return notFound(req,reply);
      const body = await loadBoard(key as LeaderboardBoardKey);
      return body ? json(req,reply,body,key) : notFound(req,reply);
    });
    register("/models/:slug", async (req,reply) => {
      const body=await loadModel((req.params as {slug:string}).slug);
      return body ? json(req,reply,body,"model") : notFound(req,reply);
    });
    register("/sources", async (req,reply) => json(req,reply,await loadSources(),"sources"));
    register("/sources/:key", async (req,reply) => {
      const body=await loadSource((req.params as {key:string}).key);
      return body ? json(req,reply,body,"source") : notFound(req,reply);
    });
    register("/rules", async (req,reply) => json(req,reply,await loadRulesData(),"rules"));
  }
  app.get("/api/site/leaderboard/assets/:kind/:name", async (req,reply) => {
    const {kind,name}=req.params as {kind:string;name:string};
    if (!["model-providers","leaderboard-sources"].includes(kind) || !/^[a-zA-Z0-9_-]+\.(svg|png)$/.test(name)) return notFound(req,reply);
    try {
      const bytes=await readFile(new URL(`../public/${kind}/${name}`, import.meta.url));
      return reply.header("Cache-Control","public, max-age=86400").type(name.endsWith(".svg")?"image/svg+xml":"image/png").send(bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return notFound(req,reply);
      throw error;
    }
  });
}
