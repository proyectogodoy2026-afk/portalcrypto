import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Ajustes</h1>
      <div className="text-sm text-zinc-600">Configurá tus preferencias de cuenta y alertas.</div>
      <div className="space-y-2">
        <Link
          href="/settings/alerts"
          className="block rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
        >
          Notificaciones y alertas
        </Link>
      </div>
    </div>
  );
}
