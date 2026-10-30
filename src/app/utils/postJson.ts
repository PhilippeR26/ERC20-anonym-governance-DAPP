// The sponsored routes send their errors as data: a thrown error would reach the browser as an opaque HTTP 500.
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Request failed: HTTP ${response.status}`);
  }

  const error = (data as { error?: unknown } | null)?.error;
  if (typeof error === "string") throw new Error(error);
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  return data as T;
}
