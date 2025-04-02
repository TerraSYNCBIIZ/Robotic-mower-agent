"use client";

import * as React from "react";
import { Trash2, Edit, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryManagementProps {
  initialCategories?: Category[];
  onChange?: (categories: Category[]) => void;
}

const colorOptions = [
  { value: "red", label: "Red" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "purple", label: "Purple" },
  { value: "orange", label: "Orange" },
  { value: "pink", label: "Pink" },
  { value: "gray", label: "Gray" },
];

const CategoryManagement: React.FC<CategoryManagementProps> = ({
  initialCategories = [],
  onChange,
}) => {
  const [categories, setCategories] = React.useState<Category[]>(initialCategories);
  const [newCategory, setNewCategory] = React.useState<Partial<Category>>({
    name: "",
    color: "",
  });
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  // Update parent component when categories change
  React.useEffect(() => {
    if (onChange) {
      onChange(categories);
    }
  }, [categories, onChange]);

  const resetForm = () => {
    setNewCategory({ name: "", color: "" });
    setEditingCategory(null);
    setIsEditing(false);
  };

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.color) return;

    const category = {
      id: crypto.randomUUID(),
      name: newCategory.name,
      color: newCategory.color,
    };

    setCategories([...categories, category]);
    resetForm();
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !editingCategory.name || !editingCategory.color) return;

    setCategories(
      categories.map((cat) =>
        cat.id === editingCategory.id ? editingCategory : cat
      )
    );
    resetForm();
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(categories.filter((cat) => cat.id !== id));
  };

  const startEditing = (category: Category) => {
    setEditingCategory(category);
    setIsEditing(true);
  };

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: "bg-red-500",
      blue: "bg-blue-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      pink: "bg-pink-500",
      gray: "bg-gray-500",
    };
    return colorMap[color] || "bg-gray-500";
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Category Management</DialogTitle>
        <DialogDescription>
          Add, edit, or delete categories for your mowers.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="category-name">
            {isEditing ? "Edit Category Name" : "Category Name"}
          </Label>
          <Input
            id="category-name"
            placeholder="Enter category name"
            value={isEditing ? editingCategory?.name || "" : newCategory.name}
            onChange={(e) => {
              if (isEditing && editingCategory) {
                setEditingCategory({ ...editingCategory, name: e.target.value });
              } else {
                setNewCategory({ ...newCategory, name: e.target.value });
              }
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="category-color">
            {isEditing ? "Edit Category Color" : "Category Color"}
          </Label>
          <Select
            value={isEditing ? editingCategory?.color : newCategory.color}
            onValueChange={(value) => {
              if (isEditing && editingCategory) {
                setEditingCategory({ ...editingCategory, color: value });
              } else {
                setNewCategory({ ...newCategory, color: value });
              }
            }}
          >
            <SelectTrigger id="category-color">
              <SelectValue placeholder="Select a color" />
            </SelectTrigger>
            <SelectContent>
              {colorOptions.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`${getColorClass(
                        color.value
                      )} h-4 w-4 rounded-full`}
                    />
                    {color.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2">
          {isEditing ? (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleUpdateCategory}
                disabled={!editingCategory?.name || !editingCategory?.color}
              >
                Update Category
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={handleAddCategory}
              disabled={!newCategory.name || !newCategory.color}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-2 font-medium">Existing Categories</h3>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
        ) : (
          <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`${getColorClass(
                      category.color
                    )} h-4 w-4 rounded-full`}
                  />
                  <span>{category.name}</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(category)}
                  >
                    <Edit size={16} />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 size={16} className="text-destructive" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{category.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteCategory(category.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogFooter className="mt-4">
        <Button variant="outline">Close</Button>
      </DialogFooter>
    </div>
  );
};

export default CategoryManagement; 