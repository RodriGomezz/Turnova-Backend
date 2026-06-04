import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  userId?:   string;
  businessId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  /** Enriquece el contexto con datos que solo están disponibles post-auth */
  enrich(data: Partial<RequestContext>): void {
    const ctx = storage.getStore();
    if (ctx) Object.assign(ctx, data);
  },
};

/** Shorthand para loggear: spread directo en el meta del logger */
export function getRequestContext(): RequestContext {
  return storage.getStore() ?? { requestId: 'no-context' };
}