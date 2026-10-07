import {SITE} from '@aihot/site';
import {prepareCopy} from '../../../apps/web/app/lib/site-copy.ts';
import {CopyPage,LegalFooterLinks} from '../../../apps/web/app/features/copy/CopyPage.tsx';
import {pageMeta} from '../../../apps/web/app/lib/seo.ts';
const page=prepareCopy('# お問い合わせ\n\n編集主体：'+SITE.operatorDisplayName+'。\n\n訂正・権利に関する依頼は、対象ページ URL、内容と確認可能な出典を添えて[フィードバックフォーム](/feedback)からお知らせください。メールアドレスは任意です。秘密情報や不要な個人情報を送らないでください。');
export const meta=()=>pageMeta({title:'お問い合わせ',description:SITE.name+' の情報の訂正と権利に関するお問い合わせ。',path:'/contact'});
export default function Contact(){return <CopyPage doc={page.doc} rendered={page.rendered} eyebrow={SITE.name} footer={<LegalFooterLinks links={[{to:'/editorial-policy',label:'編集方針'},{to:'/privacy',label:'プライバシー'}]}/>}/>;}
