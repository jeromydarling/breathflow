/**
 * Form parsing that degrades instead of exploding.
 *
 * `request.formData()` throws a TypeError when a POST arrives without a
 * Content-Type header — which a browser form never does, but a crawler, a
 * misconfigured proxy or a hand-rolled client absolutely will. A 500 for that
 * is noise in the logs and a broken page for the sender, so every action goes
 * through here and gets an empty FormData instead.
 */
export async function safeFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    return new FormData();
  }
}
