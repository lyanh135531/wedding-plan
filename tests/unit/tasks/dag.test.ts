import { describe, it, expect } from 'vitest';
import {
  validateNoDependencyCycle,
  getTopologicalOrder,
  TaskDependencyCycleError,
  DependencyEdge,
} from '../../../src/lib/tasks/dag';

describe('Directed Acyclic Graph (DAG) & Cycle Detection (AT19)', () => {
  it('rejects self-dependency (A depends on A)', () => {
    expect(() =>
      validateNoDependencyCycle([], {
        dependentTaskId: 'task-a',
        prerequisiteTaskId: 'task-a',
      })
    ).toThrow(TaskDependencyCycleError);
  });

  it('rejects direct 2-node cycle (A -> B -> A)', () => {
    // Existing: Task B depends on Task A (A must finish before B)
    const existingEdges: DependencyEdge[] = [
      { dependentTaskId: 'task-b', prerequisiteTaskId: 'task-a' },
    ];

    // Attempting to add: Task A depends on Task B -> CYCLE!
    expect(() =>
      validateNoDependencyCycle(existingEdges, {
        dependentTaskId: 'task-a',
        prerequisiteTaskId: 'task-b',
      })
    ).toThrow(TaskDependencyCycleError);
  });

  it('rejects deep transitive cycle (A -> B -> C -> D -> A)', () => {
    const existingEdges: DependencyEdge[] = [
      { dependentTaskId: 'task-b', prerequisiteTaskId: 'task-a' },
      { dependentTaskId: 'task-c', prerequisiteTaskId: 'task-b' },
      { dependentTaskId: 'task-d', prerequisiteTaskId: 'task-c' },
    ];

    // Attempting to make Task A depend on Task D -> CYCLE!
    expect(() =>
      validateNoDependencyCycle(existingEdges, {
        dependentTaskId: 'task-a',
        prerequisiteTaskId: 'task-d',
      })
    ).toThrow(TaskDependencyCycleError);
  });

  it('allows valid acyclic branching dependencies and computes topological order', () => {
    // A -> B, A -> C, B -> D, C -> D
    const existingEdges: DependencyEdge[] = [
      { dependentTaskId: 'task-b', prerequisiteTaskId: 'task-a' },
      { dependentTaskId: 'task-c', prerequisiteTaskId: 'task-a' },
      { dependentTaskId: 'task-d', prerequisiteTaskId: 'task-b' },
    ];

    // Adding: D depends on C (valid diamond DAG)
    expect(() =>
      validateNoDependencyCycle(existingEdges, {
        dependentTaskId: 'task-d',
        prerequisiteTaskId: 'task-c',
      })
    ).not.toThrow();

    const order = getTopologicalOrder(
      ['task-a', 'task-b', 'task-c', 'task-d'],
      [...existingEdges, { dependentTaskId: 'task-d', prerequisiteTaskId: 'task-c' }]
    );

    expect(order[0]).toBe('task-a'); // Task A must be first
    expect(order[order.length - 1]).toBe('task-d'); // Task D must be last
  });
});
