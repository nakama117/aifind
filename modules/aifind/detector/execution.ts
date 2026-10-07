import postgres from 'postgres';
import {config} from '@aihot/backend/config';

/** A session lock spans provider awaits without holding rows or consuming the provider's SQL pool.
 * Closing the dedicated connection releases ownership, including process/socket failure. */
export async function observationExecution<T>(id:string,run:()=>Promise<T>):Promise<T>{
  const lock=postgres(config.databaseUrl,{max:1,connect_timeout:10,onnotice:()=>{}});
  try{
    await lock`SELECT pg_advisory_lock(hashtextextended(${'af_observation_execution:'+id},0))`;
    return await run();
  }finally{await lock.end({timeout:5});}
}
