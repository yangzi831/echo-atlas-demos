export function JourneySteps({active}: {active: 1 | 2 | 3 | 4}) {
 return <ol className="journey-steps" aria-label="声音记忆旅程">{['约定','共听','留下','重返'].map((label,i)=><li key={label} aria-current={active===i+1?'step':undefined}><span>0{i+1}</span>{label}<i /></li>)}</ol>;
}
