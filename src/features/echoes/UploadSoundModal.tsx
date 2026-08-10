import { useEffect, useState } from 'react';
import type { City, SoundNode } from '../../types/sound';

const steps = ['保存录音', '整理地点与时间', '加入 My Sounds'];

type UploadSoundModalProps = {
  isOpen: boolean;
  city: City;
  onClose: () => void;
  onCreate: (node: SoundNode) => void;
};

function localDateTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function wait(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function formatContext(value: string) {
  const [date, time = ''] = value.split('T');
  return `${date.split('-').join('.')} · ${time.slice(0, 5)}`;
}

export function UploadSoundModal({ isOpen, city, onClose, onCreate }: UploadSoundModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [location, setLocation] = useState('');
  const [recordedAt, setRecordedAt] = useState(localDateTimeValue);
  const [memoryText, setMemoryText] = useState('');
  const [tags, setTags] = useState('环境声, 日常');
  const [hasImage, setHasImage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocation('');
      setRecordedAt(localDateTimeValue());
      setMemoryText('');
      setTags('环境声, 日常');
      setHasImage(false);
      setIsSubmitting(false);
      setStepIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    for (let index = 0; index < steps.length; index += 1) {
      setStepIndex(index);
      await wait(520);
    }

    const place = location.trim() || `${city.localName}的一个声音地点`;
    const note = memoryText.trim() || '今天经过这里时，我停下来听了一会儿。';
    const parsedTags = tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
    const id = `user-echo-${Date.now()}`;
    const offset = (Date.now() % 7) * 0.0012;
    onCreate({
      id,
      cityId: city.id,
      city: city.localName,
      country: city.country,
      title: `《${note.slice(0, 10)}》`,
      placeName: place,
      location: place,
      recordedAt: `${recordedAt}:00`,
      memoryRelation: ['lived_here'],
      sourceType: 'user_recording',
      coordinate: [city.center[0] + offset, city.center[1] - offset * 0.6],
      density: 0.72,
      tags: parsedTags.length > 0 ? parsedTags : ['环境声'],
      moods: ['此刻', '日常'],
      contributor: 'You',
      memoryText: note,
      aiDescription: `一段来自${place}的现场录音，近处环境声与城市背景形成自然层次。`,
      echoMessage: note,
      durationSeconds: 36,
      hasImage,
      isMine: true,
      createdAt: new Date().toISOString(),
    });
    await wait(320);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="upload-modal" role="dialog" aria-modal="true" aria-label="上传声音">
        <button className="panel-close" type="button" onClick={onClose} aria-label="关闭">×</button>
        <p className="panel-kicker">New Recording</p>
        <h2>记录这里</h2>
        <p className="upload-context">{city.name} · {formatContext(recordedAt)}</p>

        <form onSubmit={handleSubmit}>
          <label className="upload-field is-audio">
            <span>录一段声音</span>
            <input type="file" accept="audio/*" />
          </label>
          <label className="upload-field is-image">
            <span>加一张照片（可选）</span>
            <input type="file" accept="image/*" onChange={(event) => setHasImage(Boolean(event.target.files?.length))} />
          </label>
          <label className="upload-field is-note">
            <span>写一句话</span>
            <textarea rows={3} value={memoryText} onChange={(event) => setMemoryText(event.target.value)} placeholder="我也在这里等过雨。" />
          </label>
          <label className="upload-field">
            <span>地点</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={`例如：${city.localName}的一条街道`} />
          </label>
          <label className="upload-field">
            <span>时间</span>
            <input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} required />
          </label>
          <label className="upload-field">
            <span>Tags</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? steps[stepIndex] : '保存这段声音'}
          </button>
        </form>

        {isSubmitting && (
          <ol className="upload-steps" aria-live="polite">
            {steps.map((step, index) => (
              <li key={step} className={index < stepIndex ? 'is-done' : index === stepIndex ? 'is-current' : ''}>
                {step}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
