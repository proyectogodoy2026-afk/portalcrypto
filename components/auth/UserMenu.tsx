"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User as UserIcon } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

function getInitials(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "?";
  return cleaned.slice(0, 2).toUpperCase();
}

export default function UserMenu({ className }: { className?: string }) {
  const router = useRouter();
  const { user, profile, signOut, loading } = useAuth();

  const display =
    profile?.display_name ?? profile?.username ?? user?.email ?? "";
  const avatarUrl = profile?.avatar_url ?? undefined;

  async function onLogout() {
    await signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div
        className={cn(
          "h-9 w-24 animate-pulse rounded-md bg-zinc-200",
          className,
        )}
      />
    );
  }

  if (!user) {
    return (
      <Link
        className={cn(
          "rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50",
          className,
        )}
        href="/auth/login"
      >
        Ingresar
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 hover:bg-zinc-50",
            className,
          )}
          type="button"
        >
          <Avatar className="h-7 w-7">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={display} /> : null}
            <AvatarFallback>{getInitials(display)}</AvatarFallback>
          </Avatar>
          <span className="max-w-[10rem] truncate text-sm text-zinc-900">
            {display || "Usuario"}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link className="flex items-center gap-2" href="/profile">
            <UserIcon className="h-4 w-4" />
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link className="flex items-center gap-2" href="/settings">
            <Settings className="h-4 w-4" />
            Ajustes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="text-red-700">
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

