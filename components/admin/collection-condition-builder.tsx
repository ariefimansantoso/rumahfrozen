"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CollectionCondition, CollectionConditionField, CollectionConditionOperator } from "@/types";
import { useMultiVendorMode } from "@/providers/app-settings-provider";

interface CollectionConditionBuilderProps {
  conditions: CollectionCondition[];
  onChange: (conditions: CollectionCondition[]) => void;
  matchType: "all" | "any";
  onMatchTypeChange: (type: "all" | "any") => void;
}

const FIELD_OPTIONS: { value: CollectionConditionField; label: string; type: "string" | "number" | "date" }[] = [
  { value: "title", label: "Product title", type: "string" },
  { value: "productType", label: "Product type", type: "string" },
  { value: "vendor", label: "Vendor", type: "string" },
  { value: "tag", label: "Product tag", type: "string" },
  { value: "price", label: "Price", type: "number" },
  { value: "comparePrice", label: "Compare at price", type: "number" },
  { value: "weight", label: "Weight", type: "number" },
  { value: "stock", label: "Stock quantity", type: "number" },
  { value: "category", label: "Category", type: "string" },
];

const STRING_OPERATORS: { value: CollectionConditionOperator; label: string }[] = [
  { value: "equals", label: "is equal to" },
  { value: "not_equals", label: "is not equal to" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
];

const NUMBER_OPERATORS: { value: CollectionConditionOperator; label: string }[] = [
  { value: "equals", label: "is equal to" },
  { value: "not_equals", label: "is not equal to" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
];

const VENDOR_OPERATORS: { value: CollectionConditionOperator; label: string }[] = [
  { value: "equals", label: "is equal to" },
  { value: "not_equals", label: "is not equal to" },
  { value: "is_set", label: "is set" },
  { value: "is_not_set", label: "is not set" },
];

type VendorOption = { _id: string; storeName: string; slug?: string };

export function CollectionConditionBuilder({
  conditions,
  onChange,
  matchType,
  onMatchTypeChange,
}: CollectionConditionBuilderProps) {
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const { isMultiVendor } = useMultiVendorMode();
  const fieldOptions = useMemo(
    () =>
      isMultiVendor
        ? FIELD_OPTIONS
        : FIELD_OPTIONS.filter((field) => field.value !== "vendor"),
    [isMultiVendor],
  );

  useEffect(() => {
    if (!isMultiVendor) {
      setVendors([]);
      return;
    }

    let isMounted = true;

    async function fetchVendors() {
      try {
        const res = await fetch("/api/admin/vendors?page=1&limit=100&status=all&sortOrder=asc");
        const json = await res.json();
        const vendorList: VendorOption[] = json?.data?.data || [];
        if (isMounted) setVendors(Array.isArray(vendorList) ? vendorList : []);
      } catch {
        if (isMounted) setVendors([]);
      }
    }

    fetchVendors();
    return () => {
      isMounted = false;
    };
  }, [isMultiVendor]);

  const getFieldType = (field: CollectionConditionField) => {
    return fieldOptions.find((f) => f.value === field)?.type || "string";
  };

  const getOperatorsForField = (field: CollectionConditionField) => {
    if (field === "vendor") return VENDOR_OPERATORS;
    const fieldType = getFieldType(field);
    return fieldType === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
  };

  const addCondition = () => {
    onChange([
      ...conditions,
      { field: "title", operator: "contains", value: "" },
    ]);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (
    index: number,
    updates: Partial<CollectionCondition>
  ) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };

    // Reset operator if field type changes
    if (updates.field) {
      const currentOperator = newConditions[index].operator;
      const validOperators = getOperatorsForField(updates.field);

      if (!validOperators.find((op) => op.value === currentOperator)) {
        newConditions[index].operator = validOperators[0].value;
      }

      if (updates.field === "vendor" && vendors.length > 0) {
        const currentValue = newConditions[index].value;
        if (typeof currentValue !== "string" || !currentValue) {
          newConditions[index].value = vendors[0]._id;
        }
      }
    }

    onChange(newConditions);
  };

  const needsValueInput = (operator: CollectionConditionOperator) => {
    return !["is_set", "is_not_set"].includes(operator);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Collection Conditions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Match Type */}
        <div className="space-y-2">
          <Label>Products must match:</Label>
          <div className="flex gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="match-all"
                name="matchType"
                value="all"
                checked={matchType === "all"}
                onChange={() => onMatchTypeChange("all")}
              />
              <Label htmlFor="match-all" className="font-normal cursor-pointer">
                All conditions
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="match-any"
                name="matchType"
                value="any"
                checked={matchType === "any"}
                onChange={() => onMatchTypeChange("any")}
              />
              <Label htmlFor="match-any" className="font-normal cursor-pointer">
                Any condition
              </Label>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
              No conditions added. Add a condition to automatically include products.
            </p>
          ) : (
            conditions.map((condition, index) => {
              const operators = getOperatorsForField(condition.field);
              const fieldType = getFieldType(condition.field);

              return (
                <div
                  key={index}
                  className="flex flex-wrap items-end gap-2 p-3 border rounded-md bg-muted/30"
                >
                  {/* Field Select */}
                  <div className="flex-1 min-w-[150px]">
                    <Label className="text-xs text-muted-foreground">Field</Label>
                    <NativeSelect
                      value={condition.field}
                      onChange={(event) =>
                        updateCondition(index, {
                          field: event.target.value as CollectionConditionField,
                        })
                      }
                    >
                      {fieldOptions.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  {/* Operator Select */}
                  <div className="flex-1 min-w-[150px]">
                    <Label className="text-xs text-muted-foreground">Condition</Label>
                    <NativeSelect
                      value={condition.operator}
                      onChange={(event) =>
                        updateCondition(index, {
                          operator: event.target.value as CollectionConditionOperator,
                        })
                      }
                    >
                      {operators.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  {/* Value Input */}
                  {needsValueInput(condition.operator) && (
                    <div className="flex-1 min-w-[150px]">
                      <Label className="text-xs text-muted-foreground">Value</Label>
                      {condition.field === "vendor" && vendors.length > 0 ? (
                        <NativeSelect
                          value={typeof condition.value === "string" ? condition.value : ""}
                          onChange={(event) =>
                            updateCondition(index, { value: event.target.value })
                          }
                        >
                          <option value="" disabled>
                            Select vendor
                          </option>
                          {vendors.map((v) => (
                            <option key={v._id} value={v._id}>
                              {v.storeName}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          type={fieldType === "number" ? "number" : "text"}
                          value={condition.value as string}
                          onChange={(e) =>
                            updateCondition(index, {
                              value:
                                fieldType === "number"
                                  ? parseFloat(e.target.value) || 0
                                  : e.target.value,
                            })
                          }
                          placeholder={
                            fieldType === "number" ? "Enter number" : "Enter value"
                          }
                        />
                      )}
                    </div>
                  )}

                  {/* Delete Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(index)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Add Condition Button */}
        <Button
          type="button"
          variant="outline"
          onClick={addCondition}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add condition
        </Button>
      </CardContent>
    </Card>
  );
}
