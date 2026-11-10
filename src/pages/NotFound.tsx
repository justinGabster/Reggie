import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button, EmptyState, LinkButton } from "@/components/ui";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <EmptyState mood="confused" title={copy.notFound.title}>
      <p>{copy.notFound.body}</p>
      <LinkButton to="/" variant="primary">
        {copy.notFound.home}
      </LinkButton>
    </EmptyState>
  );
}

/** Route errorElement: keeps the top bar and lets Reggie apologize (e.g. a failed lazy chunk after a deploy). */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return (
    <EmptyState mood="sad" title={copy.notFound.crash}>
      <p>{copy.notFound.crashSub}</p>
      <Button onClick={() => window.location.reload()}>{copy.app.reload}</Button>
    </EmptyState>
  );
}
