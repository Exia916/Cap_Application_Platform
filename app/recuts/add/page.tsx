import RecutForm from "../RecutForm";

type AddRecutPageProps = {
  searchParams: Promise<{
    returnTo?: string;
  }>;
};

export default async function AddRecutPage({
  searchParams,
}: AddRecutPageProps) {
  const params = await searchParams;

  return <RecutForm mode="add" />;
}