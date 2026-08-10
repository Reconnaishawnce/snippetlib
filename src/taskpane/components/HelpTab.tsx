/** Static Help page (§7.10). */
import * as React from "react";
import { Link, Text, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase300,
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    paddingLeft: "3px",
    paddingRight: "3px",
  },
});

export const HelpTab: React.FC = () => {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <Text weight="semibold">Placeholders</Text>
      <Text size={200}>
        Write <span className={styles.code}>[Building Name]</span> anywhere in a snippet. On insert
        you&apos;re asked once per document; every later insert fills the value in automatically.
        Edit or pre-fill values in the Placeholders tab (&ldquo;Scan snippets&rdquo; lists them all
        up front). To keep literal brackets in your text, write{" "}
        <span className={styles.code}>\[not a placeholder\]</span> — the backslashes are removed on
        insert.
      </Text>
      <Text weight="semibold">The Queue workflow</Text>
      <Text size={200}>
        Hunt down the snippets you need up front: add them to the Queue (⋯ menu on any snippet),
        organize them into sections, then work through your document top to bottom with Insert or
        Insert All. Inserted items stay struck through so you can see progress; the queue is saved
        inside the document itself.
      </Text>
      <Text weight="semibold">Folders</Text>
      <Text size={200}>
        Saving while a folder is selected files the snippet there automatically. Move snippets any
        time with ⋯ → Move to; a snippet can live in several folders and libraries at once.
      </Text>
      <Text weight="semibold">Backups &amp; sharing</Text>
      <Text size={200}>
        Your library is stored locally in Word&apos;s browser storage — export regularly (Settings,
        or the gear menu). The same file imports on any machine, so it&apos;s also how teams share:
        one curator imports everyone&apos;s exports with &ldquo;Keep both&rdquo; and re-exports the
        master copy. For hands-off sharing, turn on <strong>Team library</strong> in Settings →
        Features: the curator publishes the export file at any HTTPS link, teammates paste that link
        once, and ReportSnips offers to pull whenever the file changes.
      </Text>
      <Text weight="semibold">Installing for teammates</Text>
      <Text size={200}>
        Teammates only need the production manifest file — see{" "}
        <Link href="https://github.com/Reconnaishawnce/snippetlib/blob/main/docs/SIDELOADING.md">
          the sideloading guide
        </Link>
        .
      </Text>
    </div>
  );
};
