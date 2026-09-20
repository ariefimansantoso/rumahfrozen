"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SecretInput(props: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  secretSet?: boolean;
  placeholderWhenSet?: string;
  placeholderWhenUnset?: string;
  helperText?: string;
}) {
  const placeholder = props.secretSet
    ? props.placeholderWhenSet
    : props.placeholderWhenUnset;

  return (
    <div className="space-y-2">
      {props.label ? <Label htmlFor={props.id}>{props.label}</Label> : null}
      <Input
        id={props.id}
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        className={cn(props.value && "[-webkit-text-security:disc]")}
      />
      {props.helperText ? (
        <p className="text-xs text-muted-foreground">{props.helperText}</p>
      ) : null}
    </div>
  );
}
