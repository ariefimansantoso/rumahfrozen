"use client";

import { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical,
  Trash2,
  Check,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveColorNameToHex } from "@/lib/products/color-swatch";
import {
  generateId,
  type OptionValue,
  type ProductOption,
} from "@/components/admin/variants-manager/helpers";

const DEFAULT_COLOR_CODE = "#000000";

function isColorOptionName(name: string) {
  const normalized = name.trim().toLowerCase();
  return normalized.includes("color") || normalized.includes("colour");
}

function isHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

function optionValueColor(value: OptionValue) {
  if (isHexColor(value.colorCode)) return value.colorCode;
  return DEFAULT_COLOR_CODE;
}

export function SortableValueItem({
  id,
  value,
  colorCode,
  showColorPicker,
  onValueChange,
  onColorChange,
  onRemove,
}: {
  id: string;
  value: string;
  colorCode?: string;
  showColorPicker: boolean;
  onValueChange: (newValue: string) => void;
  onColorChange: (newColor: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2", isDragging && "opacity-50")}
    >
      <button
        type="button"
        className="cursor-grab touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="flex-1"
      />
      {showColorPicker && (
        <input
          type="color"
          value={
            isHexColor(colorCode)
              ? colorCode
              : optionValueColor({ id, value, colorCode, position: 0 })
          }
          onChange={(e) => onColorChange(e.target.value)}
          aria-label={`Pick color for ${value || "option value"}`}
          title="Pick color"
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border bg-background p-1"
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Option Editor Component
export function OptionEditor({
  option,
  namePlaceholder,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  canDelete,
}: {
  option: ProductOption;
  namePlaceholder: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (option: ProductOption) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [newValue, setNewValue] = useState("");
  const [newValueColor, setNewValueColor] = useState(DEFAULT_COLOR_CODE);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionName = option.name.trim();
  const isColorOption = isColorOptionName(optionName);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddValue = () => {
    if (!newValue.trim()) return;
    if (
      option.values.some(
        (v) => v.value.toLowerCase() === newValue.toLowerCase().trim()
      )
    ) {
      return;
    }

    const newOptionValue: OptionValue = {
      id: generateId(),
      value: newValue.trim(),
      colorCode: isColorOption
        ? (resolveColorNameToHex(newValue.trim()) ?? newValueColor)
        : undefined,
      position: option.values.length,
    };

    onUpdate({
      ...option,
      values: [...option.values, newOptionValue],
    });
    setNewValue("");
    setNewValueColor(DEFAULT_COLOR_CODE);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddValue();
    }
  };

  const handleRemoveValue = (valueId: string) => {
    onUpdate({
      ...option,
      values: option.values
        .filter((v) => v.id !== valueId)
        .map((v, idx) => ({ ...v, position: idx })),
    });
  };

  const handleValueChange = (valueId: string, newValue: string) => {
    onUpdate({
      ...option,
      values: option.values.map((v) =>
        v.id === valueId
          ? {
              ...v,
              value: newValue,
              // For colour options, track the typed name → swatch. Unresolved
              // names (e.g. "titanium red") keep the current colour.
              ...(isColorOption
                ? {
                    colorCode:
                      resolveColorNameToHex(newValue) ??
                      (isHexColor(v.colorCode)
                        ? v.colorCode
                        : DEFAULT_COLOR_CODE),
                  }
                : {}),
            }
          : v
      ),
    });
  };

  const handleColorChange = (valueId: string, newColor: string) => {
    const colorCode = newColor.toLowerCase();

    onUpdate({
      ...option,
      values: option.values.map((v) =>
        v.id === valueId ? { ...v, colorCode } : v
      ),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = option.values.findIndex((v) => v.id === active.id);
      const newIndex = option.values.findIndex((v) => v.id === over.id);
      const newValues = arrayMove(option.values, oldIndex, newIndex).map(
        (v, idx) => ({ ...v, position: idx })
      );
      onUpdate({ ...option, values: newValues });
    }
  };

  // Collapsed view - show as badge row
  if (!isExpanded) {
    return (
      <div
        className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span
            className={cn(
              "font-medium min-w-[80px]",
              !optionName && "text-muted-foreground",
            )}
          >
            {optionName || namePlaceholder}
          </span>
          <div className="flex flex-wrap gap-1">
            {option.values.map((v) => (
              <Badge key={v.id} variant="secondary" className="gap-1.5 text-xs">
                {isColorOption && (
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full border border-border"
                    style={{ backgroundColor: optionValueColor(v) }}
                  />
                )}
                {v.value}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Expanded view - full editor
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-start gap-2">
        <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
        <div className="flex-1 space-y-4">
          {/* Option name */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Option name
            </label>
            <Input
              value={option.name}
              onChange={(e) => {
                const nextName = e.target.value;
                const nextIsColorOption = isColorOptionName(nextName);
                onUpdate({
                  ...option,
                  name: nextName,
                  values: nextIsColorOption
                    ? option.values.map((v) => ({
                        ...v,
                        colorCode: isHexColor(v.colorCode)
                          ? v.colorCode
                          : (resolveColorNameToHex(v.value) ??
                            DEFAULT_COLOR_CODE),
                      }))
                    : option.values,
                });
              }}
              placeholder={namePlaceholder}
              className="mt-1"
            />
          </div>

          {/* Option values */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Option values
            </label>
            <div className="mt-2 space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={option.values.map((v) => v.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {option.values
                    .sort((a, b) => a.position - b.position)
                    .map((v) => (
                      <SortableValueItem
                        key={v.id}
                        id={v.id}
                        value={v.value}
                        colorCode={v.colorCode}
                        showColorPicker={isColorOption}
                        onValueChange={(newVal) =>
                          handleValueChange(v.id, newVal)
                        }
                        onColorChange={(newColor) =>
                          handleColorChange(v.id, newColor)
                        }
                        onRemove={() => handleRemoveValue(v.id)}
                      />
                    ))}
                </SortableContext>
              </DndContext>

              {/* Auto-expanding add value input */}
              <div className="flex items-center gap-2">
                <div className="w-4" />
                <Input
                  ref={inputRef}
                  value={newValue}
                  onChange={(e) => {
                    const next = e.target.value;
                    setNewValue(next);
                    if (isColorOption) {
                      setNewValueColor(
                        resolveColorNameToHex(next) ?? DEFAULT_COLOR_CODE,
                      );
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    if (newValue.trim()) handleAddValue();
                  }}
                  placeholder="Add another value"
                  className="flex-1"
                />
                {isColorOption && (
                  <input
                    type="color"
                    value={newValueColor}
                    onChange={(e) => setNewValueColor(e.target.value)}
                    aria-label="Pick color for new option value"
                    title="Pick color"
                    className="h-8 w-10 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleAddValue}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Delete and Done */}
      <div className="flex items-center justify-between pt-2 border-t">
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        ) : (
          <div />
        )}
        <Button type="button" size="sm" onClick={onToggle}>
          <Check className="mr-1 h-4 w-4" />
          Done
        </Button>
      </div>
    </div>
  );
}

// Image Selector Modal with Upload Support
