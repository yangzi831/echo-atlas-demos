export const SERVICE: string;
export class EarLink {
 constructor(callbacks: {status: (message: string, error?: boolean) => void; progress: (...args: number[]) => void; save: (blob: Blob, info?: {session: string; offset: number}) => Promise<void>; state: (state: string) => void; recover?: (blob: Blob, info: {session: string; offset: number}) => Promise<void>; liveStart?: (meta: unknown) => void; liveFrame?: (pcm: Uint8Array) => void; liveEnd?: (meta: unknown, failed?: boolean) => void});
 connect(device: any): Promise<void>;
 startLive(): void;
 stopLive(): void;
 disconnect(): void;
 auto: boolean;
}
