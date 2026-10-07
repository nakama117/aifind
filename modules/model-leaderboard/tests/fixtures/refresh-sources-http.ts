// Network fixture for the actual CLI subprocess; unexpected external requests are rejected.
import { isMainThread } from 'node:worker_threads';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { config } from '@aihot/backend/config';
import { ANCHORS } from '../../backend/method/consensus.ts';

if (isMainThread) {
  const mock = new MockAgent();
  mock.disableNetConnect();
  setGlobalDispatcher(mock);
  config.allowPrivateNetworkFetch = true;
  const upstream = mock.get('https://livebench.ai');
  upstream.intercept({path:'/'}).reply(200, '<script src="/static/js/main.abc.js"></script>');
  upstream.intercept({path:'/static/js/main.abc.js'}).reply(200, '["2026-07-01","2026-08-01","2026-09-01"]');
  upstream.intercept({path:'/categories_2026_09_01.json'}).reply(200, JSON.stringify({Coding:['code'], 'Agentic Coding':['agent'], Language:['lang'], IF:['if'], Reasoning:['reason'], Mathematics:['math']}));
  upstream.intercept({path:'/table_2026_09_01.csv'}).reply(200,
    'Model,code,agent,lang,if,reason,math\n' + ANCHORS.slice(0,10).map((slug,i)=>[slug,...Array(6).fill(100-i)].join(',')).join('\n'));
}
