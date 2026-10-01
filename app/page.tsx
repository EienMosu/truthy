import { APP_DESCRIPTION, APP_NAME } from "@/src/meta";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="text-4xl font-bold tracking-tight">{APP_NAME}</h1>
      <p className="text-base">{APP_DESCRIPTION}</p>
    </main>
  );
}
