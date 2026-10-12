import {naturalCompare} from '../../shared/src/natural-order';
import type {
  CanonicalScheduleModel,
  ScheduleActivityLogicIndex,
} from "./types";

function calculateScheduleActivityLogicIndex(
  model: CanonicalScheduleModel,
): ScheduleActivityLogicIndex {
  const byActivityId: ScheduleActivityLogicIndex["byActivityId"] = {};

  for (const activity of model.activities) {
    byActivityId[activity.activityId] = {
      activityId: activity.activityId,
      predecessorIds: [],
      successorIds: [],
      incomingRelationshipIds: [],
      outgoingRelationshipIds: [],
    };
  }

  const brokenRelationshipIds: string[] = [];

  for (const relationship of model.relationships) {
    if (relationship.external) continue;

    const predecessor =
      byActivityId[relationship.predecessorActivityId];
    const successor =
      byActivityId[relationship.successorActivityId];

    if (!predecessor || !successor) {
      brokenRelationshipIds.push(
        relationship.relationshipId,
      );
      continue;
    }

    predecessor.successorIds.push(
      relationship.successorActivityId,
    );
    predecessor.outgoingRelationshipIds.push(
      relationship.relationshipId,
    );

    successor.predecessorIds.push(
      relationship.predecessorActivityId,
    );
    successor.incomingRelationshipIds.push(
      relationship.relationshipId,
    );
  }

  for (const entry of Object.values(byActivityId)) {
    entry.predecessorIds = [
      ...new Set(entry.predecessorIds),
    ].sort((a, b) =>
      naturalCompare(a, b),
    );
    entry.successorIds = [
      ...new Set(entry.successorIds),
    ].sort((a, b) =>
      naturalCompare(a, b),
    );
    entry.incomingRelationshipIds.sort();
    entry.outgoingRelationshipIds.sort();
  }

  return {
    byActivityId,
    brokenRelationshipIds: brokenRelationshipIds.sort(),
  };
}


const activityLogicIndexCache=new WeakMap<CanonicalScheduleModel,{
  activityIds:string[];
  relationships:Array<{id:string;predecessor:string;successor:string;external:boolean}>;
  value:ScheduleActivityLogicIndex;
}>();

/** Shared relationship index for every schedule view. The cache is invalidated
 * on any in-place activity/relationship identity change and callers receive an
 * isolated copy so one consumer cannot mutate another view's topology. */
export function buildScheduleActivityLogicIndex(
  model:CanonicalScheduleModel,
  sharedReadonly=false,
):ScheduleActivityLogicIndex {
  let cached=activityLogicIndexCache.get(model);
  const valid=!!cached
    &&cached.activityIds.length===model.activities.length
    &&cached.relationships.length===model.relationships.length
    &&model.activities.every((activity,index)=>activity.activityId===cached!.activityIds[index])
    &&model.relationships.every((relationship,index)=>{
      const prior=cached!.relationships[index]!;
      return prior.id===relationship.relationshipId
        &&prior.predecessor===relationship.predecessorActivityId
        &&prior.successor===relationship.successorActivityId
        &&prior.external===relationship.external;
    });
  if(!valid){
    cached={
      activityIds:model.activities.map(activity=>activity.activityId),
      relationships:model.relationships.map(relationship=>({
        id:relationship.relationshipId,
        predecessor:relationship.predecessorActivityId,
        successor:relationship.successorActivityId,
        external:relationship.external,
      })),
      value:calculateScheduleActivityLogicIndex(model),
    };
    // Internal read-only consumers can share topology rather than allocate four
    // copies of every relationship array. Public/default callers keep isolated
    // mutable copies, and in-place source edits still invalidate the cache.
    for(const entry of Object.values(cached.value.byActivityId)){
      Object.freeze(entry.predecessorIds);Object.freeze(entry.successorIds);
      Object.freeze(entry.incomingRelationshipIds);Object.freeze(entry.outgoingRelationshipIds);Object.freeze(entry);
    }
    Object.freeze(cached.value.byActivityId);Object.freeze(cached.value.brokenRelationshipIds);Object.freeze(cached.value);
    activityLogicIndexCache.set(model,cached);
  }
  if(sharedReadonly)return cached!.value;
  return {
    byActivityId:Object.fromEntries(Object.entries(cached!.value.byActivityId).map(([id,entry])=>[id,{
      ...entry,
      predecessorIds:[...entry.predecessorIds],
      successorIds:[...entry.successorIds],
      incomingRelationshipIds:[...entry.incomingRelationshipIds],
      outgoingRelationshipIds:[...entry.outgoingRelationshipIds],
    }])),
    brokenRelationshipIds:[...cached!.value.brokenRelationshipIds],
  };
}
