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
  voiceOnly?: boolean;
  onListeningChange?: (listening: boolean) => void;
};

function recognitionConstructor() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export function VoicePrompt({ value, onChange, title, idleLabel, listeningLabel = '我在听……', compact = false, className = '', hideTitle = false, voiceOnly = false, onListeningChange }: VoicePromptProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | undefined>(undefined);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);

  useEffect(() => { onListeningChange?.(isListening); }, [isListening, onListeningChange]);
  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.stop(); }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setError(voiceOnly ? '请用 Chrome 打开，轻触麦克风后说出你的约定。' : '当前浏览器不支持语音转写，请使用文字输入。');
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
        for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
        if (transcript.trim()) onChange(transcript.trim().slice(0, 2000));
      };
      recognition.onerror = (event) => {
        const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        setError(denied ? '请允许麦克风访问，然后再试一次。' : '这次没有听清，轻触麦克风再说一次。');
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
      setError(voiceOnly ? '语音暂时不可用，请稍后轻触麦克风重试。' : '语音入口暂时不可用，请使用文字输入。');
      setShowTextInput(true);
      setIsListening(false);
    }
  };

  return (
    <div className={`voice-prompt ${voiceOnly ? 'is-voice-only' : ''} ${compact ? 'is-compact' : ''} ${isListening ? 'is-listening' : ''} ${className}`.trim()}>
      {!hideTitle && <p>{title}</p>}
      <button className="voice-prompt-button" type="button" aria-pressed={isListening} onClick={toggleListening}>
        <span className="voice-mic-icon" aria-hidden="true"><i /></span>
        <span><strong>{isListening ? listeningLabel : voiceOnly && value ? '再说一次，更新约定' : idleLabel}</strong><small>{isListening ? (voiceOnly ? '说完会自动结束 · 也可轻触停止' : '再次点击停止') : (voiceOnly ? '轻触，说出你想留住的声音' : '点击开始说话')}</small></span>
      </button>
      {error && <p className="voice-prompt-error" role="alert">{error}</p>}
      {!voiceOnly && <button className="voice-text-toggle" type="button" aria-expanded={showTextInput} onClick={() => setShowTextInput((current) => !current)}>
        {showTextInput ? (value ? '完成编辑' : '收起文字输入') : value ? '编辑这段文字' : '也可以打字告诉我'}
      </button>}
      {!voiceOnly && (showTextInput || value || isListening) && <label className="voice-text-input"><span className="voice-input-caption">{isListening ? '正在转写 · 说完后点击麦克风结束' : '你想记住的声音'}</span><textarea aria-label="文字输入" rows={3} maxLength={2000} readOnly={isListening || (!showTextInput && Boolean(value))} value={value} onChange={(event) => onChange(event.target.value)} placeholder={isListening ? '我在听，你说的话会显示在这里……' : '说出一个地点、时刻，或你想留意的声音……'} /></label>}
      {voiceOnly && <div className="voice-floating-transcript" aria-live="polite" aria-atomic="true">
        <p className={isListening ? 'is-interim' : ''}>{value ? `“${value}”` : isListening ? '声音正慢慢成为文字…' : '不必组织语言，随意说说。'}</p>
        {value && !isListening && !error && <small>就按这段话，一起听。</small>}
      </div>}
    </div>
  );
}
