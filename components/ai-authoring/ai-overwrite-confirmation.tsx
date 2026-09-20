"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AiOverwriteConfirmationProps = {
  open: boolean;
  fieldLabel: string;
  onOpenChange: (open: boolean) => void;
  onReplace: () => void;
  onImprove?: () => void;
  onAppend?: () => void;
};

export function AiOverwriteConfirmation({
  open,
  fieldLabel,
  onOpenChange,
  onReplace,
  onImprove,
  onAppend,
}: AiOverwriteConfirmationProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Use AI for {fieldLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            This field already has content. Choose how the generated draft should
            be applied.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {onAppend ? (
            <AlertDialogAction onClick={onAppend}>Append</AlertDialogAction>
          ) : null}
          {onImprove ? (
            <AlertDialogAction onClick={onImprove}>Improve</AlertDialogAction>
          ) : null}
          <AlertDialogAction onClick={onReplace}>Replace</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
