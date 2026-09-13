import {allowedOrigin} from './origin';
import { requestSettings } from './requestSettings';
import { semanticSchema, semanticInstructions, validSentences, validateSelection } from './semanticSelection';
import type { Connect } from 'vite';

import {schema,instructions} from '../src/services/aiContract';

export function echoAI(env: Record<string, string>): Connect.NextHandleFunction {
 let active = 0;
 let windowStart = Date.now();
 let requests = 0;
 return async (req, res, next) => {
  if (req.url?.split('?')[0] !== '/api/echo-ai') return next();
  const reply = (code: number, data: unknown) => {
   res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8');
   res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data));
  };
  if (req.method !== 'POST') return reply(405, {error: '请使用 POST 请求。'});
  if(!allowedOrigin(req,env))return reply(403,{error:'该站点不在允许的来源列表中。'});
  if (!req.headers['content-type']?.includes('application/json')) return reply(415, {error: '请求格式应为 JSON。'});
  let size = 0; const parts: Buffer[] = [];
  try {
   for await (const part of req) { size += part.length; if (size > 65536) return reply(413, {error: '内容太长，请缩短后重试。'}); parts.push(Buffer.from(part)); }
   const input = JSON.parse(Buffer.concat(parts).toString());
   if (!input || !['pact','moment','recall','context'].includes(input.task) || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000) return reply(400, {error: '请提供有效的任务和文字（最多 2000 字）。'});
   if (input.task === 'recall' && (!Array.isArray(input.memories) || input.memories.length > 80 || input.memories.some((m: any) => !m || typeof m.id !== 'string'))) return reply(400, {error: '记忆列表格式无效。'});
   if (input.task === 'moment' && (!input.features || typeof input.features.rms !== 'number' || !Number.isFinite(input.features.rms))) return reply(400, {error: '缺少声音特征。'});
   if (input.task === 'context' && !validSentences(input)) return reply(400, {error:'转写文字或时间戳无效。'});
   const config=requestSettings(input.credentials,env,'ai');
   delete input.credentials;
   if (!config.OPENAI_API_KEY) return reply(503, {error: '缺少 ApiMux 密钥，请在 API 设置中填写；原始录音和转写仍会保留。'});
   if (Date.now() - windowStart > 60000) {windowStart = Date.now(); requests = 0;}
   if (active >= 3 || requests >= 40) return reply(429, {error: 'AI 正忙，请稍后再试。'});
   active++; requests++;
   try {
    const base = (config.BASE_URL || 'https://apimux.top').replace(/\/+$/, '');
    const upstream = await fetch(`${base.endsWith('/v1') ? base : base + '/v1'}/responses`, {
     method: 'POST', headers: {'Content-Type':'application/json', Authorization: `Bearer ${config.OPENAI_API_KEY}`},
     signal: AbortSignal.timeout(45000),
     body: JSON.stringify({model: config.LLM_MODEL || 'gpt-5.6-sol', input: [{role:'system',content:input.task === 'context' ? semanticInstructions : instructions},{role:'user',content:JSON.stringify(input)}], max_output_tokens: input.task === 'context' ? 2200 : 1200, text:{format:{type:'json_schema',name:'echo_atlas_result',strict:true,schema:input.task === 'context' ? semanticSchema : schema}}}),
    });
    if(upstream.status===401||upstream.status===403)return reply(401,{error:'ApiMux 密钥无效或无模型权限，请检查当前 API 设置。'});
    if (!upstream.ok) return reply(upstream.status === 429 ? 429 : 502, {error: upstream.status === 429 ? 'AI 请求较多，请稍后重试。' : 'AI 服务暂时不可用，请稍后重试。'});
    const payload: any = await upstream.json();
    const output = payload.output_text ?? payload.output?.flatMap((item: any) => item.content ?? []).filter((item: any) => item.type === 'output_text').at(-1)?.text;
    let result;
    try { result = JSON.parse(output); } catch { return reply(502, {error:'AI 返回格式无效，请重试。'}); }
    if (input.task === 'context') {
      try { return reply(200, {...validateSelection(result,input.sentences),model:config.LLM_MODEL||'gpt-5.6-sol'}); } catch { return reply(502, {error:'AI 给出了无法对应原文的范围，未生成记忆，请重试。'}); }
    }
    if (!result || typeof result.title !== 'string' || typeof result.summary !== 'string' || !result.summary.trim() || !Array.isArray(result.criteria) || !result.criteria.every((x: unknown)=>typeof x==='string') || !Array.isArray(result.ids) || !result.ids.every((x: unknown)=>typeof x==='string') || typeof result.shouldKeep !== 'boolean' || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) return reply(502, {error:'AI 返回内容不完整，请重试。'});
    if (input.task === 'recall') result.ids = [...new Set(result.ids)].filter(id => input.memories.some((m: any) => m.id === id)).slice(0,4);
    reply(200, {...result, model: config.LLM_MODEL || 'gpt-5.6-sol'});
   } catch { reply(504, {error: 'AI 分析未完成，请稍后重试。'}); }
   finally { active--; }
  } catch { reply(400, {error:'请求格式无效。'}); }
 };
}
