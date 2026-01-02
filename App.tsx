import React from 'react';
import { RootNavigator } from './src/navigation';
import { ErrorBoundary } from './src/components/common';

export default function App() {
  return (
    <ErrorBoundary>
      <RootNavigator />
    </ErrorBoundary>
  );
}
