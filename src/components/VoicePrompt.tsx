import { useEffect, useRef, useState } from 'react';

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoicePromptProps = {
  value: string;
  onChange: (value: string) => void;
  title: string;
  idleLabel: string;
  listeningLabel?: string;
  compact?: boolean;
  className?: string;
  hideTitle?: boolean;
};

function recognitionConstructor() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export function VoicePrompt({ value, onChange, title, idleLabel, listeningLabel = '我在听……', compact = false, className = '', hideTitle = false }: VoicePromptProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | undefined>(undefined);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setError('当前浏览器不支持语音转写，请使用文字输入。');
      setShowTextInput(true);
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
        if (transcript.trim()) onChange(transcript.trim());
      };
      recognition.onerror = (event) => {
        const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        setError(denied ? '麦克风权限未开启，请允许访问或改用文字输入。' : '这次没有听清，请再说一次或改用文字输入。');
        setShowTextInput(true);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      setError('');
      setIsListening(true);
      recognition.start();
    } catch (speechError) {
      console.warn('Speech recognition could not start.', speechError);
      setError('语音入口暂时不可用，请使用文字输入。');
      setShowTextInput(true);
      setIsListening(false);
    }
  };

  return (
    <div className={`voice-prompt ${compact ? 'is-compact' : ''} ${isListening ? 'is-listening' : ''} ${className}`.trim()}>
      {!hideTitle && <p>{title}</p>}
      <button className="voice-prompt-button" type="button" aria-pressed={isListening} onClick={toggleListening}>
        <span className="voice-mic-icon" aria-hidden="true"><i /></span>
        <span><strong>{isListening ? listeningLabel : idleLabel}</strong><small>{isListening ? '再次点击停止' : '点击开始说话'}</small></span>
      </button>
      {error && <p className="voice-prompt-error" role="alert">{error}</p>}
      <button className="voice-text-toggle" type="button" aria-expanded={showTextInput} onClick={() => setShowTextInput((current) => !current)}>
        {showTextInput ? '收起文字输入' : '也可以打字告诉我'}
      </button>
      {(showTextInput || value) && <label className="voice-text-input"><span className="sr-only">文字输入</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="说出一个地点、时刻，或你想留意的声音……" /></label>}
    </div>
  );
}
