"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InvitationAcceptPage() {
  const { locale } = useI18n();
  const { reload } = useLuca();
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    const token = params.token;
    if (!token) return;
    apiFetch(`/api/workspace-invitations/${token}/accept`, { method: "POST" })
      .then(async () => {
        await reload();
        setStatus("done");
        window.setTimeout(() => router.replace(`/${locale}/app`), 900);
      })
      .catch((err) => {
        console.error(err);
        setStatus("error");
      });
  }, [params.token]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="luca-panel max-w-sm p-6 text-center">
        {status === "done" ? (
          <>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(var(--positive-dim))] text-[rgb(var(--positive))]">
              <CheckIcon size={18} weight="bold" />
            </div>
            <h1 className="text-lg font-semibold">{locale === "ru" ? "Доступ добавлен" : "Access added"}</h1>
          </>
        ) : status === "error" ? (
          <>
            <h1 className="text-lg font-semibold">{locale === "ru" ? "Не удалось принять приглашение" : "Could not accept invite"}</h1>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              {locale === "ru" ? "Проверь ссылку или попроси отправить приглашение заново." : "Check the link or ask for a new invite."}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">{locale === "ru" ? "Принимаю приглашение" : "Accepting invite"}</h1>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">{locale === "ru" ? "Подожди несколько секунд." : "This will take a few seconds."}</p>
          </>
        )}
      </div>
    </div>
  );
}
