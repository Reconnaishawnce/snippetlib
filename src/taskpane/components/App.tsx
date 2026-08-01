import * as React from "react";
import { makeStyles, tokens, Text, Title3 } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalL,
    textAlign: "center",
  },
});

const App: React.FC = () => {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <Title3 as="h1">ReportSnips</Title3>
      <Text>Save, organize, and insert reusable report snippets.</Text>
      <Text size={200}>M0 scaffold — snippet library coming in the next milestones.</Text>
    </div>
  );
};

export default App;
