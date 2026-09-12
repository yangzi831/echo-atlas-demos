import {useRef,useState} from 'react';
import {readApiSettings,saveApiSettings,clearApiSettings,defaultApiSettings} from '../services/apiSettings';
import '../styles/api-settings.css';
export function ApiSettings() {
 const dialog=useRef<HTMLDialogElement>(null);
 const [settings,setSettings]=useState(defaultApiSettings);
 const [message,setMessage]=useState('');
 const field=(key:'apiKey'|'model'|'asrKey'|'workspace',label:string,placeholder:string,secret=false)=><label>{label}<input type={secret?'password':'text'} autoComplete="off" spellCheck={false} value={settings[key]} placeholder={placeholder} maxLength={secret?2048:160} onChange={event=>setSettings({...settings,[key]:event.target.value})}/></label>;
 return <>
  <button type="button" className="api-settings-trigger" title="API 设置" aria-label="打开 API 设置" onClick={()=>{setSettings(readApiSettings());setMessage('');dialog.current?.showModal();}}>⚙</button>
  <dialog ref={dialog} className="api-settings-dialog" onClick={event=>{if(event.target===dialog.current)dialog.current.close();}}>
   <form onSubmit={event=>{event.preventDefault();try{saveApiSettings(Object.fromEntries(Object.entries(settings).map(([k,v])=>[k,v.trim()])) as typeof settings);setMessage('已保存在此浏览器。新的分析请求立即使用，转写配置在下次开始聆听时生效。');}catch{setMessage('浏览器禁止本地存储，未能保存设置。');}}}>
    <div className="api-settings-heading"><h2>API 设置</h2><button type="button" aria-label="关闭 API 设置" onClick={()=>dialog.current?.close()}>×</button></div>
    <p>配置一次，下次打开自动使用。留空使用服务端默认配置。</p>
    {field('apiKey','ApiMux API Key','输入个人 ApiMux 密钥',true)}
    {field('model','分析模型','gpt-5.6-sol')}
    {field('asrKey','阿里云 DashScope API Key','输入连续转写密钥',true)}
    <label>转写地域<select value={settings.region} onChange={event=>setSettings({...settings,region:event.target.value})}><option value="">服务端默认（北京）</option><option value="beijing">北京</option><option value="singapore">新加坡</option></select></label>
    {field('workspace','Workspace ID（可选）','使用默认工作空间')}
    <p className="api-settings-note">密钥保存在当前浏览器本地，本站脚本可读取。请求时通过本站后端转发，不写入服务器配置；请在自己的设备上使用。静态 GitHub Pages 仍需配套后端。</p>
    <p role="status">{message}</p>
    <div className="api-settings-actions"><button type="button" onClick={()=>{try{clearApiSettings();setSettings({...defaultApiSettings});setMessage('已清除本地配置，将使用服务端默认配置。');}catch{setMessage('清除失败，请检查浏览器存储权限。');}}}>清除本地配置</button><button type="submit">保存配置</button></div>
   </form>
  </dialog>
 </>;
}
