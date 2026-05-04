import { describe, it, expect, beforeEach } from 'vitest';
import {
  SupabaseMockClient,
  SupabaseQueryBuilder,
  createMockSupabaseClient,
  defaultMockData,
} from '@/__mocks__/supabase';

describe('Supabase Mock', () => {
  describe('SupabaseQueryBuilder', () => {
    let builder: SupabaseQueryBuilder<{ id: string; name: string; status: string }>;

    beforeEach(() => {
      builder = new SupabaseQueryBuilder([
        { id: '1', name: 'Test Item 1', status: 'active' },
        { id: '2', name: 'Test Item 2', status: 'inactive' },
        { id: '3', name: 'Another Test', status: 'active' },
      ]);
    });

    it('should select all columns by default', async () => {
      const result = await builder.execute();
      expect(result.data).toHaveLength(3);
    });

    it('should filter with eq', async () => {
      builder.eq('status', 'active');
      const result = await builder.execute();
      expect(result.data).toHaveLength(2);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'active' }),
        ])
      );
    });

    it('should filter with multiple conditions', async () => {
      builder.eq('status', 'active').eq('id', '1');
      const result = await builder.execute();
      expect(result.data).toHaveLength(1);
      expect((result.data as any[])[0].id).toBe('1');
    });

    it('should filter with neq', async () => {
      builder.neq('status', 'active');
      const result = await builder.execute();
      expect(result.data).toHaveLength(1);
      expect((result.data as any[])[0].status).toBe('inactive');
    });

    it('should filter with gt', async () => {
      builder.gt('id', '1');
      const result = await builder.execute();
      expect(result.data).toHaveLength(2);
    });

    it('should filter with like', async () => {
      builder.like('name', 'Test');
      const result = await builder.execute();
      // Mock like does substring match; 'Another Test' also contains 'Test' so all 3 match
      expect(result.data).toHaveLength(3);
    });

    it('should filter with in', async () => {
      builder.in('id', ['1', '3']);
      const result = await builder.execute();
      expect(result.data).toHaveLength(2);
    });

    it('should order results', async () => {
      builder.order('name', { ascending: true });
      const result = await builder.execute();
      const names = (result.data as any[]).map(item => item.name);
      expect(names).toEqual(['Another Test', 'Test Item 1', 'Test Item 2']);
    });

    it('should order descending', async () => {
      builder.order('id', { ascending: false });
      const result = await builder.execute();
      const ids = (result.data as any[]).map(item => item.id);
      expect(ids).toEqual(['3', '2', '1']);
    });

    it('should limit results', async () => {
      builder.limit(2);
      const result = await builder.execute();
      expect(result.data).toHaveLength(2);
    });

    it('should handle range for pagination', async () => {
      builder.range(1, 2);
      const result = await builder.execute();
      expect(result.data).toHaveLength(2);
      expect((result.data as any[]).map(item => item.id)).toEqual(['2', '3']);
    });

    it('should return single record', async () => {
      const result = await builder.eq('id', '2').single();
      expect(result.data).toEqual({ id: '2', name: 'Test Item 2', status: 'inactive' });
    });

    it('should return null for single with no match', async () => {
      const result = await builder.eq('id', '999').single();
      expect(result.data).toBeNull();
    });

    it('should insert new record', async () => {
      const result = await builder.insert({ id: '4', name: 'New Item', status: 'active' });
      // After insert().execute(), data contains all records including the new one
      expect(result.data).toEqual([
        { id: '1', name: 'Test Item 1', status: 'active' },
        { id: '2', name: 'Test Item 2', status: 'inactive' },
        { id: '3', name: 'Another Test', status: 'active' },
        { id: '4', name: 'New Item', status: 'active' },
      ]);
      expect(builder._data).toHaveLength(4);
    });

    it('should update records matching filter', async () => {
      const result = await builder.eq('id', '2').update({ status: 'active' }).single();
      expect(result.data).toEqual({ id: '2', name: 'Test Item 2', status: 'active' });
      expect(builder._data.find((item: any) => item.id === '2')?.status).toBe('active');
    });

    it('should delete records matching filter', async () => {
      const initialLength = builder._data.length;
      const result = await builder.eq('id', '1').delete().single();
      expect(result.data).toEqual({ id: '1', name: 'Test Item 1', status: 'active' });
      expect(builder._data).toHaveLength(initialLength - 1);
    });

    it('should handle errors gracefully', async () => {
      // Update with a filter that matches no rows should return an error
      const result = await builder.eq('id', '999').update({ status: 'active' });
      expect(result.error).toBeInstanceOf(Error);
      expect(result.data).toBeNull();
    });
  });

  describe('SupabaseMockClient', () => {
    it('should create client with default mock data', () => {
      const client = new SupabaseMockClient();
      expect(client).toBeDefined();
    });

    it('should query from table', async () => {
      const client = new SupabaseMockClient({
        testTable: [
          { id: '1', value: 'a' },
          { id: '2', value: 'b' },
        ],
      });

      const result = await client.from('testTable').eq('id', '1').single();
      expect(result.data).toEqual({ id: '1', value: 'a' });
    });

    it('should call rpc', async () => {
      const client = new SupabaseMockClient();
      const builder = client.rpc('calculate_something', { param1: 'value' });
      expect((builder as any)._rpcName).toBe('calculate_something');
      expect((builder as any)._rpcParams).toEqual({ param1: 'value' });
    });

    it('should mock auth methods', () => {
      const client = new SupabaseMockClient();

      expect(client.auth.signInWithPassword).toBeDefined();
      expect(typeof client.auth.signInWithPassword).toBe('function');
    });

    it('should mock storage', () => {
      const client = new SupabaseMockClient();

      expect(client.storage.from).toBeDefined();
    });

    it('should add custom mock data', async () => {
      const client = new SupabaseMockClient();
      client.addMockData('customers', [
        { id: 'c1', name: 'Customer 1' },
        { id: 'c2', name: 'Customer 2' },
      ]);

      const result = await client.from('customers').execute();
      expect(result.data).toHaveLength(2);
    });
  });

  describe('createMockSupabaseClient', () => {
    it('should create a fresh client instance', () => {
      const client1 = createMockSupabaseClient();
      const client2 = createMockSupabaseClient();

      expect(client1).not.toBe(client2);
    });

    it('should accept custom initial data', async () => {
      const client = createMockSupabaseClient({
        employees: [{ id: 'emp-1', name: 'Test' }],
      });

      const result = await client.from('employees').execute();
      expect(result.data).toHaveLength(1);
    });
  });

  describe('defaultMockData', () => {
    it('should have profiles table', () => {
      expect(defaultMockData.profiles).toBeDefined();
      expect(Array.isArray(defaultMockData.profiles)).toBe(true);
    });

    it('should have employees table', () => {
      expect(defaultMockData.employees).toBeDefined();
      expect(defaultMockData.employees.length).toBeGreaterThan(0);
    });

    it('should have timesheets table', () => {
      expect(defaultMockData.timesheets).toBeDefined();
    });

    it('should have leave_types with sick leave tiers', () => {
      const sickLeave = defaultMockData.leave_types.find((lt: any) => lt.name === 'Sick Leave');
      expect(sickLeave).toBeDefined();
      expect(sickLeave.payment_tiers).toHaveLength(4);
    });
  });
});
