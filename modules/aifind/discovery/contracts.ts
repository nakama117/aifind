import {z} from 'zod';
import {CAPABILITY_KEYS,PLATFORM_KEYS} from '../contracts.ts';

export const DISCOVERY_SORTS=['recently_verified','recently_published','name'] as const;
export const DiscoveryQuerySchema=z.strictObject({
  q:z.string().trim().transform(v=>v.normalize('NFKC').toLowerCase()).pipe(z.string().max(200).refine(v=>!v.includes('\u0000'),'NUL is not a valid search character')).default(''),
  capability:z.enum(CAPABILITY_KEYS).optional(),platform:z.enum(PLATFORM_KEYS).optional(),
  japan:z.literal('available').optional(),japanese:z.literal('usable').optional(),
  free:z.literal('true').optional(),sort:z.enum(DISCOVERY_SORTS).default('recently_verified'),
  limit:z.coerce.number().int().min(1).max(100).default(20),
  offset:z.coerce.number().int().min(0).max(1000000).default(0),
});
export type DiscoveryQuery=z.infer<typeof DiscoveryQuerySchema>;
export const capabilityLabels:Record<typeof CAPABILITY_KEYS[number],string>={text:'文章作成',image_generation:'画像生成',image_understanding:'画像理解',video_generation:'動画生成',audio:'音声',coding:'コーディング',search:'検索',research:'リサーチ',agent:'エージェント',api:'API'};
export const platformLabels:Record<typeof PLATFORM_KEYS[number],string>={web:'Web',ios:'iOS',android:'Android',windows:'Windows',macos:'macOS',linux:'Linux',browser_extension:'ブラウザー拡張'};
export const shortcutCapabilities=['text','coding','image_generation','research','audio','agent'] as const;
