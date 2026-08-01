/** Debounced search box with library-scope toggle (§7.5). */
import * as React from "react";
import { Input, Switch, makeStyles, tokens } from "@fluentui/react-components";
import { Search16Regular } from "@fluentui/react-icons";
import { useLibraryStore } from "../state/libraryStore";
import { useSearchStore } from "../state/searchStore";

const DEBOUNCE_MS = 150;

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  toggleRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
});

export const SearchBox: React.FC = () => {
  const styles = useStyles();
  const scope = useLibraryStore((s) => s.scope);
  const allLibraries = useSearchStore((s) => s.allLibraries);
  const setQuery = useSearchStore((s) => s.setQuery);
  const setAllLibraries = useSearchStore((s) => s.setAllLibraries);
  const [text, setText] = React.useState("");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const activeLibraryId = scope.kind === "library" ? scope.libraryId : null;

  React.useEffect(() => {
    // `/` focuses search from anywhere outside a text field (§8).
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "/" && !inField) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const schedule = (value: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setQuery(value, activeLibraryId), DEBOUNCE_MS);
  };

  return (
    <div className={styles.root}>
      <Input
        ref={inputRef}
        contentBefore={<Search16Regular />}
        placeholder="Search snippets  ( / )"
        value={text}
        aria-label="Search snippets"
        onChange={(_, data) => {
          setText(data.value);
          schedule(data.value);
        }}
      />
      {text.trim() && scope.kind === "library" && (
        <div className={styles.toggleRow}>
          <Switch
            label="All libraries"
            checked={allLibraries}
            onChange={(_, data) => setAllLibraries(Boolean(data.checked), activeLibraryId)}
          />
        </div>
      )}
    </div>
  );
};
