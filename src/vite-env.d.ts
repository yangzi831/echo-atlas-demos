/// <reference types="vite/client" />

declare module '@amap/amap-jsapi-loader' {
  type AMapLoadOptions = {
    key: string;
    version: string;
    plugins?: string[];
  };

  const AMapLoader: {
    load(options: AMapLoadOptions): Promise<any>;
  };

  export default AMapLoader;
}
