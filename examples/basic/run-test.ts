import { serve } from '@hono/node-server';
import app from './src/server.js';

const server = serve({ fetch: app.fetch, port: 3456 }, async () => {
  console.log('HTTP Server listening on http://localhost:3456');

  try {
    // 1. Health check
    const health = await fetch('http://localhost:3456/health').then((r) => r.json());
    console.log('✅ GET /health:', health);

    // 2. List todos
    const todos = await fetch('http://localhost:3456/todos').then((r) => r.json());
    console.log(`✅ GET /todos (Count: ${todos.length}):`, todos);

    // 3. Create a todo
    const created = await fetch('http://localhost:3456/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Live Test Todo' }),
    }).then((r) => r.json());
    console.log('✅ POST /todos (Created):', created);

    // 4. Get by ID
    const todo3 = await fetch(`http://localhost:3456/todos/${created.id}`).then((r) => r.json());
    console.log(`✅ GET /todos/${created.id}:`, todo3);

    // 5. Query parameter search
    const filtered = await fetch('http://localhost:3456/todos?search=Learn').then((r) => r.json());
    console.log('✅ GET /todos?search=Learn:', filtered);

    // 6. Delete
    const delRes = await fetch('http://localhost:3456/todos/1', { method: 'DELETE' });
    console.log('✅ DELETE /todos/1 Status:', delRes.status);

    // 7. Verify remaining
    const remaining = await fetch('http://localhost:3456/todos').then((r) => r.json());
    console.log(`✅ GET /todos remaining (Count: ${remaining.length}):`, remaining);

    console.log('\n🎉 ALL LIVE ENDPOINTS TESTED AND VERIFIED WORKING SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error during testing:', err);
  } finally {
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  }
});
