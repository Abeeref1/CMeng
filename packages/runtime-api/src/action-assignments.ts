import type {ProjectControlState} from './project-state-types';
import {ownerDisplayState} from './action-priority';

/** T09: an owner and due date the user assigns to an action. It is a user decision
 * kept apart from the calculated owner and source due dates, keyed by the action's
 * stable identity (its id / actionId / groupId, never its wording). Additive control
 * fields only, so stored data stays readable by the previous version. */
export interface ActionAssignment{
  actionId:string;
  owner:string|null;
  dueIso:string|null;
  state:'assigned'|'cleared';
  decidedAt:string;
}

const OWNER_MAX=120;

/** Validates one request. Throws a readable error for invalid input. */
export function actionAssignmentInput(input:any,decidedAt=new Date().toISOString()):ActionAssignment{
  const actionId=typeof input?.actionId==='string'?input.actionId.trim():'';
  if(!actionId||actionId.length>1024)throw new Error('Choose the action to assign.');
  if(input.action==='clear')return {actionId,owner:null,dueIso:null,state:'cleared',decidedAt};
  if(input.owner!==undefined&&input.owner!==null&&typeof input.owner!=='string')throw new Error('Enter the owner as a name.');
  if(input.dueIso!==undefined&&input.dueIso!==null&&typeof input.dueIso!=='string')throw new Error('Enter the due date as YYYY-MM-DD.');
  const owner=typeof input.owner==='string'?input.owner.trim().replace(/\s+/g,' '):'';
  const dueIso=typeof input.dueIso==='string'?input.dueIso.trim():'';
  if(!owner&&!dueIso)throw new Error('Enter an owner name or a due date.');
  if(owner&&(owner.length>OWNER_MAX||/[<>]/.test(owner)||!ownerDisplayState(owner).named||/individual not designated|owner not set/i.test(owner)))
    throw new Error('Enter the name of the person who owns this action.');
  if(dueIso&&!(/^\d{4}-\d{2}-\d{2}$/.test(dueIso)&&Number.isFinite(Date.parse(dueIso+'T00:00:00Z'))&&new Date(dueIso+'T00:00:00Z').toISOString().slice(0,10)===dueIso))
    throw new Error('Enter a valid due date as YYYY-MM-DD.');
  return {actionId,owner:owner||null,dueIso:dueIso||null,state:'assigned',decidedAt};
}

/** Control patch for one decision. Clearing removes the current assignment (undo);
 * every decision is kept in the history. */
export function actionAssignmentPatch(controls:ProjectControlState,decision:ActionAssignment):Pick<ProjectControlState,'actionAssignments'|'actionAssignmentHistory'>{
  const current={...(controls.actionAssignments??{})};
  if(decision.state==='cleared'){
    if(!current[decision.actionId])throw new Error('This action has no assigned owner or due date to clear.');
    delete current[decision.actionId];
  }else current[decision.actionId]=decision;
  return {actionAssignments:current,actionAssignmentHistory:[...(controls.actionAssignmentHistory??[]),decision]};
}

const CLOSED=/^(closed|complete|completed|resolved|done|cancelled|withdrawn)$/i;

/** Adds the assignment to every object in a response that is that action (matched by
 * id, actionId or groupId). Calculated fields (owner, dueIso, keys) are never changed;
 * assignedOwner, assignedDueIso, assignmentState and assignedOverdue are added.
 * Overdue = assigned due date before the Data Date and the action still open; unknown
 * (null) when either date is missing. Copy on write. */
export function applyActionAssignments<T>(body:T,assignments:Record<string,ActionAssignment>|undefined,dataDateIso:string|null):T{
  if(!assignments||!Object.keys(assignments).length)return body;
  const dataDate=typeof dataDateIso==='string'&&/^\d{4}-\d{2}-\d{2}/.test(dataDateIso)?dataDateIso.slice(0,10):null;
  const memo=new Map<object,unknown>();
  const visit=(value:any,depth:number):any=>{
    if(!value||typeof value!=='object'||depth>64)return value;
    if(memo.has(value))return memo.get(value);
    memo.set(value,value);
    if(Array.isArray(value)){
      let copy:any[]|null=null;
      for(let i=0;i<value.length;i++){const next=visit(value[i],depth+1);if(next!==value[i])(copy??=value.slice())[i]=next;}
      const result=copy??value;memo.set(value,result);return result;
    }
    const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return value;
    let copy:Record<string,unknown>|null=null;
    for(const key of Object.keys(value)){const next=visit(value[key],depth+1);if(next!==value[key])(copy??={...value})[key]=next;}
    const identity=[value.id,value.actionId,value.groupId].find(id=>typeof id==='string'&&Object.hasOwn(assignments,id));
    const assigned=identity?assignments[identity]:undefined;
    if(assigned&&assigned.state==='assigned'){
      const open=!['status','state'].some(field=>typeof value[field]==='string'&&CLOSED.test(value[field]));
      Object.assign(copy??={...value},{assignmentState:'assigned',assignedOwner:assigned.owner,assignedDueIso:assigned.dueIso,
        assignedOverdue:assigned.dueIso&&dataDate?open&&assigned.dueIso<dataDate:null,assignedAt:assigned.decidedAt});
    }
    const result=copy??value;memo.set(value,result);return result;
  };
  return visit(body,0) as T;
}
