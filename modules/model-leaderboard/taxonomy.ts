export const LEADERBOARD_PUBLIC_BOARDS = ['overall','coding','reasoning','knowledge','professional'] as const;
export type LeaderboardBoardKey = (typeof LEADERBOARD_PUBLIC_BOARDS)[number];
export const LEADERBOARD_BOARD_LABELS: Record<LeaderboardBoardKey,string> = {overall:'総合',coding:'コーディング',reasoning:'推論',knowledge:'知識',professional:'専門業務'};
