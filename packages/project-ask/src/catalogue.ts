import type {AuthorityDescriptor, AuthorityProvider, AskSession, ProjectScope} from './types';

export class AskError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export class AuthorityCatalogue<C> {
  private providers = new Map<string, AuthorityProvider<C>>();
  register(provider: AuthorityProvider<C>) {
    if (this.providers.has(provider.id)) throw new Error('Duplicate authority: ' + provider.id);
    this.providers.set(provider.id, provider); return this;
  }
  available(_session?: AskSession): AuthorityDescriptor[] {
    return [...this.providers.values()].map(({produce, ...descriptor}) => descriptor);
  }
  resolve(id: string, principal: AskSession): AuthorityProvider<C> {
    const provider = this.providers.get(id);
    if (!provider) throw new AskError(422, 'authority_not_registered', 'This project analysis source is not registered.');
    return provider;
  }
}
export function resolveAskScopeType(scopeType = 'project') {
  if (scopeType !== 'project') throw new AskError(422, 'capability_not_enabled', 'Capability not enabled. Ask CMeng currently analyses one selected Project.');
}
export function assertSameScope(scope: ProjectScope, principal: AskSession, projectId: string) {
  if (scope.projectId !== projectId || scope.workspaceId !== principal.workspaceId || scope.userId !== principal.userId)
    throw new AskError(404, 'analysis_not_found', 'This analysis is not available in the current project and session.');
}
