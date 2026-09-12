/** Per-request personal credentials. Never mutate shared environment or include these in model input. */
export function requestSettings(value: unknown, env: Record<string,string>, kind: 'ai'|'asr') {
 if(value==null)return {...env};
 if(typeof value!=='object'||Array.isArray(value))throw new Error('配置格式无效');
 const data=value as Record<string,unknown>;
 const text=(key:string,max:number)=>{const v=data[key];if(v==null)return '';if(typeof v!=='string'||v.length>max||/[\r\n\x00]/.test(v))throw new Error('配置格式无效');return v.trim();};
 const browser=data.source==='browser';
 const config:Record<string,string>=browser?{}:{...env};
 if(browser){config.BASE_URL='https://apimux.top';config.LLM_MODEL='gpt-5.6-sol';config.DASHSCOPE_REGION='beijing';}
 if(kind==='ai'){
  const key=text('apiKey',2048),model=text('model',160);
  if(key){config.OPENAI_API_KEY=key;config.BASE_URL='https://apimux.top';}
  if(model)config.LLM_MODEL=model;
 }else{
  const key=text('asrKey',2048),region=text('region',32),workspace=text('workspace',160);
  if(region&&!['beijing','singapore'].includes(region))throw new Error('配置地域无效');
  if(workspace&&!/^[a-zA-Z0-9-]+$/.test(workspace))throw new Error('工作空间无效');
  if(key){config.DASHSCOPE_API_KEY=key;config.DASHSCOPE_REGION=region||'beijing';config.DASHSCOPE_WORKSPACE_ID=workspace;config.DASHSCOPE_USE_WORKSPACE_DOMAIN='false';}
  else{if(region)config.DASHSCOPE_REGION=region;if(workspace)config.DASHSCOPE_WORKSPACE_ID=workspace;}
 }
 return config;
}
