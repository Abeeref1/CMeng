import type {
  CanonicalScheduleModel,
  ScheduleGraphAnalysis,
  ScheduleGraphComponent,
} from "./types";

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    else seen.add(value);
  }
  return sorted(duplicate);
}

function relationshipKey(input: {
  predecessorActivityId: string;
  successorActivityId: string;
  type: string;
  lagHours: number | null;
}): string {
  return [
    input.predecessorActivityId,
    input.successorActivityId,
    input.type,
    input.lagHours === null ? "" : String(input.lagHours),
  ].join("|");
}

function stronglyConnectedCycles(
  ids: readonly string[],
  successors: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  let index = 0;
  const indexes = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cyclic = new Set<string>();

  const visit = (id: string): void => {
    indexes.set(id, index);
    low.set(id, index);
    index += 1;
    stack.push(id);
    onStack.add(id);

    for (const next of successors.get(id) ?? []) {
      if (!indexes.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id)!, low.get(next)!));
      } else if (onStack.has(next)) {
        low.set(id, Math.min(low.get(id)!, indexes.get(next)!));
      }
    }

    if (low.get(id) !== indexes.get(id)) return;

    const component: string[] = [];
    while (stack.length > 0) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === id) break;
    }

    if (component.length > 1) {
      component.forEach((member) => cyclic.add(member));
      return;
    }

    const only = component[0]!;
    if (successors.get(only)?.has(only)) cyclic.add(only);
  };

  for (const id of ids) {
    if (!indexes.has(id)) visit(id);
  }

  return cyclic;
}

function connectedComponents(
  ids: readonly string[],
  undirected: ReadonlyMap<string, ReadonlySet<string>>,
): ScheduleGraphComponent[] {
  const visited = new Set<string>();
  const components: ScheduleGraphComponent[] = [];

  for (const id of ids) {
    if (visited.has(id)) continue;
    const queue = [id];
    const members: string[] = [];
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      members.push(current);
      for (const next of undirected.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    components.push({
      componentId: components.length + 1,
      activityIds: members.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    });
  }

  return components;
}

function topologicalOrder(
  ids: readonly string[],
  predecessors: ReadonlyMap<string, ReadonlySet<string>>,
  successors: ReadonlyMap<string, ReadonlySet<string>>,
): string[] | null {
  const indegree = new Map<string, number>();
  for (const id of ids) {
    indegree.set(id, predecessors.get(id)?.size ?? 0);
  }

  const ready = ids
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const order: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);

    for (const successor of successors.get(id) ?? []) {
      const next = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, next);
      if (next === 0) {
        ready.push(successor);
        ready.sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true }),
        );
      }
    }
  }

  return order.length === ids.length ? order : null;
}

