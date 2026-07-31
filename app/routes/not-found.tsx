import { Link } from "react-router";
import type { Route } from "./+types/not-found";
import { Button, Wordmark } from "~/components/ui";

export async function loader() {
  throw new Response("Not found", { status: 404 });
}

export function meta() {
  return [
    { title: "Not found · BreathFLOW" },
    { name: "robots", content: "noindex" },
  ];
}

export default function NotFound(_: Route.ComponentProps) {
  return (
    <main className="bf-still flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Link to="/" className="text-[var(--color-bone)]">
        <Wordmark className="text-sm" />
      </Link>
      <h1 className="font-serif text-3xl text-[var(--color-bone)]">
        This page isn&rsquo;t here
      </h1>
      <p className="max-w-sm text-[var(--color-bone-muted)]">
        The link may have moved. Your practice hasn&rsquo;t.
      </p>
      <Button to="/">Come back home</Button>
    </main>
  );
}
