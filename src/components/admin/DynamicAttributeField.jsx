const splitList = value => (Array.isArray(value) ? value : String(value || '').split(',')).map(item => String(item).trim()).filter(Boolean);
export default function DynamicAttributeField({ attribute, value, onChange }) {
  const label = (
    <span>
      {attribute.label}{attribute.unit ? ` (${attribute.unit})` : ''}{attribute.required ? <em>*</em> : null}
    </span>
  );
  const common = {
    value: value ?? '',
    required: Boolean(attribute.required),
    onChange: (event) => onChange(event.target.value),
    'data-required-attribute': attribute.required && !String(value ?? '').trim() ? attribute.key : undefined,
    className: 'admin-field__control',
  };

  if (attribute.type === 'boolean') {
    return <label className="admin-field">{label}<select {...common}><option value="">Choose</option><option value="Yes">Yes</option><option value="No">No</option></select></label>;
  }
  if (attribute.type === 'dropdown') {
    return <label className="admin-field">{label}<select {...common}><option value="">Choose {attribute.label.toLowerCase()}</option>{(attribute.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  }
  if (attribute.type === 'multi_select') {
    const selected = new Set(splitList(value));
    if (attribute.options?.length) {
      return (
        <fieldset className="admin-field" data-required-attribute={attribute.required && !String(value ?? '').trim() ? attribute.key : undefined} tabIndex={attribute.required ? -1 : undefined}>
          <legend>{label}</legend>
          <div className="flex flex-wrap gap-2 rounded-xl border border-[rgb(var(--app-border-rgb,234_223_213))] bg-white p-3">
            {attribute.options.map((option) => (
              <label key={option} className={`admin-flag ${selected.has(option) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={selected.has(option)} onChange={() => {
                  const next = new Set(selected);
                  if (next.has(option)) next.delete(option); else next.add(option);
                  onChange(Array.from(next).join(', '));
                }} />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    return <label className="admin-field">{label}<input {...common} placeholder="Enter comma-separated values" /></label>;
  }
  if (attribute.type === 'textarea') {
    return <label className="admin-field lg:col-span-2">{label}<textarea {...common} rows={4} /></label>;
  }
  const numeric = ['number', 'measurement', 'range'].includes(attribute.type);
  return (
    <label className="admin-field">
      {label}
      <input
        {...common}
        type={attribute.type === 'date' ? 'date' : attribute.type === 'color' ? 'text' : numeric ? 'number' : 'text'}
        min={numeric ? attribute.validation?.min : undefined}
        max={numeric ? attribute.validation?.max : undefined}
        minLength={!numeric ? attribute.validation?.minLength : undefined}
        maxLength={!numeric ? attribute.validation?.maxLength : undefined}
        placeholder={attribute.type === 'color' ? 'Example: Midnight Blue or #14213d' : ''}
      />
    </label>
  );
}
