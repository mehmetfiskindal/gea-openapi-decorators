import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { registerRoutes } from '../examples/basic/src/routes.generated.js';

describe('E2E Generated Hono Routes Execution', () => {
  const app = new Hono();
  registerRoutes(app);

  it('GET /todos should return list of todos', async () => {
    const res = await app.request('/todos');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe('Learn GeaStack');
  });

  it('GET /todos/:id should return single todo', async () => {
    const res = await app.request('/todos/1');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('1');
    expect(data.title).toBe('Learn GeaStack');
  });

  it('POST /todos should create a new todo', async () => {
    const res = await app.request('/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Todo' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('3');
    expect(data.title).toBe('New Todo');
  });

  it('DELETE /todos/:id should delete a todo', async () => {
    const res = await app.request('/todos/1', {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);
  });
});
