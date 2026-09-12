import { useEffect, useRef, useState } from 'react';
import { EchoFieldCanvas } from '../ambient-visual/EchoFieldCanvas';
import { createSoundMemory, type CaptureFeatureSummary } from '../../services/capture';
import { CoListeningDecisionEngine, type AudioFeatureFrame, type ListeningDecision } from '../../services/coListeningDecision';
import { AIMemoryCard } from './AIMemoryCard';
import { reverseGeocodeMapTiler } from '../../services/maptiler';
import type { CapturedMemoryAssets } from '../../services/captureStorage';
import type { AIMemoryJudgement, City, ListeningPact } from '../../types/sound';

type CoListeningSessionProps = {
  city: City;
  pact: ListeningPact;
  onCreate: (capture: CapturedMemoryAssets) => Promise<void> | void;
  onExit: () => void;
};

type SessionStage = 'starting' | 'recording' | 'review' | 'saved' | 'error';

const emptyFeatures: CaptureFeatureSummary = {
  rms: 0,
  peak: 0,
  frequencyCentroid: 0,
  activityDensity: 0,
  transientDensity: 0,
  continuity: 0,
};

function formatDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function recorderOptions() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return mimeType ? { mimeType } : undefined;
}

export function CoListeningSession({ city, pact, onCreate, onExit }: CoListeningSessionProps) {
  const [stage, setStage] = useState<SessionStage>('starting');
  const [duration, setDuration] = useState(0);
  const [features, setFeatures] = useState(emptyFeatures);
  const [decision, setDecision] = useState<ListeningDecision>({ kind: 'baseline', shouldOfferMemory: false, reason: '准备建立环境基线……', confidence: 0.2, timestamp: Date.now() });
  const [candidate, setCandidate] = useState<ListeningDecision>();
  const [audioBlob, setAudioBlob] = useState<Blob>();
  const [audioUrl, setAudioUrl] = useState<string>();
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 19));
  const [coordinate, setCoordinate] = useState<[number, number]>(city.center);
  const [locationLabel, setLocationLabel] = useState(city.localName);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const [accepted, setAccepted] = useState(false);

  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | undefined>(undefined);
  const frameRef = useRef(0);
  const startedAtRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const latestFeaturesRef = useRef(emptyFeatures);
  const engineRef = useRef(new CoListeningDecisionEngine());
  const lastDecisionAtRef = useRef<number | undefined>(undefined);
  const activeCandidateRef = useRef(false);
  const runningRef = useRef(false);
  const finalizedRef = useRef(false);
  const finalizeReviewRef = useRef<() => void>(() => undefined);

  const stopGraph = () => {
    runningRef.current = false;
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    if (contextRef.current && contextRef.current.state !== 'closed') void contextRef.current.close();
    contextRef.current = undefined;
    analyserRef.current = undefined;
  };

  useEffect(() => {
    let disposed = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
        setError('这个浏览器不支持共同聆听的麦克风输入。');
        setStage('error');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const AudioContextClass = window.AudioContext;
        const context = new AudioContextClass();
        if (context.state === 'suspended') await context.resume();
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.72;
        context.createMediaStreamSource(stream).connect(analyser);
        const recorder = new MediaRecorder(stream, recorderOptions());
        recorderRef.current = recorder;
        streamRef.current = stream;
        contextRef.current = context;
        analyserRef.current = analyser;
        chunksRef.current = [];
        finalizedRef.current = false;
        const finalizeReview = () => {
          if (finalizedRef.current) return;
          finalizedRef.current = true;
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          setAudioBlob(blob);
          setAudioUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return URL.createObjectURL(blob);
          });
          setCandidate((current) => current ?? {
            kind: 'surprise',
            shouldOfferMemory: true,
            reason: '这一段共听已经结束，可以由你决定是否留下。',
            confidence: 0.5,
            timestamp: Date.now(),
            source: 'human-manual',
          });
          setStage('review');
        };
        finalizeReviewRef.current = finalizeReview;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          finalizeReview();
        };
        const now = new Date();
        setRecordedAt(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19));
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const nextCoordinate: [number, number] = [position.coords.longitude, position.coords.latitude];
            setCoordinate(nextCoordinate);
            setLocationLabel('当前位置');
            void reverseGeocodeMapTiler(nextCoordinate).then((location) => {
              if (location?.placeName) setLocationLabel(location.placeName);
            }).catch(() => undefined);
          }, () => undefined, { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
        }
        recorder.start(250);
        runningRef.current = true;
        startedAtRef.current = performance.now();
        setStage('recording');

        const timeData = new Float32Array(analyser.fftSize);
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        let frameCount = 0;
        const update = () => {
          if (!runningRef.current) return;
          analyser.getFloatTimeDomainData(timeData);
          analyser.getByteFrequencyData(frequencyData);
          let sumSquares = 0;
          let peak = 0;
          timeData.forEach((sample) => { sumSquares += sample * sample; peak = Math.max(peak, Math.abs(sample)); });
          const rms = Math.sqrt(sumSquares / timeData.length);
          let weighted = 0;
          let total = 0;
          let activeBins = 0;
          frequencyData.forEach((value, index) => {
            const magnitude = value / 255;
            weighted += index * context.sampleRate / analyser.fftSize * magnitude;
            total += magnitude;
            if (magnitude > 0.12) activeBins += 1;
          });
          const previous = latestFeaturesRef.current;
          const frequencyCentroid = total > 0 ? weighted / total : 0;
          const nextFeatures: CaptureFeatureSummary = {
            rms: Math.min(1, rms * 3.2),
            peak,
            frequencyCentroid,
            activityDensity: Math.min(1, activeBins / frequencyData.length * 2.3),
            transientDensity: Math.min(1, Math.max(0, rms - previous.rms / 3.2) * 13),
            continuity: rms > 0.012 ? Math.min(1, previous.continuity + 0.04) : Math.max(0, previous.continuity - 0.025),
          };
          latestFeaturesRef.current = nextFeatures;
          const frame: AudioFeatureFrame = { ...nextFeatures, spectralCentroid: frequencyCentroid, timestamp: Date.now() };
          const nextDecision = engineRef.current.observe(frame, {
            elapsedMs: performance.now() - startedAtRef.current,
            baseline: engineRef.current.getBaseline(),
            pact,
            lastDecisionAt: lastDecisionAtRef.current,
            hasActiveCandidate: activeCandidateRef.current,
          });
          if (nextDecision.shouldOfferMemory && !activeCandidateRef.current) {
            activeCandidateRef.current = true;
            lastDecisionAtRef.current = nextDecision.timestamp;
            setCandidate(nextDecision);
          }
          if (frameCount % 4 === 0) {
            setFeatures(nextFeatures);
            setDecision(nextDecision);
            setDuration((performance.now() - startedAtRef.current) / 1000);
          }
          frameCount += 1;
          frameRef.current = requestAnimationFrame(update);
        };
        update();
      } catch (captureError) {
        stopGraph();
        setError(captureError instanceof DOMException && captureError.name === 'NotAllowedError' ? '没有获得麦克风权限。' : '无法开始共同聆听，请检查麦克风后重试。');
        setStage('error');
      }
    };
    void start();
    return () => {
      disposed = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      stopGraph();
    };
    // Session starts once for the selected pact.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || finalizedRef.current) return;
    // Move to human review immediately; MediaRecorder may deliver its final
    // data/stop event later or not at all in embedded browsers.
    finalizeReviewRef.current();
    try {
      if (recorder.state === 'recording' || recorder.state === 'paused') recorder.stop();
    } catch (stopError) {
      console.warn('MediaRecorder stopped without a final event.', stopError);
    }
    stopGraph();
    setDuration((performance.now() - startedAtRef.current) / 1000);
  };

  const keepMoment = () => {
    if (candidate) setAccepted(true);
    else {
      const manualDecision: ListeningDecision = {
        kind: 'surprise',
        shouldOfferMemory: true,
        reason: '你主动要求我保留当前这一刻。',
        confidence: 1,
        timestamp: Date.now(),
        source: 'human-manual',
      };
      activeCandidateRef.current = true;
      setCandidate(manualDecision);
      setAccepted(true);
    }
  };

  const persistCandidate = async (title: string, note: string, judgement: AIMemoryJudgement) => {
    if (!audioBlob || !candidate || isSaving) return;
    setIsSaving(true);
    const audioUrlForMemory = URL.createObjectURL(audioBlob);
    const memory = createSoundMemory({
      city,
      coordinate,
      placeName: locationLabel,
      recordedAt,
      duration,
      audioUrl: audioUrlForMemory,
      note: note || candidate.reason,
      title,
      visibility: 'private',
      locationPrivacy: 'approximate',
      features: latestFeaturesRef.current,
      captureSource: 'phone',
      tags: candidate.criterionLabel ? [candidate.criterionLabel, '共同聆听'] : ['共同聆听'],
      moods: ['被注意到'],
    });
    memory.aiJudgement = judgement;
    try {
      await onCreate({ memory, audioBlob });
      setStage('saved');
    } catch {
      URL.revokeObjectURL(audioUrlForMemory);
      setError('保存失败，请稍后再试。');
      setIsSaving(false);
    }
  };

  const accept = (title: string, note: string) => {
    if (!candidate) return;
    setAccepted(true);
    void persistCandidate(title, note, {
      source: candidate.source ?? (candidate.kind === 'surprise' ? 'ai-surprise' : 'matched-intention'),
      reason: candidate.reason,
      criterionLabel: candidate.criterionLabel,
      confidence: candidate.confidence,
      reviewStatus: 'accepted',
      decidedAt: new Date().toISOString(),
    });
  };

  const correct = (nextFeedback: string) => {
    setFeedback(nextFeedback);
    if (candidate) void persistCandidate('', nextFeedback, {
      source: candidate.source ?? (candidate.kind === 'surprise' ? 'ai-surprise' : 'matched-intention'),
      reason: candidate.reason,
      criterionLabel: candidate.criterionLabel,
      confidence: candidate.confidence,
      reviewStatus: 'corrected',
      humanFeedback: nextFeedback,
      decidedAt: new Date().toISOString(),
    });
  };

  if (stage === 'error') {
    return <section className="co-listening-session co-listening-error-state"><p className="panel-kicker">LISTEN / 共听</p><h1>共同聆听没有开始</h1><p>{error}</p><div><button className="submit-button" type="button" onClick={onExit}>返回</button></div></section>;
  }

  return (
    <section className={`co-listening-session ${stage === 'recording' ? 'is-recording' : ''} ${stage === 'review' ? 'is-review' : ''}`} aria-label="共同聆听">
      <div className="co-listening-session-header"><div><p className="panel-kicker">共同聆听中</p><h1>{formatDuration(duration)}</h1></div><button type="button" onClick={onExit}>退出</button></div>
      <div className="co-listening-stage"><EchoFieldCanvas input={{ mode: stage === 'recording' ? 'listen-live' : 'listen-decision', audioFeatures: features }} /><div className="co-listening-stage-readout"><span className="live-dot" />{stage === 'recording' ? decision.reason : stage === 'review' ? '这一段已经停止，等待你的判断。' : '已保存到你的记忆。'}</div></div>
      <div className="co-listening-observation"><span>AI 正在判断</span><strong>{decision.reason}</strong><small>{engineRef.current.getBaseline() ? '本地特征正在听见音量、频率和节奏的变化' : '正在建立环境基线'}</small></div>
      <div className="co-listening-controls"><button className="submit-button" type="button" onClick={keepMoment} disabled={stage !== 'recording' || accepted}>留下这一刻</button><button type="button" onPointerDown={stopRecording} onClick={stopRecording} disabled={stage !== 'recording'}>结束共听</button></div>
      {candidate && stage === 'review' && !feedback && !accepted && <AIMemoryCard decision={candidate} audioUrl={audioUrl} duration={duration} locationLabel={locationLabel} recordedAt={recordedAt} onAccept={accept} onReject={() => { setCandidate(undefined); activeCandidateRef.current = false; }} onCorrect={correct} />}
      {accepted && stage === 'review' && <div className="co-listening-pending"><p>已标记这一刻。当前比赛版会保存本次共听会话音频，并保留触发事件时间戳。</p><button className="submit-button" type="button" onClick={() => accept('', '')}>保存这段声音</button></div>}
      {stage === 'saved' && <div className="co-listening-saved">已保存到 Memories</div>}
      {error && <p className="capture-error" role="alert">{error}</p>}
    </section>
  );
}
