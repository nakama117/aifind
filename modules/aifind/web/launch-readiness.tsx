import {useLoaderData} from 'react-router';
import {adminGet} from '@aihot/web/lib/admin.server';
import {adminHeaders,adminMeta} from './admin-common.tsx';
import type {LaunchPreflight} from '../launch/preflight.ts';
import {LaunchReadinessView} from './launch-preview.tsx';
export const headers=adminHeaders,meta=()=>adminMeta('Launch Readiness');
export function loader({request}:{request:Request}){return adminGet<LaunchPreflight>(request,'/api/admin/aifind/launch-readiness');}
export default function LaunchReadiness(){return <LaunchReadinessView data={useLoaderData<typeof loader>()}/>;}
