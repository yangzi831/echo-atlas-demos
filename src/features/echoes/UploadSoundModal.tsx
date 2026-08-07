import { useEffect, useState } from 'react';

const steps = ['正在倾听', '识别声音元素', '生成标题', '保存到地图'];

type UploadSoundModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function UploadSoundModal({ isOpen, onClose }: UploadSoundModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= steps.length - 1) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 850);

    return () => window.clearInterval(timer);
  }, [isSubmitting]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStepIndex(0);
    setIsSubmitting(true);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="upload-modal" role="dialog" aria-modal="true">
        <button className="panel-close" type="button" onClick={onClose}>
          Close
        </button>
        <p className="panel-kicker">Leave an Echo</p>
        <h2>把今天的上海留给未来</h2>

        <form onSubmit={handleSubmit}>
          <label>
            <span>上传音频</span>
            <input type="file" accept="audio/*" />
          </label>
          <label>
            <span>选择或输入地点</span>
            <input type="text" placeholder="例如：苏州河某座桥下" />
          </label>
          <label>
            <span>录制时间</span>
            <input type="datetime-local" />
          </label>
          <label>
            <span>用户想留下的一句话</span>
            <textarea rows={3} placeholder="我也在这里等过雨。" />
          </label>
          <button className="submit-button" type="submit">
            提交声音
          </button>
        </form>

        {isSubmitting && (
          <ol className="upload-steps" aria-live="polite">
            {steps.map((step, index) => (
              <li
                key={step}
                className={
                  index < stepIndex
                    ? 'is-done'
                    : index === stepIndex
                      ? 'is-current'
                      : ''
                }
              >
                {step}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
