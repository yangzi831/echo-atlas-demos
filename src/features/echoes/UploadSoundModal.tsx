import { useEffect, useMemo, useRef, useState } from 'react';
import { CaptureVisual } from '../capture/CaptureVisual';
import { createSoundMemory, type CaptureFeatureSummary } from '../../services/capture';
import type { CapturedMemoryAssets } from '../../services/captureStorage';
import { reverseGeocodeMapTiler } from '../../services/maptiler';
import type { CaptureSource, City, SoundUnderstanding } from '../../types/sound';
import { attachSoundUnderstanding, mockAdapter, understandSound } from '../../ai-hearing';

type CaptureStage = 'idle' | 'recording' | 'review' | 'saved';

type UploadSoundModalProps = {
  isOpen: boolean;
  city: City;
  onClose: () => void;
  onCreate: (capture: CapturedMemoryAssets) => Promise<void> | void;
};

type FeatureAccumulator = {
  frames: number;
  rmsTotal: number;
  centroidTotal: number;
  activeFrames: number;
  transientFrames: number;
  continuousFrames: number;
  peak: number;
  previousRms: number;
};

const EMPTY_FEATURES: CaptureFeatureSummary = {
  rms: 0,
  peak: 0,
  frequencyCentroid: 0,
  activityDensity: 0,
  transientDensity: 0,
  continuity: 0,
};

function localIsoString(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, '0') + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
}

function formatContext(value: string) {
  const [date, time = ''] = value.split('T');
  return date.split('-').join('.') + ' · ' + time.slice(0, 5);
}

function mediaRecorderOptions() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return mimeType ? { mimeType } : undefined;
}

type GeneratedMemoryContent = {
  title: string;
  description: string;
  tags: string[];
  moods: string[];
  events: string[];
};

function timeLabel(value: string) {
  const hour = new Date(value).getHours();
  return hour < 6 ? '凌晨' : hour < 12 ? '清晨' : hour < 18 ? '午后' : '夜晚';
}

function textureLabel(value: string) {
  const key = value.split(' / ')[0].toLowerCase();
  return ({
    soft: '柔和',
    quiet: '安静',
    bright: '明亮',
    warm: '温暖',
    pulsing: '脉冲',
  } as Record<string, string>)[key] ?? key;
}

function generatedMemoryContent(
  understanding: SoundUnderstanding | undefined,
  city: City,
  placeName: string,
  recordedAt: string,
  generation: number,
): GeneratedMemoryContent {
  if (!understanding) {
    return {
      title: `${city.localName}${timeLabel(recordedAt)}的一刻`,
      description: '一段在这里留下的声音。AI 将在可用时补充更细的声音理解。',
      tags: ['现场录音'],
      moods: ['此刻'],
      events: [],
    };
  }

  const texture = textureLabel(understanding.acousticFeatures.texture);
  const titleVariants = [
    `${city.localName}${timeLabel(recordedAt)}的城市呼吸`,
    `${placeName || city.localName}的${texture}回响`,
    `${city.localName}，被听见的一刻`,
  ];
  const descriptionVariants = [
    `${understanding.semanticDescription}。这段声音呈现出${understanding.acousticFeatures.texture}的声场，像一口可以被再次召回的城市呼吸。`,
    `${understanding.semanticDescription}。AI 为它留下了${understanding.acousticFeatures.texture}的质地，以及一组关于此刻的听觉线索。`,
    `${understanding.semanticDescription}。它在${placeName || city.localName}停留片刻，留下${understanding.acousticFeatures.texture}的回响。`,
  ];
  const events = understanding.detectedEvents.map((event) => event === 'repeating acoustic changes' ? '反复变化的声响' : event);
  return {
    title: titleVariants[generation % titleVariants.length],
    description: descriptionVariants[generation % descriptionVariants.length],
    tags: [...new Set(['现场录音', ...understanding.tags])],
    moods: understanding.mood.length ? [...new Set(understanding.mood)] : ['此刻'],
    events,
  };
}

