// Supabase.js mock for Vitest
// This mock replicates the Supabase client API for testing without hitting real DB

import { vi } from 'vitest';

export type SupabaseFilter = {
  column: string;
  operator: string;
  value: any;
};

export type SupabaseOrder = {
  column: string;
  ascending?: boolean;
  foreignTable?: string;
};

export type SupabaseSelectQuery = {
  _select: string[];
  _filters: SupabaseFilter[];
  _orders: SupabaseOrder[];
  _limit: number | null;
  _offset: number | null;
  _range: [number, number] | null;
  _count?: 'exact' | 'planned' | null;
  _single?: boolean;
  _maybeSingle?: boolean;
};

export type SupabaseInsertResult = {
  data: any | null;
  error: Error | null;
};

export type SupabaseQueryResult<T = any> = {
  data: T | null;
  error: Error | null;
  count: number | null;
  status: number;
  statusText: string;
};

export class SupabaseQueryBuilder<T = any> {
  private _select: string[] = ['*'];
  private _filters: SupabaseFilter[] = [];
  private _orders: SupabaseOrder[] = [];
  private _limit: number | null = null;
  private _offset: number | null = null;
  private _range: [number, number] | null = null;
  private _count: 'exact' | 'planned' | null = null;
  private _single = false;
  private _maybeSingle = false;
  private _data: T[] = [];
  private _error: Error | null = null;
  private _pendingInsert: Partial<T> | null = null;
  private _insertError: { message: string } | null = null;

  constructor(initialData: T[] = []) {
    this._data = [...initialData];
  }

  select(columns: string | string[]): this {
    this._select = typeof columns === 'string' ? columns.split(',').map(c => c.trim()) : columns;
    return this;
  }

  eq(column: string, value: any): this {
    this._filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: any): this {
    this._filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: any): this {
    this._filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: any): this {
    this._filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: any): this {
    this._filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: any): this {
    this._filters.push({ column, operator: 'lte', value });
    return this;
  }

