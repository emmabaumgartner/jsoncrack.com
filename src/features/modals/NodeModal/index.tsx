import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, Button, CloseButton, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";
import { modify, applyEdits } from "jsonc-parser";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setJson = useJson(state => state.setJson);
  const setFileContents = useFile(state => state.setContents);

  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEditing(false);
    setError(null);
    setValue(normalizeNodeData(nodeData?.text ?? []));
  }, [nodeData, opened]);

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setValue(normalizeNodeData(nodeData?.text ?? []));
  };

  const handleSave = () => {
    if (!nodeData) return;

    const originalJson = getJson();

    // Try to parse edited value as JSON; if it fails treat as string
    let parsed: any;
    try {
      parsed = JSON.parse(value);
    } catch (e) {
      // treat as string
      parsed = value;
    }

    try {
      const path = nodeData.path ?? [];
      const edits = modify(originalJson, path as any, parsed, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
      const newJson = applyEdits(originalJson, edits);

      // update global json and left editor contents
      setJson(newJson);
      setFileContents({ contents: newJson, hasChanges: false, skipUpdate: true });

      setEditing(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={() => { onClose(); handleCancel(); }} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="xs" align="center">
              {!editing ? (
                <Button size="xs" variant="outline" onClick={handleEdit}>
                  Edit
                </Button>
              ) : (
                <>
                  <Button size="xs" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="xs" variant="subtle" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              )}
              <CloseButton onClick={() => { onClose(); handleCancel(); }} />
            </Flex>
          </Flex>

          <ScrollArea.Autosize mah={250} maw={600}>
            {!editing ? (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea
                value={value}
                onChange={e => setValue(e.currentTarget.value)}
                minRows={6}
                maxRows={20}
                styles={{ input: { fontFamily: 'monospace' } }}
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
        {error && <Text color="red">{error}</Text>}
      </Stack>
    </Modal>
  );
};
