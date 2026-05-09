import { LoginView } from "./ui/login-view";

export default async function LoginPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <LoginView locale={locale} />;
}