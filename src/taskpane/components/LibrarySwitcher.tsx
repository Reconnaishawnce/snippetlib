/** Library switcher dropdown + manage menu (§7.1). */
import * as React from "react";
import {
  Button,
  Dropdown,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  OptionGroup,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Settings20Regular } from "@fluentui/react-icons";
import { useLibraryStore, type LibraryScope } from "../state/libraryStore";
import { NameDialog, ConfirmDialog } from "./dialogs";

const ALL_KEY = "__all__";
const BACKLOG_KEY = "__backlog__";

const useStyles = makeStyles({
  row: {
    display: "flex",
    gap: tokens.spacingHorizontalXS,
    alignItems: "center",
  },
  dropdown: {
    flexGrow: 1,
    minWidth: "0",
  },
});

function scopeKey(scope: LibraryScope): string {
  switch (scope.kind) {
    case "all":
      return ALL_KEY;
    case "backlog":
      return BACKLOG_KEY;
    case "library":
      return scope.libraryId;
  }
}

export const LibrarySwitcher: React.FC = () => {
  const styles = useStyles();
  const { libraries, scope, selectScope, createLibrary, renameLibrary, deleteLibrary } =
    useLibraryStore();
  const [dialog, setDialog] = React.useState<"create" | "rename" | "delete" | null>(null);

  const sorted = [...libraries].sort((a, b) => a.name.localeCompare(b.name));
  const active =
    scope.kind === "library" ? libraries.find((l) => l.id === scope.libraryId) : undefined;
  const displayValue =
    scope.kind === "all"
      ? "All Libraries"
      : scope.kind === "backlog"
        ? "Unassigned Backlog"
        : (active?.name ?? "");

  const onSelect = (key: string | undefined) => {
    if (!key) {
      return;
    }
    if (key === ALL_KEY) {
      void selectScope({ kind: "all" });
    } else if (key === BACKLOG_KEY) {
      void selectScope({ kind: "backlog" });
    } else {
      void selectScope({ kind: "library", libraryId: key });
    }
  };

  return (
    <div className={styles.row}>
      <Dropdown
        className={styles.dropdown}
        aria-label="Library"
        value={displayValue}
        selectedOptions={[scopeKey(scope)]}
        onOptionSelect={(_, data) => onSelect(data.optionValue)}
      >
        <Option value={ALL_KEY}>All Libraries</Option>
        <Option value={BACKLOG_KEY}>Unassigned Backlog</Option>
        <OptionGroup label="Libraries">
          {sorted.map((library) => (
            <Option key={library.id} value={library.id}>
              {library.name}
            </Option>
          ))}
        </OptionGroup>
      </Dropdown>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Tooltip content="Manage libraries" relationship="label">
            <Button
              appearance="subtle"
              icon={<Settings20Regular />}
              aria-label="Manage libraries"
            />
          </Tooltip>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem onClick={() => setDialog("create")}>New library…</MenuItem>
            <MenuItem disabled={!active} onClick={() => setDialog("rename")}>
              Rename library…
            </MenuItem>
            <MenuItem disabled={!active} onClick={() => setDialog("delete")}>
              Delete library…
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <NameDialog
        open={dialog === "create"}
        title="New library"
        label="Library name"
        submitLabel="Create"
        onSubmit={(name) => {
          setDialog(null);
          void createLibrary(name);
        }}
        onCancel={() => setDialog(null)}
      />
      <NameDialog
        open={dialog === "rename"}
        title="Rename library"
        label="Library name"
        initialValue={active?.name}
        submitLabel="Rename"
        onSubmit={(name) => {
          setDialog(null);
          if (active) {
            void renameLibrary(active.id, name);
          }
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title={`Delete library "${active?.name ?? ""}"?`}
        message={
          "This deletes the library and its folders. Snippets are NOT deleted — any snippet that " +
          "was only in this library moves to the Unassigned Backlog."
        }
        confirmLabel="Delete library"
        onConfirm={() => {
          setDialog(null);
          if (active) {
            void deleteLibrary(active.id);
          }
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
};
