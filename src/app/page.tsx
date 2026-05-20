import { defaultLocale } from "@/shared/config/locales";
import { redirect } from "next/navigation";

export default function Home() {
  redirect(`/${defaultLocale}/login`);
}
