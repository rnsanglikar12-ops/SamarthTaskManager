import { Env } from './types';
import { corsHeaders, json, withCors } from './cors';
import * as actions from './actions';

async function handleGet(url: URL, env: Env): Promise<Response> {
  const action = url.searchParams.get('action') || 'FETCH_ALL';

  if (action === 'FETCH_USERS') return json(await actions.fetchUsers(env));
  if (action === 'PING') return json(await actions.ping(env));
  return json(await actions.fetchAll(env));
}

async function handlePost(request: Request, env: Env): Promise<Response> {
  const payload = (await request.json()) as any;
  const action = payload.action;

  switch (action) {
    case 'LOGIN':
      return json(await actions.login(env, payload.username, payload.passwordHash));
    case 'CREATE_USER':
      return json(await actions.createUser(env, payload.data));
    case 'UPDATE_USER':
      return json(await actions.updateUser(env, payload.data));
    case 'DELETE_USER':
      return json(await actions.deleteUser(env, payload.username));
    case 'CHANGE_PASSWORD':
      return json(
        await actions.changePassword(env, payload.username, payload.newPasswordHash, payload.mustChangePassword)
      );
    case 'UPLOAD_PHOTO':
      return json(await actions.uploadPhoto(env, payload.base64, payload.filename));
    case 'CLEAR_ALL_TASKS':
      return json(await actions.clearAllTasks(env, payload.confirm));
    case 'SYNC_ALL_TASKS':
      return json(await actions.syncAllTasks(env, payload.records || []));
    case 'UPDATE_TASK':
      return json(await actions.updateTask(env, payload.data));
    case 'CREATE_TASK':
      return json(await actions.createTask(env, payload.data));
    case 'DELETE_TASK':
      return json(await actions.deleteTask(env, payload.id));
    default:
      return json({ status: 'error', message: 'Unknown action' });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    let response: Response;
    try {
      const url = new URL(request.url);
      response = request.method === 'POST' ? await handlePost(request, env) : await handleGet(url, env);
    } catch (err) {
      response = json({ status: 'error', message: err instanceof Error ? err.message : String(err) }, 500);
    }

    return withCors(response, request, env);
  }
};
