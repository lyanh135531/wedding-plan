export class TaskDependencyCycleError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Không thể thiết lập phụ thuộc: Phát hiện chu trình phụ thuộc vòng tròn giữa các công việc (A → B → A)') {
    super(message);
    this.name = 'TaskDependencyCycleError';
  }
}

export interface DependencyEdge {
  dependentTaskId: string;
  prerequisiteTaskId: string;
}

/**
 * Validates that adding a new dependency edge does NOT create a cyclic dependency.
 *
 * Invariant (AT19):
 * - If Task A depends on Task B, Task B cannot depend on Task A (directly or transitively).
 * - Self-dependency (A depends on A) is strictly rejected.
 *
 * @param existingEdges - Current dependencies in the database
 * @param newEdge - The proposed dependency to add
 */
export function validateNoDependencyCycle(
  existingEdges: DependencyEdge[],
  newEdge: DependencyEdge
): void {
  const dep = newEdge.dependentTaskId.toLowerCase().trim();
  const prereq = newEdge.prerequisiteTaskId.toLowerCase().trim();

  // 1. Self-reference check
  if (dep === prereq) {
    throw new TaskDependencyCycleError('Một công việc không thể phụ thuộc vào chính nó');
  }

  // 2. Build adjacency list: node -> array of nodes that depend on it
  // Notice: prerequisite -> dependent (prereq must finish before dependent can start)
  const adjList = new Map<string, string[]>();

  for (const edge of existingEdges) {
    const from = edge.prerequisiteTaskId.toLowerCase().trim();
    const to = edge.dependentTaskId.toLowerCase().trim();
    if (!adjList.has(from)) {
      adjList.set(from, []);
    }
    adjList.get(from)!.push(to);
  }

  // Add the proposed new edge: prereq -> dep
  if (!adjList.has(prereq)) {
    adjList.set(prereq, []);
  }
  adjList.get(prereq)!.push(dep);

  // 3. Cycle Detection using DFS 3-Coloring:
  // 0: Unvisited (White)
  // 1: In Current Recursion Stack (Gray)
  // 2: Fully Processed (Black)
  const state = new Map<string, number>();

  function dfs(node: string): boolean {
    state.set(node, 1); // Gray: currently in path

    const neighbors = adjList.get(node) || [];
    for (const next of neighbors) {
      const neighborState = state.get(next) || 0;
      if (neighborState === 1) {
        // Back-edge found -> CYCLE!
        return true;
      }
      if (neighborState === 0) {
        if (dfs(next)) return true;
      }
    }

    state.set(node, 2); // Black: visited
    return false;
  }

  // Check from every node in the graph
  const allNodes = new Set<string>();
  for (const [from, neighbors] of adjList.entries()) {
    allNodes.add(from);
    for (const n of neighbors) allNodes.add(n);
  }

  for (const node of allNodes) {
    if ((state.get(node) || 0) === 0) {
      if (dfs(node)) {
        throw new TaskDependencyCycleError();
      }
    }
  }
}

/**
 * Returns a topological sort of task IDs, or throws TaskDependencyCycleError if a cycle exists.
 */
export function getTopologicalOrder(taskIds: string[], edges: DependencyEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const id of taskIds) {
    inDegree.set(id.toLowerCase(), 0);
    adjList.set(id.toLowerCase(), []);
  }

  for (const edge of edges) {
    const from = edge.prerequisiteTaskId.toLowerCase();
    const to = edge.dependentTaskId.toLowerCase();

    if (adjList.has(from) && inDegree.has(to)) {
      adjList.get(from)!.push(to);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    const neighbors = adjList.get(node) || [];
    for (const next of neighbors) {
      const newDeg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) {
        queue.push(next);
      }
    }
  }

  if (result.length !== taskIds.length) {
    throw new TaskDependencyCycleError();
  }

  return result;
}
