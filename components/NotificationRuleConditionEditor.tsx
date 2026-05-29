import {
  normalizeNotificationRuleConditionConfig,
  type NotificationRuleConditionConfig,
} from "@/lib/services/notificationRuleConditionService";

type Props = {
  value: NotificationRuleConditionConfig | Record<string, any> | null | undefined;
  onChange: (next: NotificationRuleConditionConfig) => void;
  disabled?: boolean;
};

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
      {help ? <div className="field-help">{help}</div> : null}
    </div>
  );
}

export default function NotificationRuleConditionEditor({
  value,
  onChange,
  disabled,
}: Props) {
  const config = normalizeNotificationRuleConditionConfig(value);

  function update<K extends keyof NotificationRuleConditionConfig>(
    key: K,
    nextValue: NotificationRuleConditionConfig[K]
  ) {
    onChange({
      ...config,
      [key]: nextValue,
    });
  }

  function clearConditions() {
    onChange(normalizeNotificationRuleConditionConfig({}));
  }

  return (
    <details className="section-card">
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Rule Conditions
      </summary>

      <div className="section-stack" style={{ marginTop: 12 }}>
        <div className="alert alert-info">
          Conditions are optional and are combined with AND logic. If all selected conditions
          pass, the rule can fire. If any condition fails, the rule is skipped.
        </div>

        <div className="form-grid">
          <SelectField
            label="Rush"
            value={config.rush || "any"}
            onChange={(v) => update("rush", v as any)}
            disabled={disabled}
          >
            <option value="any">Any</option>
            <option value="true">Rush = Yes</option>
            <option value="false">Rush = No</option>
          </SelectField>

          <SelectField
            label="Sales Order"
            value={config.salesOrder || "any"}
            onChange={(v) => update("salesOrder", v as any)}
            disabled={disabled}
          >
            <option value="any">Any</option>
            <option value="exists">Exists</option>
            <option value="missing">Missing</option>
          </SelectField>

          <SelectField
            label="Due Date"
            value={config.dueDate || "any"}
            onChange={(v) => update("dueDate", v as any)}
            disabled={disabled}
            help="Today is evaluated in America/Chicago."
          >
            <option value="any">Any</option>
            <option value="exists">Exists</option>
            <option value="missing">Missing</option>
            <option value="before_today">Before today</option>
            <option value="today">Today</option>
            <option value="after_today">After today</option>
            <option value="on_or_before_today">Today or earlier</option>
            <option value="on_or_after_today">Today or later</option>
          </SelectField>

          <SelectField
            label="Digitizer"
            value={config.digitizer || "any"}
            onChange={(v) => update("digitizer", v as any)}
            disabled={disabled}
          >
            <option value="any">Any</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </SelectField>

          <SelectField
            label="Designer"
            value={config.designer || "any"}
            onChange={(v) => update("designer", v as any)}
            disabled={disabled}
          >
            <option value="any">Any</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </SelectField>

          <SelectField
            label="Bin #"
            value={config.bin || "any"}
            onChange={(v) => update("bin", v as any)}
            disabled={disabled}
          >
            <option value="any">Any</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </SelectField>

          <div>
            <label className="field-label">Customer Match</label>
            <select
              className="select"
              value={config.customerMode || "any"}
              onChange={(e) => update("customerMode", e.target.value as any)}
              disabled={disabled}
            >
              <option value="any">Any</option>
              <option value="equals">Equals</option>
              <option value="starts_with">Starts with</option>
              <option value="contains">Contains</option>
            </select>
          </div>

          <div>
            <label className="field-label">Customer Value</label>
            <input
              className="input"
              value={config.customerValue || ""}
              onChange={(e) => update("customerValue", e.target.value)}
              placeholder="Optional"
              disabled={disabled || !config.customerMode || config.customerMode === "any"}
            />
          </div>

          <div>
            <label className="field-label">Changed Field Condition</label>
            <select
              className="select"
              value={config.changedField || "any"}
              onChange={(e) => update("changedField", e.target.value as any)}
              disabled={disabled}
            >
              <option value="any">Any</option>
              <option value="became_blank">Became blank</option>
              <option value="was_blank">Was blank before change</option>
              <option value="changed_to">Changed to value</option>
              <option value="changed_from">Changed from value</option>
            </select>
            <div className="field-help">
              Applies to field-change events such as Bin, Due Date, Rush, Digitizer, and Designer.
            </div>
          </div>

          <div>
            <label className="field-label">Changed Field Value</label>
            <input
              className="input"
              value={config.changedFieldValue || ""}
              onChange={(e) => update("changedFieldValue", e.target.value)}
              placeholder="Required for changed to/from value"
              disabled={
                disabled ||
                !config.changedField ||
                !["changed_to", "changed_from"].includes(config.changedField)
              }
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={clearConditions}
            disabled={disabled}
          >
            Clear Conditions
          </button>
        </div>
      </div>
    </details>
  );
}