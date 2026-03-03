import WorkOrderForm from "../workOrderForm";

export default function EditRepairRequestPage({ params }: { params: { id: string } }) {
  const { id } = params;

  return (
    <div style={{ padding: 16 }}>
      <h1>Edit Repair Request</h1>
      <WorkOrderForm mode="edit" id={id} />
    </div>
  );
}