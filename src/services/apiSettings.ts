export type ApiSettings = {apiKey: string; model: string; asrKey: string; region: string; workspace: string};
const storageKey = 'echo-atlas-api-settings-v1';
export const defaultApiSettings: ApiSettings = {apiKey:'',model:'',asrKey:'',region:'',workspace:''};
export function readApiSettings(): ApiSettings {
 try { const data=JSON.parse(localStorage.getItem(storageKey)||'{}'); return Object.fromEntries(Object.keys(defaultApiSettings).map(key=>[key,typeof data?.[key]==='string'?data[key]:''])) as ApiSettings; } catch {return {...defaultApiSettings};}
}
export function saveApiSettings(settings: ApiSettings) {localStorage.setItem(storageKey,JSON.stringify(settings));}
export function clearApiSettings() {localStorage.removeItem(storageKey);}
export function hasApiSettings() {try{return localStorage.getItem(storageKey)!==null;}catch{return false;}}
export function aiSettings() {const {apiKey,model}=readApiSettings();return {source:'browser',apiKey,model};}
export function asrSettings() {const {asrKey,region,workspace}=readApiSettings();return {source:'browser',asrKey,region,workspace};}
