import { useEffect, useRef, useState } from 'react';
import { CaptureVisual } from '../capture/CaptureVisual';
import { createSoundMemory, type CaptureFeatureSummary } from '../../services/capture';
import type { CapturedMemoryAssets } from '../../services/captureStorage';
import { reverseGeocodeMapTiler } from '../../services/maptiler';
import type { CaptureSource, City, LocationPrivacy, Visibility } from '../../types/sound';

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
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('现场录音');
  const [moods, setMoods] = useState('此刻');
  const [imageBlob, setImageBlob] = useState<Blob>();
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>('exact');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const animationRef = useRef(0);
  const startedAtRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const latestFeaturesRef = useRef<CaptureFeatureSummary>(EMPTY_FEATURES);
  const accumulatorRef = useRef<FeatureAccumulator | undefined>(undefined);

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
    setTitle('');
    setNote('');
    setTags('现场录音');
    setMoods('此刻');
    setImageBlob(undefined);
    setVisibility('private');
    setLocationPrivacy('exact');
    setError('');
    setIsSaving(false);
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
    resolveLocation();
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => URL.revokeObjectURL(url);
  };

  const saveMemory = async () => {
    if (!audioBlob || isSaving) return;
    setIsSaving(true);
    setError('');
    const audioUrl = URL.createObjectURL(audioBlob);
    const imageUrl = imageBlob ? URL.createObjectURL(imageBlob) : undefined;
    const memory = createSoundMemory({
      city,
      coordinate,
      placeName: placeName.trim() || city.localName,
      locationCity,
      country,
      recordedAt,
      duration,
      audioUrl,
      note,
      title,
      imageUrl,
      tags: tags.split(/[,，]/).map((value) => value.trim()).filter(Boolean),
      moods: moods.split(/[,，]/).map((value) => value.trim()).filter(Boolean),
      visibility,
      locationPrivacy,
      features: latestFeaturesRef.current,
      captureSource,
    });
    try {
      await onCreate({ memory, audioBlob, imageBlob });
      setStage('saved');
      window.setTimeout(onClose, 720);
    } catch {
      URL.revokeObjectURL(audioUrl);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
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
              <label className="upload-field is-note"><span>一句话</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="我刚才在黑客松录下了这里。" /></label>
              <div className="capture-review-grid">
                <label className="upload-field"><span>标题（可选）</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
                <label className="upload-field"><span>照片（可选）</span><input type="file" accept="image/*" onChange={(event) => setImageBlob(event.target.files?.[0])} /></label>
                <label className="upload-field"><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
                <label className="upload-field"><span>Moods</span><input value={moods} onChange={(event) => setMoods(event.target.value)} /></label>
                <label className="upload-field"><span>地点</span><input value={placeName} onChange={(event) => setPlaceName(event.target.value)} /></label>
                <label className="upload-field"><span>时间</span><input type="datetime-local" value={recordedAt.slice(0, 16)} onChange={(event) => setRecordedAt(event.target.value + ':00')} /></label>
              </div>
              <fieldset className="upload-choice"><legend>谁可以听</legend>
                <label><input type="radio" name="visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} />私人</label>
                <label><input type="radio" name="visibility" checked={visibility === 'followers'} onChange={() => setVisibility('followers')} />关注者</label>
                <label><input type="radio" name="visibility" checked={visibility === 'public'} onChange={() => setVisibility('public')} />公开</label>
              </fieldset>
              <fieldset className="upload-choice"><legend>位置精度</legend>
                <label><input type="radio" name="locationPrivacy" checked={locationPrivacy === 'exact'} onChange={() => setLocationPrivacy('exact')} />准确位置</label>
                <label><input type="radio" name="locationPrivacy" checked={locationPrivacy === 'approximate'} onChange={() => setLocationPrivacy('approximate')} />大致区域</label>
              </fieldset>
              <div className="capture-review-actions">
                <button type="button" onClick={reset}>重新录制</button>
                <button className="submit-button" type="button" disabled={isSaving} onClick={saveMemory}>{isSaving ? '正在保存…' : '保存这段声音'}</button>
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
