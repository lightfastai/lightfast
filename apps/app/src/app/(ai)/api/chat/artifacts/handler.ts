import type { DocumentHandler } from "./server";
import { codeDocumentHandler } from "./impl/code-handler";

export const documentHandlersByKind: DocumentHandler[] = [codeDocumentHandler];
