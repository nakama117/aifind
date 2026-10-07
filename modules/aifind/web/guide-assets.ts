import type { GuideContent } from '../editorial/contracts.ts';

/** Apply an async upload to the current relations, including edits made while it was pending. */
export function appendUploadedGuideAsset(current: GuideContent['assets'], assetId: string): GuideContent['assets'] {
  if (current.length >= 30 || current.some(a => a.assetId === assetId)) return current;
  return [...current, { assetId, position: current.length + 1, role: 'step', captionJa: '', altJa: '' }];
}