export function analyzeScheduleGraph(
  model: CanonicalScheduleModel,
): ScheduleGraphAnalysis {
  const diagnostics: string[] = [];
  const activityIds = model.activities.map((activity) => activity.activityId);
  const duplicateActivityIds = duplicates(activityIds);
  const uniqueIds = sorted(new Set(activityIds));
  const idSet = new Set(uniqueIds);

  const predecessorSets = new Map<string, Set<string>>();
  const successorSets = new Map<string, Set<string>>();
  const undirected = new Map<string, Set<string>>();

  for (const id of uniqueIds) {
    predecessorSets.set(id, new Set());
    successorSets.set(id, new Set());
    undirected.set(id, new Set());
  }

  const brokenPredecessors = new Set<string>();
  const brokenSuccessors = new Set<string>();
  const selfLoops = new Set<string>();
  const relationshipKeys: string[] = [];
  let internalRelationshipCount = 0;
  let externalRelationshipCount = 0;

  for (const relationship of model.relationships) {
    relationshipKeys.push(relationshipKey(relationship));

    if (relationship.external) {
      externalRelationshipCount += 1;
      continue;
    }

    const predecessorExists = idSet.has(relationship.predecessorActivityId);
    const successorExists = idSet.has(relationship.successorActivityId);

    if (!predecessorExists) {
      brokenPredecessors.add(relationship.predecessorActivityId);
    }
    if (!successorExists) {
      brokenSuccessors.add(relationship.successorActivityId);
    }
    if (!predecessorExists || !successorExists) continue;

    internalRelationshipCount += 1;

    if (
      relationship.predecessorActivityId ===
      relationship.successorActivityId
    ) {
      selfLoops.add(relationship.predecessorActivityId);
    }

    predecessorSets
      .get(relationship.successorActivityId)!
      .add(relationship.predecessorActivityId);
    successorSets
      .get(relationship.predecessorActivityId)!
      .add(relationship.successorActivityId);
    undirected
      .get(relationship.predecessorActivityId)!
      .add(relationship.successorActivityId);
    undirected
      .get(relationship.successorActivityId)!
      .add(relationship.predecessorActivityId);
  }

  const duplicateRelationshipKeys = duplicates(relationshipKeys);
  const cyclic = stronglyConnectedCycles(uniqueIds, successorSets);
  const components = connectedComponents(uniqueIds, undirected);
  const order = topologicalOrder(uniqueIds, predecessorSets, successorSets);

  const openStartActivityIds = uniqueIds.filter(
    (id) => (predecessorSets.get(id)?.size ?? 0) === 0,
  );
  const openFinishActivityIds = uniqueIds.filter(
    (id) => (successorSets.get(id)?.size ?? 0) === 0,
  );
  const isolatedActivityIds = uniqueIds.filter(
    (id) =>
      (predecessorSets.get(id)?.size ?? 0) === 0 &&
      (successorSets.get(id)?.size ?? 0) === 0,
  );

  if (duplicateActivityIds.length > 0) {
    diagnostics.push(
      "SCHEDULE_GRAPH_DUPLICATE_ACTIVITY_IDS:" +
        duplicateActivityIds.slice(0, 25).join(","),
    );
  }
  if (duplicateRelationshipKeys.length > 0) {
    diagnostics.push(
      "SCHEDULE_GRAPH_DUPLICATE_RELATIONSHIPS:" +
        duplicateRelationshipKeys.slice(0, 25).join(","),
    );
  }
  if (brokenPredecessors.size > 0) {
    diagnostics.push(
      "SCHEDULE_GRAPH_BROKEN_PREDECESSORS:" +
        sorted(brokenPredecessors).slice(0, 25).join(","),
    );
  }
  if (brokenSuccessors.size > 0) {
    diagnostics.push(
      "SCHEDULE_GRAPH_BROKEN_SUCCESSORS:" +
        sorted(brokenSuccessors).slice(0, 25).join(","),
    );
  }
  if (selfLoops.size > 0) {
    diagnostics.push(
      "SCHEDULE_GRAPH_SELF_LOOPS:" +
        sorted(selfLoops).slice(0, 25).join(","),
    );
  }
  if (cyclic.size > 0) {
    diagnostics.push(
      "SCHEDULE_GRAPH_CYCLES:" +
        sorted(cyclic).slice(0, 25).join(","),
    );
  }
  if (externalRelationshipCount > 0) {
    diagnostics.push(
      "SCHEDULE_GRAPH_EXTERNAL_RELATIONSHIPS:" +
        externalRelationshipCount,
    );
  }

  const complete =
    duplicateActivityIds.length === 0 &&
    duplicateRelationshipKeys.length === 0 &&
    brokenPredecessors.size === 0 &&
    brokenSuccessors.size === 0 &&
    selfLoops.size === 0 &&
    cyclic.size === 0 &&
    externalRelationshipCount === 0;

  return {
    activityCount: model.activities.length,
    relationshipCount: model.relationships.length,
    internalRelationshipCount,
    externalRelationshipCount,
    duplicateActivityIds,
    duplicateRelationshipKeys,
    brokenPredecessorActivityIds: sorted(brokenPredecessors),
    brokenSuccessorActivityIds: sorted(brokenSuccessors),
    selfLoops: sorted(selfLoops),
    cyclicActivityIds: sorted(cyclic),
    acyclic: cyclic.size === 0,
    openStartActivityIds,
    openFinishActivityIds,
    isolatedActivityIds,
    logicDensity:
      uniqueIds.length === 0
        ? null
        : Number(
            (internalRelationshipCount / uniqueIds.length).toFixed(6),
          ),
    connectedComponentCount: components.length,
    components,
    topologicalOrder: order,
    complete,
    diagnostics,
  };
}