  like(column: string, pattern: string): this {
    this._filters.push({ column, operator: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this._filters.push({ column, operator: 'ilike', value: pattern });
    return this;
  }

  is(column: string, value: any): this {
    this._filters.push({ column, operator: 'is', value });
    return this;
  }

  in(column: string, values: any[]): this {
    this._filters.push({ column, operator: 'in', value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; foreignTable?: string }): this {
    this._orders.push({ column, ascending: options?.ascending, foreignTable: options?.foreignTable });
    return this;
  }

  limit(count: number): this {
    this._limit = count;
    return this;
  }

  offset(count: number): this {
    this._offset = count;
    return this;
  }

  range(from: number, to: number): this {
    this._range = [from, to];
    return this;
  }

  count(option: 'exact' | 'planned' = 'exact'): this {
    this._count = option;
    return this;
  }

  single(): Promise<SupabaseQueryResult<T>> {
    this._single = true;
    return this.execute();
  }

  maybeSingle(): Promise<SupabaseQueryResult<T>> {
    this._maybeSingle = true;
    return this.execute();
  }

  // Apply filters to data
  private applyFilters(data: T[]): T[] {
    return data.filter(item => {
      for (const filter of this._filters) {
        const itemValue = (item as any)[filter.column];
        switch (filter.operator) {
          case 'eq':
            if (itemValue !== filter.value) return false;
            break;
          case 'neq':
            if (itemValue === filter.value) return false;
            break;
          case 'gt':
            if (itemValue <= filter.value) return false;
            break;
          case 'gte':
            if (itemValue < filter.value) return false;
            break;
          case 'lt':
            if (itemValue >= filter.value) return false;
            break;
          case 'lte':
            if (itemValue > filter.value) return false;
            break;
          case 'like':
            if (typeof itemValue !== 'string' || !itemValue.includes(filter.value.replace('%', ''))) return false;
            break;
          case 'ilike':
            if (typeof itemValue !== 'string' || !itemValue.toLowerCase().includes(filter.value.replace('%', '').toLowerCase())) return false;
            break;
          case 'is':
            if (filter.value === null) {
              if (itemValue !== null) return false;
            } else if (filter.value === 'not') {
              if (itemValue === null) return false;
            }
            break;
          case 'in':
            if (!filter.value.includes(itemValue)) return false;
            break;
        }
      }
      return true;
    });
  }

  // Apply ordering
  private applyOrder(data: T[]): T[] {
    const sorted = [...data];
    for (const order of this._orders) {
      sorted.sort((a, b) => {
        const aVal = (a as any)[order.column];
        const bVal = (b as any)[order.column];
        if (aVal === bVal) return 0;
        if (order.ascending === false) {
          return aVal > bVal ? -1 : 1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }
    return sorted;
  }

  // Apply pagination
  private applyPagination(data: T[]): T[] {
    let result = data;
    if (this._range) {
      const [from, to] = this._range;
      result = result.slice(from, to + 1);
    } else if (this._limit !== null) {
      const start = this._offset || 0;
      result = result.slice(start, start + this._limit);
    }
    return result;
  }

  // Execute query (returns promise to match Supabase API)
  async execute(): Promise<SupabaseQueryResult<T>> {
    try {
      // Handle insert error simulation
      if (this._insertError) {
        return {
          data: null,
          error: this._insertError,
          count: null,
          status: 500,
          statusText: 'Internal Server Error',
        };
      }

      // Apply pending operations in order
      if (this._pendingInsert) {
        const newItem = {
          ...this._pendingInsert,
          id: (this._pendingInsert as any).id ||
              'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/[x]/g, () =>
                Math.floor(Math.random() * 16).toString(16)
              ),
        } as T;
        this._data.push(newItem);
        this._pendingInsert = null;
      }

      if (this._pendingUpsert) {
        const { values, options } = this._pendingUpsert as any;
        const conflictKey = options?.onConflict || 'id';
        const existingIndex = this._data.findIndex((item: any) => item[conflictKey] === values[conflictKey]);
        if (existingIndex >= 0) {
          this._data[existingIndex] = { ...this._data[existingIndex], ...values } as T;
        } else {
          this._data.push({ ...values } as T);
        }
        this._pendingUpsert = null;
      }

      if (this._pendingUpdate) {
        const filters = this._filters;
        const targetIdx = this._data.findIndex((item) =>
          filters.every((f) => (item as any)[f.column] === f.value)
        );
        if (targetIdx >= 0) {
          this._data[targetIdx] = { ...this._data[targetIdx], ...this._pendingUpdate } as T;
        } else {
          return { data: null, error: new Error('No rows updated'), status: 500, statusText: 'Error' };
        }
        this._pendingUpdate = null;
      }

      if (this._pendingDelete) {
        const filters = this._filters;
        // Find items matching filters (to be deleted)
        const itemsToDelete = this._data.filter(item =>
          filters.every(f => (item as any)[f.column] === f.value)
        );
        if (itemsToDelete.length === 0) {
          return {
            data: null,
            error: new Error('No rows to delete'),
            count: null,
            status: 500,
            statusText: 'Error',
          };
        }
        // Remove them from _data (delete in reverse order to preserve indices)
        const deleteIndices: number[] = [];
        this._data.forEach((item, idx) => {
          if (filters.every(f => (item as any)[f.column] === f.value)) {
            deleteIndices.push(idx);
          }
        });
        for (let i = deleteIndices.length - 1; i >= 0; i--) {
          this._data.splice(deleteIndices[i], 1);
        }
        this._pendingDelete = false;

        // Determine return data based on single/maybeSingle
        let finalData = itemsToDelete;
        if (this._single) {
          finalData = itemsToDelete[0] || null;
        } else if (this._maybeSingle) {
          finalData = itemsToDelete.length === 1 ? itemsToDelete[0] : itemsToDelete.length > 1 ? itemsToDelete[0] : null;
        } else {
          // Apply order/limit/range to deleted items if specified? Typically delete doesn't use these,
          // but we can apply ordering for consistency
          if (this._orders.length > 0) {
            const sorted = [...itemsToDelete];
            for (const order of this._orders) {
              sorted.sort((a, b) => {
                const aVal = (a as any)[order.column];
                const bVal = (b as any)[order.column];
                if (aVal === bVal) return 0;
                return order.ascending === false ? (aVal > bVal ? -1 : 1) : (aVal > bVal ? 1 : -1);
              });
            }
            finalData = sorted;
          }
          if (this._limit !== null) {
            const start = this._offset || 0;
            finalData = (finalData as any[]).slice(start, start + this._limit);
          } else if (this._range) {
            const [from, to] = this._range;
            finalData = (finalData as any[]).slice(from, to + 1);
          }
        }

        return {
          data: finalData,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        };
      }

      // Now apply filters/orders to the current data state
      let result = this.applyFilters(this._data);
      result = this.applyOrder(result);

      const totalCount = this._count ? result.length : null;

      result = this.applyPagination(result);

      let finalResult = result;
      if (this._single) {
        finalResult = result[0] || null;
      } else if (this._maybeSingle) {
        finalResult = result.length === 1 ? result[0] : result.length > 1 ? result[0] : null;
      }

      return {
        data: finalResult,
        error: null,
        count: totalCount,
        status: 200,
        statusText: 'OK',
      };
    } catch (err) {
      return {
        data: null,
        error: err as Error,
        count: null,
        status: 500,
        statusText: 'Internal Server Error',
      };
    }
  }

  // Make the builder thenable so it can be awaited directly (like real Supabase)
  then<TResult1 = SupabaseQueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseQueryResult<T>) => TResult1 | Promise<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  // For chained inserts - stores values to be applied on execute()
  insert(values: Partial<T>): this {
    this._pendingInsert = values;
    return this;
  }

  // Allow tests to simulate insert error
  _setInsertError(error: { message: string }): void {
    this._insertError = error;
  }

  upsert(values: Partial<T>): this {
    this._pendingUpsert = values;
    return this;
  }

  update(values: Partial<T>): this {
    this._pendingUpdate = values;
    return this;
  }

  delete(): this {
    this._pendingDelete = true;
    return this;
  }

  private _pendingUpsert: Partial<T> | null = null;
  private _pendingUpdate: Partial<T> | null = null;
  private _pendingDelete = false;
}

export class SupabaseMockClient {
  private tables: Map<string, SupabaseQueryBuilder[]> = new Map();
  private insertErrors: Map<string, { message: string }> = new Map();

  constructor(private mockData: Record<string, any[]> = {}) {
    // Initialize tables with mock data
    for (const [tableName, data] of Object.entries(mockData)) {
      this.tables.set(tableName, [new SupabaseQueryBuilder(data)]);
    }
  }

  from<T = any>(tableName: string): SupabaseQueryBuilder<T> {
    let builder = this.tables.get(tableName)?.[0];
    if (!builder) {
      builder = new SupabaseQueryBuilder<T>([]);
      this.tables.set(tableName, [builder as SupabaseQueryBuilder]);
    }
    // Return a fresh query builder each time, copying data and insertError
    const freshBuilder = new SupabaseQueryBuilder<T>((builder as SupabaseQueryBuilder<any>)._data);
    if (this.insertErrors.has(tableName)) {
      freshBuilder._setInsertError(this.insertErrors.get(tableName)!);
    }
    (this.tables.get(tableName) as SupabaseQueryBuilder[])[0] = freshBuilder;
    return freshBuilder as SupabaseQueryBuilder<T>;
  }

  rpc<T = any>(fnName: string, params?: Record<string, any>): SupabaseQueryBuilder<T> {
    const builder = new SupabaseQueryBuilder<T>([]);
    // Store the function name for testing
    (builder as any)._rpcName = fnName;
    (builder as any)._rpcParams = params;
    return builder as SupabaseQueryBuilder<T>;
  }

  channel() {
    return {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    };
  }

  // Helper to add mock data to a table
  addMockData(tableName: string, data: any[]): void {
    const builder = new SupabaseQueryBuilder(data);
    this.tables.set(tableName, [builder]);
  }

  // Helper to set an insert error on a table's builder (for testing)
  setInsertErrorForTable(tableName: string, errorMessage: string): void {
    this.insertErrors.set(tableName, { message: errorMessage });
  }

  // Helper to get mock data for assertions
  getMockData(tableName: string): any[] {
    return this.tables.get(tableName)?.[0]?._data || [];
  }

  // Auth methods mock
  auth = {
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@example.com' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@example.com' } }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-123' } } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    confirmSignUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
  };

  // Storage mock
  storage = {
    from: () => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'file.jpg' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ publicURL: 'https://bucket.supabase.co/file.jpg' }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };
}

// Factory function to create mock Supabase client
export function createMockSupabaseClient(mockData: Record<string, any[]> = {}): SupabaseMockClient {
  return new SupabaseMockClient(mockData);
}

// Export for use in test files
export const mockSupabase = new SupabaseMockClient();

// Default mock data for common tables
export const defaultMockData = {
  profiles: [
    { id: 'user-123', email: 'test@example.com', full_name: 'Test User', role: 'admin', company_id: 'comp-1', is_active: true },
    { id: 'user-456', email: 'employee@example.com', full_name: 'Employee User', role: 'employee', company_id: 'comp-1', is_active: true },
  ],
  employees: [
    { id: 'emp-1', emp_code: '001', name_en: 'Ahmed Al Balushi', email: 'ahmed@company.com', basic_salary: 500, join_date: '2024-01-01', status: 'active' },
    { id: 'emp-2', emp_code: '002', name_en: 'Mohammed Al Harrasi', email: 'mohammed@company.com', basic_salary: 600, join_date: '2023-06-15', status: 'active' },
  ],
  timesheets: [
    { id: 'ts-1', employee_id: 'emp-1', date: '2025-05-01', day_type: 'working_day', hours_worked: 8, overtime_hours: 0, project_id: 'proj-1', company_id: 'comp-1' },
    { id: 'ts-2', employee_id: 'emp-1', date: '2025-05-02', day_type: 'working_day', hours_worked: 8, overtime_hours: 2, project_id: 'proj-1', company_id: 'comp-1' },
  ],
  company_members: [
    { user_id: 'user-123', company_id: 'comp-1', role: 'admin' },
    { user_id: 'user-456', company_id: 'comp-1', role: 'member' },
  ],
  leave_types: [
    { id: 'lt-1', name: 'Annual Leave', is_paid: true, max_days: 30, payment_tiers: [] },
    { id: 'lt-2', name: 'Sick Leave', is_paid: true, max_days: 182, payment_tiers: [
      { min_day: 1, max_day: 21, percentage: 1.0 },
      { min_day: 22, max_day: 35, percentage: 0.75 },
      { min_day: 36, max_day: 70, percentage: 0.50 },
      { min_day: 71, max_day: 182, percentage: 0.35 },
    ]},
  ],
  leaves: [],
  loans: [],
  loan_repayments: [],
  salary_revisions: [],
  projects: [
    { id: 'proj-1', name: 'Main Project', company_id: 'comp-1' },
  ],
};
