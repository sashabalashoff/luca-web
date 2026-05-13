import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

export async function getAuthToken(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { session }
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) message = json.error.message;
    } catch {
      // not JSON — use raw text
    }
    throw new Error(message);
  }

  const json = await response.json();

  return json.data as T;
}
