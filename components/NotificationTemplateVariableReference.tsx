type VariableRow = {
  variable: string;
  description: string;
  example?: string;
};

const COMMON_VARIABLES: VariableRow[] = [
  {
    variable: "{{requestNumber}}",
    description: "Workflow request number.",
    example: "WF-12345",
  },
  {
    variable: "{{sourceRecordLabel}}",
    description: "Generic record label. For Workflow, this is usually the request number.",
  },
  {
    variable: "{{salesOrder}}",
    description: "Best available sales order display value.",
  },
  {
    variable: "{{salesOrderNumber}}",
    description: "Full sales order number, if available.",
  },
  {
    variable: "{{salesOrderBase}}",
    description: "Normalized base sales order.",
  },
  {
    variable: "{{salesOrderDisplay}}",
    description: "Sales order display value used by the UI.",
  },
  {
    variable: "{{customerName}}",
    description: "Customer name on the Workflow request.",
  },
  {
    variable: "{{customerCode}}",
    description: "Customer code on the Workflow request.",
  },
  {
    variable: "{{poNumber}}",
    description: "PO number.",
  },
  {
    variable: "{{tapeName}}",
    description: "Tape name.",
  },
  {
    variable: "{{dueDate}}",
    description: "Workflow due date.",
  },
  {
    variable: "{{rush}}",
    description: "Rush flag value.",
  },
];

const STATUS_VARIABLES: VariableRow[] = [
  {
    variable: "{{workflowStatusLabel}}",
    description: "Current Workflow status label.",
  },
  {
    variable: "{{previousWorkflowStatusLabel}}",
    description: "Previous Workflow status label for status-change events.",
  },
  {
    variable: "{{newWorkflowStatusLabel}}",
    description: "New Workflow status label for status-change events.",
  },
  {
    variable: "{{statusEnteredAt}}",
    description: "When the record entered the current status. Used by duration rules.",
  },
  {
    variable: "{{elapsedMinutes}}",
    description: "Elapsed minutes in status. Used by duration rules.",
  },
  {
    variable: "{{durationMinutes}}",
    description: "Configured duration threshold in minutes.",
  },
  {
    variable: "{{durationHours}}",
    description: "Configured duration threshold converted to hours.",
  },
];

const ASSIGNMENT_VARIABLES: VariableRow[] = [
  {
    variable: "{{createdByName}}",
    description: "Original Workflow creator name.",
  },
  {
    variable: "{{digitizerName}}",
    description: "Current digitizer name.",
  },
  {
    variable: "{{designerName}}",
    description: "Current designer name.",
  },
  {
    variable: "{{binCode}}",
    description: "Current Bin # value.",
  },
  {
    variable: "{{actorName}}",
    description: "User who caused the event, when available.",
  },
  {
    variable: "{{actorRole}}",
    description: "Role of the user who caused the event, when available.",
  },
  {
    variable: "{{actorDepartment}}",
    description: "Department of the user who caused the event, when available.",
  },
];

const FIELD_CHANGE_VARIABLES: VariableRow[] = [
  {
    variable: "{{fieldLabel}}",
    description: "Friendly field name that changed.",
    example: "Bin #",
  },
  {
    variable: "{{previousValue}}",
    description: "Previous value of the changed field.",
  },
  {
    variable: "{{newValue}}",
    description: "New value of the changed field.",
  },
  {
    variable: "{{previousDigitizerName}}",
    description: "Previous digitizer for digitizer-change rules.",
  },
  {
    variable: "{{newDigitizerName}}",
    description: "New digitizer for digitizer-change rules.",
  },
  {
    variable: "{{previousDesignerName}}",
    description: "Previous designer for designer-change rules.",
  },
  {
    variable: "{{newDesignerName}}",
    description: "New designer for designer-change rules.",
  },
  {
    variable: "{{previousBinCode}}",
    description: "Previous Bin # for bin-change rules.",
  },
  {
    variable: "{{newBinCode}}",
    description: "New Bin # for bin-change rules.",
  },
  {
    variable: "{{previousDueDate}}",
    description: "Previous due date for due-date-change rules.",
  },
  {
    variable: "{{newDueDate}}",
    description: "New due date for due-date-change rules.",
  },
  {
    variable: "{{previousRush}}",
    description: "Previous rush value for rush-change rules.",
  },
  {
    variable: "{{newRush}}",
    description: "New rush value for rush-change rules.",
  },
];

function VariableTable({ rows }: { rows: VariableRow[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Description</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.variable}>
              <td>
                <code>{row.variable}</code>
              </td>
              <td>{row.description}</td>
              <td>{row.example || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NotificationTemplateVariableReference() {
  return (
    <details className="section-card">
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Template Variable Reference
      </summary>

      <div className="section-stack" style={{ marginTop: 12 }}>
        <div className="alert alert-info">
          Use variables in the Title Template or Message Template with double braces, like{" "}
          <code>{"{{requestNumber}}"}</code>. Variables that do not apply to the selected event
          will render blank.
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Common Workflow Variables</h3>
          <VariableTable rows={COMMON_VARIABLES} />
        </div>

        <div>
          <h3>Status / Duration Variables</h3>
          <VariableTable rows={STATUS_VARIABLES} />
        </div>

        <div>
          <h3>Assignment / Actor Variables</h3>
          <VariableTable rows={ASSIGNMENT_VARIABLES} />
        </div>

        <div>
          <h3>Field-Change Variables</h3>
          <VariableTable rows={FIELD_CHANGE_VARIABLES} />
        </div>

        <div className="muted-box">
          <strong>Example title:</strong>
          <br />
          <code>
            Workflow {"{{requestNumber}}"} {"{{fieldLabel}}"} changed from{" "}
            {"{{previousValue}}"} to {"{{newValue}}"}
          </code>
          <br />
          <br />
          <strong>Example message:</strong>
          <br />
          <code>
            {"{{actorName}}"} changed Workflow {"{{requestNumber}}"} for{" "}
            {"{{customerName}}"}.
          </code>
        </div>
      </div>
    </details>
  );
}