'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { DataUIPart } from 'ai';
import type { LightfastAppChatUICustomDataTypes } from '@repo/chat-core/types';

interface DataStreamContextValue {
  dataStream: DataUIPart<LightfastAppChatUICustomDataTypes>[];
  setDataStream: React.Dispatch<
    React.SetStateAction<DataUIPart<LightfastAppChatUICustomDataTypes>[]>
  >;
}

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

export function DataStreamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dataStream, setDataStream] = useState<DataUIPart<LightfastAppChatUICustomDataTypes>[]>(
    [],
  );

  const value = useMemo(() => ({ dataStream, setDataStream }), [dataStream]);

  return (
    <DataStreamContext.Provider value={value}>
      {children}
    </DataStreamContext.Provider>
  );
}

export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (!context) {
    throw new Error('useDataStream must be used within a DataStreamProvider');
  }
  return context;
}