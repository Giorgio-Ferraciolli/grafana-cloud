import { KeyboardEvent, useState } from "react";
import { X } from "lucide-react";
import { TextInput } from "./Field";

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function TagInput({ values, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-2.5 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      {values.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-medium text-brand-300"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(values.filter((v) => v !== tag))}
            className="text-brand-300/70 hover:text-brand-200"
            aria-label={`Remover ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <TextInput
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        className="min-w-[120px] flex-1 border-0 bg-transparent p-0 focus:ring-0"
      />
    </div>
  );
}
