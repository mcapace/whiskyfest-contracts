export const dynamic = 'force-static';

/** Shown after DocuSign redirects back — no staff login required. */
export default function SigningCompletePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 font-sans text-foreground">
      <h1 className="text-xl font-semibold">Thank you</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Your signature has been submitted. You can close this window. If you have questions about your agreement,
        reply to the email from your event coordinator.
      </p>
    </main>
  );
}
