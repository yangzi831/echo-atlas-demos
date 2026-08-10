type EmptyPlaceStateProps = {
  placeName: string;
  onRecord: () => void;
};

export function EmptyPlaceState({ placeName, onRecord }: EmptyPlaceStateProps) {
  return (
    <section className="empty-place-state" aria-label={`${placeName}暂无公开声音`}>
      <p>{placeName}</p>
      <h2>这里还没有太多公开声音</h2>
      <span>你可以成为第一个留下声音的人</span>
      <button type="button" onClick={onRecord}>记录这里</button>
    </section>
  );
}