export function UploadSoundModal({ isOpen, city, onClose, onCreate }: UploadSoundModalProps) {
  const [stage, setStage] = useState<CaptureStage>('idle');
  const [features, setFeatures] = useState<CaptureFeatureSummary>(EMPTY_FEATURES);
  const [duration, setDuration] = useState(0);
  const [recordedAt, setRecordedAt] = useState(localIsoString);
  const [coordinate, setCoordinate] = useState<[number, number]>(city.center);
  const [placeName, setPlaceName] = useState(city.localName);
  const [locationCity, setLocationCity] = useState(city.localName);
  const [country, setCountry] = useState(city.country);
  const [locationStatus, setLocationStatus] = useState('将使用当前地图位置');
  const [audioBlob, setAudioBlob] = useState<Blob>();
  const [captureSource, setCaptureSource] = useState<CaptureSource>('phone');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hearingStatus, setHearingStatus] = useState<'idle' | 'analyzing' | 'ready' | 'error'>('idle');
  const [hearingResult, setHearingResult] = useState<SoundUnderstanding>();
  const [generationCount, setGenerationCount] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const animationRef = useRef(0);
  const startedAtRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const latestFeaturesRef = useRef<CaptureFeatureSummary>(EMPTY_FEATURES);
  const accumulatorRef = useRef<FeatureAccumulator | undefined>(undefined);
  const hearingRequestRef = useRef(0);

  const generatedContent = useMemo(
    () => generatedMemoryContent(hearingResult, city, placeName, recordedAt, generationCount),
    [city, generationCount, hearingResult, placeName, recordedAt],
  );

  const stopAudioGraph = () => {
    window.cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
    }
    audioContextRef.current = undefined;
  };

  const reset = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    stopAudioGraph();
    recorderRef.current = undefined;
    chunksRef.current = [];
    setStage('idle');
    setFeatures(EMPTY_FEATURES);
    latestFeaturesRef.current = EMPTY_FEATURES;
    setDuration(0);
    setRecordedAt(localIsoString());
    setCoordinate(city.center);
    setPlaceName(city.localName);
    setLocationCity(city.localName);
    setCountry(city.country);
    setLocationStatus('将使用当前地图位置');
    setAudioBlob(undefined);
    setCaptureSource('phone');
    setError('');
    setIsSaving(false);
    setHearingStatus('idle');
    setHearingResult(undefined);
    setGenerationCount(0);
    setIsRegenerating(false);
  };

  const analyseWithHearingLayer = async (blob: Blob) => {
    const requestId = hearingRequestRef.current + 1;
    hearingRequestRef.current = requestId;
    setHearingStatus('analyzing');
    setHearingResult(undefined);
    setIsRegenerating(true);
    try {
      const result = await understandSound(blob, mockAdapter);
      if (requestId !== hearingRequestRef.current) return;
      setHearingResult(result);
      setHearingStatus('ready');
    } catch {
      if (requestId !== hearingRequestRef.current) return;
      // Device-side analysis is additive. A capture can still be saved with
      // the existing live feature summary if decoding is unavailable.
      setHearingStatus('error');
    } finally {
      if (requestId === hearingRequestRef.current) setIsRegenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen) reset();
    return () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      stopAudioGraph();
    };
    // Reset only when the modal opens or the active city changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, city.id]);

  const resolveLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('定位不可用，已使用当前地图位置');
      return;
    }
    setLocationStatus('正在获取位置…');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const nextCoordinate: [number, number] = [position.coords.longitude, position.coords.latitude];
      setCoordinate(nextCoordinate);
      setLocationStatus('已获取当前位置');
      try {
        const location = await reverseGeocodeMapTiler(nextCoordinate);
        if (location) {
          setPlaceName(location.placeName);
          setLocationCity(location.city || city.localName);
          setCountry(location.country || city.country);
        } else {
          setPlaceName('当前位置');
        }
      } catch {
        setPlaceName('当前位置');
      }
    }, () => {
      setLocationStatus('未获得定位，已使用当前地图位置');
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  };

  const analyseInput = (analyser: AnalyserNode, sampleRate: number) => {
    const timeData = new Float32Array(analyser.fftSize);
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    let frameCount = 0;

    const update = () => {
      analyser.getFloatTimeDomainData(timeData);
      analyser.getByteFrequencyData(frequencyData);
      let squareTotal = 0;
      let peak = 0;
      for (const sample of timeData) {
        squareTotal += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      const rms = Math.sqrt(squareTotal / timeData.length);
      let weightedFrequency = 0;
      let magnitudeTotal = 0;
      frequencyData.forEach((magnitude, index) => {
        const normalized = magnitude / 255;
        weightedFrequency += index * sampleRate / analyser.fftSize * normalized;
        magnitudeTotal += normalized;
      });
      const frequencyCentroid = magnitudeTotal > 0 ? weightedFrequency / magnitudeTotal : 0;
      const accumulator = accumulatorRef.current;
      if (accumulator) {
        const active = rms > 0.018;
        accumulator.frames += 1;
        accumulator.rmsTotal += rms;
        accumulator.centroidTotal += frequencyCentroid;
        accumulator.activeFrames += active ? 1 : 0;
        accumulator.transientFrames += rms - accumulator.previousRms > 0.045 ? 1 : 0;
        accumulator.continuousFrames += active && Math.abs(rms - accumulator.previousRms) < 0.025 ? 1 : 0;
        accumulator.peak = Math.max(accumulator.peak, peak);
        accumulator.previousRms = rms;
        const liveFeatures: CaptureFeatureSummary = {
          rms: Math.min(1, rms * 3.2),
          peak,
          frequencyCentroid,
          activityDensity: accumulator.activeFrames / accumulator.frames,
          transientDensity: accumulator.transientFrames / accumulator.frames,
          continuity: accumulator.continuousFrames / accumulator.frames,
        };
        latestFeaturesRef.current = liveFeatures;
        if (frameCount % 3 === 0) setFeatures(liveFeatures);
      }
      setDuration((performance.now() - startedAtRef.current) / 1000);
      frameCount += 1;
      animationRef.current = window.requestAnimationFrame(update);
    };
    update();
  };

  const startRecording = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setError('这个浏览器不支持直接录音，可以选择已有音频。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext;
      const audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      const recorder = new MediaRecorder(stream, mediaRecorderOptions());
      recorderRef.current = recorder;
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      chunksRef.current = [];
      accumulatorRef.current = {
        frames: 0,
        rmsTotal: 0,
        centroidTotal: 0,
        activeFrames: 0,
        transientFrames: 0,
        continuousFrames: 0,
        peak: 0,
        previousRms: 0,
      };
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const summary = accumulatorRef.current;
        if (summary?.frames) {
          const finalFeatures: CaptureFeatureSummary = {
            rms: Math.min(1, summary.rmsTotal / summary.frames * 3.2),
            peak: summary.peak,
            frequencyCentroid: summary.centroidTotal / summary.frames,
            activityDensity: summary.activeFrames / summary.frames,
            transientDensity: summary.transientFrames / summary.frames,
            continuity: summary.continuousFrames / summary.frames,
          };
          latestFeaturesRef.current = finalFeatures;
          setFeatures(finalFeatures);
        }
        setAudioBlob(blob);
        setStage('review');
        setGenerationCount(0);
        void analyseWithHearingLayer(blob);
      };

      setRecordedAt(localIsoString());
      setCaptureSource('phone');
      setStage('recording');
      startedAtRef.current = performance.now();
      recorder.start(250);
      analyseInput(analyser, audioContext.sampleRate);
      resolveLocation();
    } catch (captureError) {
      stopAudioGraph();
      setError(captureError instanceof DOMException && captureError.name === 'NotAllowedError'
        ? '没有获得麦克风权限。你仍可以选择已有音频。'
        : '无法开始录音，请检查麦克风后重试。');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    stopAudioGraph();
  };

  const loadAudioFile = (file?: File) => {
    if (!file) return;
    setError('');
    setAudioBlob(file);
    setCaptureSource('upload');
    setRecordedAt(localIsoString());
    setDuration(1);
    const fallbackFeatures = { rms: 0.32, peak: 0.64, frequencyCentroid: 1760, activityDensity: 0.52, transientDensity: 0.16, continuity: 0.58 };
    setFeatures(fallbackFeatures);
    latestFeaturesRef.current = fallbackFeatures;
    setStage('review');
    setGenerationCount(0);
    void analyseWithHearingLayer(file);
    resolveLocation();
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => URL.revokeObjectURL(url);
  };

  const regenerate = () => {
    if (!audioBlob || isRegenerating) return;
    setGenerationCount((count) => count + 1);
    void analyseWithHearingLayer(audioBlob);
  };

  const saveMemory = async () => {
    if (!audioBlob || isSaving) return;
    setIsSaving(true);
    setError('');
    const audioUrl = URL.createObjectURL(audioBlob);
    let memory = createSoundMemory({
      city,
      coordinate,
      placeName: placeName.trim() || city.localName,
      locationCity,
      country,
      recordedAt,
      duration,
      audioUrl,
      note: generatedContent.description,
      title: generatedContent.title,
      tags: generatedContent.tags,
      moods: generatedContent.moods,
      visibility: 'private',
      locationPrivacy: 'approximate',
      features: latestFeaturesRef.current,
      captureSource,
    });
    if (hearingResult) memory = attachSoundUnderstanding(memory, hearingResult);
    try {
      await onCreate({ memory, audioBlob });
      setStage('saved');
      window.setTimeout(onClose, 720);
    } catch {
      URL.revokeObjectURL(audioUrl);
      setError('保存失败，请再试一次。');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="upload-modal capture-modal" role="dialog" aria-modal="true" aria-label="记录这里">
        <button className="panel-close" type="button" onClick={onClose} aria-label="关闭">×</button>
        <p className="panel-kicker">Capture</p>
        <h2>记录这里</h2>
        <p className="upload-context">{city.name} · {formatContext(recordedAt)}</p>

        <div className="capture-stage" data-stage={stage}>
          <div className="capture-visual-frame">
            <CaptureVisual audioFeatures={features} active={stage === 'recording'} seed={37} />
            <div className="capture-status">
              <span>{stage === 'recording' ? 'RECORDING' : stage === 'review' ? 'SOUND IMPRINT' : stage === 'saved' ? 'SAVED' : 'READY'}</span>
              <strong>{formatDuration(duration)}</strong>
            </div>
          </div>

          {stage === 'idle' && (
            <div className="capture-idle-actions">
              <button className="capture-record-button" type="button" onClick={startRecording}><span />开始录音</button>
              <label className="capture-file-fallback">选择已有音频<input type="file" accept="audio/*" onChange={(event) => loadAudioFile(event.target.files?.[0])} /></label>
            </div>
          )}

          {stage === 'recording' && (
            <button className="capture-stop-button" type="button" onClick={stopRecording}>停止</button>
          )}

          {stage === 'review' && (
            <div className="capture-review">
              <div className="capture-metadata">
                <span><small>地点</small>{placeName}</span>
                <span><small>时间</small>{formatContext(recordedAt)}</span>
                <span><small>位置</small>{locationStatus}</span>
              </div>
              <section className="ai-hearing-result" aria-live="polite" aria-label="AI Listening Result">
                <div className="ai-hearing-result-heading"><span className="panel-kicker">AI LISTENING RESULT</span><span className={`ai-hearing-status is-${hearingStatus}`}>{hearingStatus === 'analyzing' ? '正在听见…' : hearingStatus === 'ready' ? '已完成本地理解' : hearingStatus === 'error' ? '理解暂不可用' : '等待分析'}</span></div>
                {hearingStatus === 'analyzing' && <p className="ai-hearing-loading">AI Hearing Layer 正在分析声音的质地、节奏与语义印象……</p>}
                {hearingResult && <>
                  <div className="ai-memory-generated-heading"><small>AI 生成的声音记忆</small><h3>{generatedContent.title}</h3></div>
                  <p className="ai-hearing-description">{generatedContent.description}</p>
                  <div className="ai-hearing-columns"><div><small>Tags</small><p>{generatedContent.tags.join(' · ')}</p></div><div><small>Mood</small><p>{generatedContent.moods.join(' · ')}</p></div><div><small>Sound events</small><p>{generatedContent.events.length ? generatedContent.events.join(' · ') : '连续环境声'}</p></div></div>
                </>}
                {hearingStatus === 'error' && <p className="ai-hearing-loading">浏览器无法解码这段音频，将保留设备端声学特征继续保存。</p>}
              </section>
              <p className="capture-auto-save-note">标题、描述、标签、情绪和声音事件由 AI 生成 · 默认保存为私人记忆和大致位置</p>
              <div className="capture-review-actions">
                <button type="button" onClick={reset}>重新录制</button>
                <button type="button" disabled={isRegenerating || isSaving} onClick={regenerate}>{isRegenerating ? '正在生成…' : '重新生成'}</button>
                <button className="submit-button" type="button" disabled={isSaving || isRegenerating || hearingStatus === 'analyzing'} onClick={saveMemory}>{isSaving ? '正在保存…' : '保存这段记忆'}</button>
              </div>
            </div>
          )}

          {stage === 'saved' && <p className="capture-saved-message">已保存到 My Atlas</p>}
          {error && <p className="capture-error" role="alert">{error}</p>}
        </div>
      </section>
    </div>
  );
}
