import {createServer} from 'node:http';
import {echoAI} from './echoAI';
import {attachContinuousASR} from './continuousASR';
import {allowedOrigin} from './origin';

export function createRelay(overrides:Record<string,string>={}){
 // Deliberately never load API credentials from process.env or files.
 const env={ALLOWED_ORIGINS:'https://yangzi831.github.io,https://echo-atlas-api.giraffetree.cn,http://127.0.0.1:5173,http://localhost:5173',MAX_ASR_SESSIONS:'12',...overrides};
 const ai=echoAI(env);
 const server=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
  if(req.headers.origin&&allowedOrigin(req,env))res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
  if(req.url==='/health'&&req.method==='GET'){res.end(JSON.stringify({ok:true,service:'echo-atlas-relay',version:1,credentials:'browser-only'}));return;}
  if(!allowedOrigin(req,env)){res.statusCode=403;res.end(JSON.stringify({error:'该站点不在允许的来源列表中。'}));return;}
  res.setHeader('Access-Control-Allow-Origin',req.headers.origin!);
  if(req.method==='OPTIONS'){
   if(req.url!=='/api/echo-ai'||req.headers['access-control-request-method']!=='POST'||String(req.headers['access-control-request-headers']||'').split(',').some(h=>h.trim()&&!['content-type'].includes(h.trim().toLowerCase()))){res.statusCode=403;res.end();return;}
   res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Max-Age','600');res.statusCode=204;res.end();return;
  }
  void ai(req,res,()=>{res.statusCode=404;res.end(JSON.stringify({error:'接口不存在。'}));});
 });
 server.requestTimeout=20000;server.headersTimeout=15000;server.maxHeadersCount=32;
 attachContinuousASR(server,env);
 return server;
}
