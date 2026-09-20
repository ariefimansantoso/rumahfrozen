"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowLeft, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

interface NotFoundStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
}

export function NotFoundState({
  title,
  description,
  icon,
  backHref,
  backLabel,
  homeHref = "/",
  homeLabel,
  className,
}: NotFoundStateProps) {
  const t = useTranslations("common");

  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center p-4",
        className,
      )}
    >
      <Card className="w-full max-w-md border-none shadow-none bg-transparent">
        <CardHeader className="flex flex-col items-center space-y-2 text-center pb-2">
          {icon && <div className="mb-4">{icon}</div>}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {title || "Page Not Found"}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {description ||
              "The page you are looking for does not exist or has been moved."}
          </p>
        </CardHeader>
        <CardContent className="pb-2"></CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center pt-2">
          {backHref && (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={backHref}>
                <ArrowLeft className="mr-2 size-4" />
                {backLabel || t("back")}
              </Link>
            </Button>
          )}
          <Button asChild className="w-full sm:w-auto">
            <Link href={homeHref}>
              <Home className="mr-2 size-4" />
              {homeLabel || t("home")}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
