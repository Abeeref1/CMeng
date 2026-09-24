import {naturalCompare} from '../../shared/src/natural-order';
import type {
  CanonicalScheduleModel,
  ScheduleActivityLogicIndex,
} from "./types";

export function buildScheduleActivityLogicIndex(
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
