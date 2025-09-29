import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";

export interface PaginationRecord {
  id: string;
  role: LightfastAppChatUIMessage["role"];
  parts: LightfastAppChatUIMessage["parts"];
  modelId: string | null;
  createdAt: string;
  charCount: number;
  tokenCount: number | null;
}

export interface PaginationSelection {
  selectedRecords: PaginationRecord[];
  accumulatedChars: number;
  hitCharBudget: boolean;
  oversizeRecordId: string | null;
}

export function selectRecordsByCharBudget(
  records: PaginationRecord[],
  charLimit: number | null,
): PaginationSelection {
  if (charLimit === null) {
    const total = records.reduce((sum, record) => sum + record.charCount, 0);
    return {
      selectedRecords: [...records],
      accumulatedChars: total,
      hitCharBudget: false,
      oversizeRecordId: null,
    };
  }

  const selectedRecords: PaginationRecord[] = [];
  let accumulatedChars = 0;
  let hitCharBudget = false;
  let oversizeRecordId: string | null = null;

  for (const record of records) {
    const nextTotal = accumulatedChars + record.charCount;

    if (record.charCount > charLimit && selectedRecords.length === 0) {
      selectedRecords.push(record);
      accumulatedChars += record.charCount;
      hitCharBudget = true;
      oversizeRecordId = record.id;
      break;
    }

    if (nextTotal > charLimit) {
      hitCharBudget = true;
      break;
    }

    selectedRecords.push(record);
    accumulatedChars = nextTotal;
  }

  return {
    selectedRecords,
    accumulatedChars,
    hitCharBudget,
    oversizeRecordId,
  };
}
