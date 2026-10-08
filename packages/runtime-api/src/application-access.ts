import {readFileSync} from 'node:fs';
import type {IncomingMessage} from 'node:http';
import type {ExternalUser} from '../../external-intelligence/src/types';

export type ApplicationRole='viewer'|'editor';
export interface ApplicationAccessPolicy {
  schemaVersion:1;
  users:Record<string,{enabled:boolean;administrator?:boolean;projects:Record<string,ApplicationRole>}>;
}
export type ApplicationPrincipal={id:string;administrator:boolean;projects:Record<string,ApplicationRole>};
const deny=(statusCode:number,code:string,message:string):never=>{throw Object.assign(new Error(message),{statusCode,code});};
export function applicationPolicyFromEnvironment():ApplicationAccessPolicy|null {
  const inline=process.env.CMENG_APP_ACCESS_POLICY_JSON,file=process.env.CMENG_APP_ACCESS_POLICY_FILE;
  if(!inline&&!file){if(process.env.CMENG_REQUIRE_APP_AUTH==='1')deny(503,'application_access_unconfigured','Application access has not been configured.');return null;}
  try{const policy=JSON.parse(inline??readFileSync(file!,'utf8'));if(!policy||typeof policy!=='object'||Array.isArray(policy))throw Error('invalid policy');return policy;}catch{return deny(503,'application_access_unavailable','Application access policy could not be loaded.');}
}

/** Application permissions are separate from read-only external assistant scopes.
 * Identity must come from the existing signature-verified identity service. */
export class ApplicationAccess {
  constructor(private policy:()=>ApplicationAccessPolicy|null,private identity:(req:IncomingMessage)=>ExternalUser,private origin:()=>string|null){}
  authenticate(req:IncomingMessage):ApplicationPrincipal|null {
    const policy=this.policy();if(!policy)return null;
    if(policy.schemaVersion!==1||!policy.users||typeof policy.users!=='object'||Array.isArray(policy.users))deny(503,'application_access_invalid','Application access policy requires review.');
    let identity:ExternalUser;try{identity=this.identity(req);}catch{return deny(401,'verified_identity_required','Sign in with your verified CMeng identity.');}
    const user=Object.hasOwn(policy.users,identity.id)?policy.users[identity.id]:undefined;
    if(user?.enabled!==true)return deny(403,'application_access_denied','This identity does not have application access.');
    if(!user.projects||typeof user.projects!=='object'||Array.isArray(user.projects)||Object.values(user.projects).some(role=>!['viewer','editor'].includes(role)))deny(503,'application_access_invalid','Application project roles require review.');
    if(!['GET','HEAD'].includes(req.method??'GET')&&(!this.origin()||req.headers.origin!==this.origin()))deny(403,'request_origin_denied','Open CMeng from its configured address before making changes.');
    return {id:identity.id,administrator:user.administrator===true,projects:user.projects};
  }
  visible(user:ApplicationPrincipal|null,id:string):boolean{return !user||user.administrator||Object.hasOwn(user.projects,id);}
  project(user:ApplicationPrincipal|null,id:string,method:string|undefined):void {
    if(!this.visible(user,id))deny(403,'project_access_denied','This project is not available to this identity.');
    if(user&&!user.administrator&&!['GET','HEAD'].includes(method??'GET')&&user.projects[id]!=='editor')deny(403,'project_write_denied','This project is read-only for this identity.');
  }
  administrator(user:ApplicationPrincipal|null):void {if(user&&!user.administrator)deny(403,'administrator_required','This operation requires an application administrator.');}
}
