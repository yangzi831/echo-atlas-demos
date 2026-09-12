import type {IncomingMessage} from 'node:http';
export function allowedOrigin(req:IncomingMessage,env:Record<string,string>):boolean{
 const origin=req.headers.origin;
 if(env.ALLOWED_ORIGINS)return !!origin&&env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()).includes(origin);
 if(!origin)return true;
 try{return new URL(origin).host===req.headers.host;}catch{return false;}
}
