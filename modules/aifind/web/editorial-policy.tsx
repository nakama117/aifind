import {SITE} from '@aihot/site';
import copy from '@aihot/site/pages/editorial-policy.md?raw';
import {prepareCopy} from '../../../apps/web/app/lib/site-copy.ts';
import {CopyPage,LegalFooterLinks} from '../../../apps/web/app/features/copy/CopyPage.tsx';
import {pageMeta} from '../../../apps/web/app/lib/seo.ts';
const policy=prepareCopy(copy);export const meta=()=>pageMeta({title:'編集方針',description:'AIFIND の出典、事実確認、実測、未確認と訂正の方針。',path:'/editorial-policy'});
export default function EditorialPolicy(){return <CopyPage doc={policy.doc} rendered={policy.rendered} eyebrow={SITE.name} footer={<LegalFooterLinks links={[{to:'/contact',label:'お問い合わせ'},{to:'/terms',label:'利用規約'},{to:'/privacy',label:'プライバシー'}]}/>}/>;}
