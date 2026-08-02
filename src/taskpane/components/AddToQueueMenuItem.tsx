/** "Add to Queue" menu entry with a section picker flyout when needed (§7.7). */
import * as React from "react";
import { Menu, MenuItem, MenuList, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import { useQueueStore } from "../state/queueStore";
import { usePrefsStore } from "../state/prefsStore";

export const AddToQueueMenuItem: React.FC<{ snippetId: string }> = ({ snippetId }) => {
  const sections = useQueueStore((s) => s.queue.sections);
  const addSnippet = useQueueStore((s) => s.addSnippet);
  const enableQueue = usePrefsStore((s) => s.prefs?.enableQueue ?? true);

  if (!enableQueue) {
    return null;
  }
  if (sections.length <= 1) {
    return <MenuItem onClick={() => addSnippet(snippetId)}>Add to Queue</MenuItem>;
  }
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <MenuItem>Add to Queue</MenuItem>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {[...sections]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((section) => (
              <MenuItem key={section.id} onClick={() => addSnippet(snippetId, section.id)}>
                {section.name}
              </MenuItem>
            ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
};
